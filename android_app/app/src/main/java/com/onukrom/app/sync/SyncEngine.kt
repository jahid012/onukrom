package com.onukrom.app.sync

import androidx.room.withTransaction
import com.onukrom.app.core.Time
import com.onukrom.app.data.FlagsSerializer
import com.onukrom.app.data.LinesSerializer
import com.onukrom.app.data.Session
import com.onukrom.app.data.api.ApiClient
import com.onukrom.app.data.api.ApiException
import com.onukrom.app.data.api.AppJson
import com.onukrom.app.data.api.CategoryDto
import com.onukrom.app.data.api.OrderDto
import com.onukrom.app.data.api.PriceListDto
import com.onukrom.app.data.api.ProductDto
import com.onukrom.app.data.api.PushOperation
import com.onukrom.app.data.api.RouteDto
import com.onukrom.app.data.api.ShopDto
import com.onukrom.app.data.api.StockDto
import com.onukrom.app.data.api.TripDto
import com.onukrom.app.data.db.AppDatabase
import com.onukrom.app.data.db.CategoryEntity
import com.onukrom.app.data.db.OrderEntity
import com.onukrom.app.data.db.OrderLine
import com.onukrom.app.data.db.PriceItemEntity
import com.onukrom.app.data.db.ProductEntity
import com.onukrom.app.data.db.RouteEntity
import com.onukrom.app.data.db.ShopEntity
import com.onukrom.app.data.db.StockEntity
import com.onukrom.app.data.db.StopEntity
import com.onukrom.app.data.db.TripEntity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.longOrNull

data class SyncStatus(val running: Boolean = false, val error: String? = null, val finishedAt: Long = 0)

/**
 * Push first (so the office gets new orders quickly), then pull.
 * Every step is safe to repeat: pushes are idempotent by record id and pulls
 * upsert by id, so a sync cut off half-way simply runs again later.
 */
class SyncEngine(private val db: AppDatabase, private val api: ApiClient, private val session: Session) {
    private val dao = db.dao()
    private val mutex = Mutex()
    private val _status = MutableStateFlow(SyncStatus())
    val status: StateFlow<SyncStatus> = _status

    suspend fun run() {
        if (!session.current.loggedIn) return
        mutex.withLock {
            _status.value = _status.value.copy(running = true, error = null)
            try {
                push()
                pull()
                session.setLastSync(System.currentTimeMillis())
                _status.value = SyncStatus(running = false, finishedAt = System.currentTimeMillis())
            } catch (e: ApiException) {
                if (e.isUnauthorized) session.markExpired()
                _status.value = SyncStatus(running = false, error = e.code)
                throw e
            } catch (e: Exception) {
                _status.value = SyncStatus(running = false, error = "SERVER")
                throw e
            }
        }
    }

    /* ------------------------------ push ------------------------------ */

    private suspend fun push() {
        repeat(20) { // at most 20 batches per run
            val batch = dao.pendingOutbox(50)
            if (batch.isEmpty()) return
            val ops = batch.map {
                PushOperation(it.entity, "upsert", it.recordId, it.clientVersion, AppJson.parseToJsonElement(it.payload))
            }
            val results = api.push(ops).results
            var retryLater = false

            for (row in batch) {
                val r = results.firstOrNull { it.entity == row.entity && it.id == row.recordId } ?: continue
                when (r.result) {
                    "accepted", "duplicate" -> db.withTransaction {
                        dao.deleteOutbox(row.seq)
                        applyServer(row.entity, row.recordId, row.clientVersion, r.server as? JsonObject)
                    }
                    "rejected" -> db.withTransaction {
                        dao.rejectOutbox(row.seq, r.error?.code, r.error?.message)
                        if (row.entity == "order") dao.setOrderSync(row.recordId, "rejected", r.error?.code)
                    }
                    else -> {
                        dao.bumpOutbox(row.seq, r.error?.code)
                        retryLater = true
                    }
                }
            }
            if (retryLater) return
        }
    }

    private suspend fun applyServer(entity: String, id: String, version: Int, server: JsonObject?) {
        server ?: return
        fun str(k: String) = server[k]?.jsonPrimitive?.contentOrNull
        when (entity) {
            "order" -> {
                val flags = server["flags"]?.jsonArray?.mapNotNull { it.jsonPrimitive.contentOrNull } ?: emptyList()
                val current = dao.orderNow(id) ?: return
                dao.orderAccepted(
                    id, version,
                    status = str("status") ?: current.status,
                    number = str("number") ?: current.number,
                    total = server["total"]?.jsonPrimitive?.longOrNull ?: current.total,
                    flags = AppJson.encodeToString(FlagsSerializer, flags),
                )
            }
            "shop" -> dao.updateShopStatus(id, str("status") ?: "pending_approval", str("code"))
        }
    }

    /* ------------------------------ pull ------------------------------ */

    private suspend fun pull() {
        val me = api.me()
        session.updateMe(me)

        val routes = full("routes", RouteDto.serializer()).map { RouteEntity(it.id, it.name, it.code, it.visitDays.joinToString(",")) }
        val categories = full("categories", CategoryDto.serializer()).map { CategoryEntity(it.id, it.name, it.nameBn, it.sort) }
        val prices = full("price_lists", PriceListDto.serializer()).flatMap { l ->
            l.items.map { PriceItemEntity(l.id, l.appliesTo, l.target, it.productId, it.unitPrice) }
        }
        val stock = full("stock", StockDto.serializer()).map { StockEntity(it.productId, it.available) }
        dao.replaceReference(routes, categories, prices, stock)

        delta("products", ProductDto.serializer()) { rows ->
            dao.deleteProducts(rows.filter { it.deleted }.map { it.id })
            dao.upsertProducts(rows.filterNot { it.deleted }.map {
                ProductEntity(it.id, it.categoryId, it.sku, it.name, it.nameBn, it.brand, it.packSize.coerceAtLeast(1), it.mrp, it.price, it.active)
            })
        }

        delta("shops", ShopDto.serializer()) { rows ->
            val localEdits = dao.outboxIds("shop").toSet()
            val incoming = rows.filterNot { it.id in localEdits }
            dao.deleteShops(incoming.filter { it.deleted }.map { it.id })
            dao.upsertShops(incoming.filterNot { it.deleted }.map {
                ShopEntity(
                    it.id, it.routeId, it.code, it.name, it.nameBn, it.ownerName, it.phone, it.category, it.lat, it.lng,
                    it.creditLimit, it.due, it.status, Time.parse(it.lastOrderAt),
                )
            })
        }

        if (me.isSales) {
            delta("orders", OrderDto.serializer()) { rows ->
                val localEdits = dao.outboxIds("order").toSet()
                val products = dao.productsNow().associateBy { it.id }
                val shops = dao.shopsNow().associateBy { it.id }
                dao.upsertOrders(rows.filterNot { it.id in localEdits }.map { o ->
                    val existing = dao.orderNow(o.id)
                    val lines = o.items.map {
                        val p = products[it.productId]
                        OrderLine(it.id, it.productId, p?.nameBn ?: p?.name ?: "—", p?.packSize ?: 1, it.qty, it.unitPrice, it.deliveredQty)
                    }
                    OrderEntity(
                        id = o.id, number = o.number, shopId = o.shopId,
                        shopName = shops[o.shopId]?.let { it.nameBn ?: it.name } ?: existing?.shopName ?: "—",
                        status = o.status, orderedAt = Time.parse(o.orderedAt) ?: System.currentTimeMillis(),
                        subtotal = o.subtotal, discount = o.discount, total = o.total, paid = o.paid, note = o.note,
                        rejectReason = o.rejectReason, tripNumber = o.tripNumber,
                        itemsJson = AppJson.encodeToString(LinesSerializer, lines),
                        flags = existing?.flags ?: "[]",
                        lat = existing?.lat, lng = existing?.lng, accuracyM = existing?.accuracyM,
                        clientVersion = existing?.clientVersion ?: 1, sync = "synced", syncError = null,
                    )
                })
            }
        }

        if (me.isDelivery) pullTrips() else dao.replaceTrips(emptyList(), emptyList())

        dao.pruneVisits(Time.startOfToday() - 7L * 24 * 3600 * 1000)
    }

    /**
     * Trips are replaced from the server, except what the delivery man did on
     * the phone that has not reached the server yet (still in the outbox).
     */
    private suspend fun pullTrips() {
        val trips = full("trips", TripDto.serializer())
        val products = dao.productsNow().associateBy { it.id }
        val local = dao.stopsNow().associateBy { it.orderId }
        val waiting = dao.pendingOutbox(1000)
        fun payloads(entity: String) = waiting.filter { it.entity == entity }.map { AppJson.parseToJsonElement(it.payload).jsonObject }
        fun JsonObject.s(k: String) = this[k]?.jsonPrimitive?.contentOrNull

        val waitingDeliveries = payloads("delivery").mapNotNull { it.s("order_id") }.toSet()
        val waitingTripStatus = payloads("trip_status").associate { it.s("trip_id") to it.s("status") }
        val waitingCash = payloads("collection").filter { it.s("method") == "cash" }
            .groupBy { it.s("order_id") }.mapValues { (_, list) -> list.sumOf { it["amount"]?.jsonPrimitive?.longOrNull ?: 0 } }

        val stops = trips.flatMap { t ->
            t.orders.mapIndexed { i, o ->
                val mine = local[o.id]?.takeIf { o.id in waitingDeliveries }
                val lines = o.items.map {
                    val p = products[it.productId]
                    OrderLine(it.id, it.productId, p?.nameBn ?: p?.name ?: "—", p?.packSize ?: 1, it.qty, it.unitPrice, it.deliveredQty)
                }
                StopEntity(
                    orderId = o.id, tripId = t.id, sort = i, number = o.number, shopId = o.shopId,
                    shopName = o.shop?.name ?: "—", shopNameBn = o.shop?.nameBn, ownerName = o.shop?.ownerName, phone = o.shop?.phone,
                    lat = o.shop?.lat, lng = o.shop?.lng, shopDue = o.shop?.due ?: 0,
                    status = mine?.status ?: o.status,
                    total = mine?.total ?: o.total,
                    paid = o.paid,
                    itemsJson = mine?.itemsJson ?: AppJson.encodeToString(LinesSerializer, lines),
                    localResult = mine?.localResult,
                    localCollected = mine?.localCollected ?: 0,
                )
            }
        }
        dao.replaceTrips(
            trips.map { t ->
                val cash = t.orders.sumOf { waitingCash[it.id] ?: 0 }
                TripEntity(t.id, t.number, t.route, t.vehicle, waitingTripStatus[t.id] ?: t.status, t.cashCollected + cash)
            },
            stops,
        )
    }

    private suspend fun <T> full(entity: String, serializer: KSerializer<T>): List<T> =
        api.pull(entity, null).items.map { AppJson.decodeFromJsonElement(serializer, it) }

    private suspend fun <T> delta(entity: String, serializer: KSerializer<T>, apply: suspend (List<T>) -> Unit) {
        var cursor = session.cursor(entity)
        var first = true
        do {
            val page = api.pull(entity, cursor, 500, overlap = first && cursor != null)
            val rows = page.items.map { AppJson.decodeFromJsonElement(serializer, it) }
            db.withTransaction { apply(rows) }
            cursor = page.nextCursor
            session.setCursor(entity, cursor)
            first = false
        } while (page.hasMore)
    }
}
