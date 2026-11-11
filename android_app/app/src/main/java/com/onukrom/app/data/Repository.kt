package com.onukrom.app.data

import androidx.room.withTransaction
import com.onukrom.app.core.Time
import com.onukrom.app.core.Ulid
import com.onukrom.app.data.api.AppJson
import com.onukrom.app.data.db.AppDatabase
import com.onukrom.app.data.db.OrderEntity
import com.onukrom.app.data.db.OrderLine
import com.onukrom.app.data.db.OutboxEntity
import com.onukrom.app.data.db.PriceItemEntity
import com.onukrom.app.data.db.ProductEntity
import com.onukrom.app.data.db.RouteEntity
import com.onukrom.app.data.db.ShopEntity
import com.onukrom.app.data.db.StopEntity
import com.onukrom.app.data.db.VisitEntity
import com.onukrom.app.location.Fix
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonObjectBuilder
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

val LinesSerializer = ListSerializer(OrderLine.serializer())
val FlagsSerializer = ListSerializer(String.serializer())

fun OrderEntity.lines(): List<OrderLine> = runCatching { AppJson.decodeFromString(LinesSerializer, itemsJson) }.getOrDefault(emptyList())
fun OrderEntity.flagList(): List<String> = runCatching { AppJson.decodeFromString(FlagsSerializer, flags) }.getOrDefault(emptyList())
fun StopEntity.lines(): List<OrderLine> = runCatching { AppJson.decodeFromString(LinesSerializer, itemsJson) }.getOrDefault(emptyList())

/** Price list resolution, same order as the server: shop type list → route list → default price. */
class Pricing(private val items: List<PriceItemEntity>, private val routes: List<RouteEntity>) {
    private val byKey = items.groupBy { it.appliesTo to it.target }

    fun priceFor(shop: ShopEntity?, product: ProductEntity): Long {
        if (shop != null) {
            val routeName = routes.firstOrNull { it.id == shop.routeId }?.name
            for (key in listOf("shop_category" to shop.category, "area" to routeName)) {
                byKey[key]?.firstOrNull { it.productId == product.id }?.let { return it.unitPrice }
            }
        }
        return product.price
    }
}

data class DraftLine(val product: ProductEntity, val qty: Int, val unitPrice: Long)

/** Writes made on the phone. Each one is saved locally and queued in the outbox in one transaction. */
class Repository(private val db: AppDatabase, private val session: Session) {
    val dao = db.dao()

    private suspend fun queue(entity: String, id: String, data: JsonObject, version: Int = 1) {
        val existing = dao.outboxFor(entity, id)
        dao.enqueue(
            OutboxEntity(
                seq = 0,
                entity = entity,
                recordId = id,
                clientVersion = version,
                payload = AppJson.encodeToString(JsonObject.serializer(), data),
                createdAt = existing?.createdAt ?: System.currentTimeMillis(),
            ),
        )
    }

    private fun JsonObjectBuilder.location(fix: Fix?) {
        if (fix == null) return
        put("lat", fix.lat)
        put("lng", fix.lng)
        put("accuracy_m", fix.accuracy.toInt())
        put("location_at", Time.toIso(fix.time))
        put("is_mock", fix.isMock)
    }

    /** New order, or a new version of a pending one. Returns the order id. */
    suspend fun saveOrder(
        existing: OrderEntity?,
        shop: ShopEntity,
        lines: List<DraftLine>,
        discount: Long,
        note: String?,
        fix: Fix?,
        flags: List<String>,
        trail: List<Fix>,
    ): String {
        val id = existing?.id ?: Ulid.next()
        val version = (existing?.clientVersion ?: 0) + 1
        val number = existing?.number ?: session.nextOrderNumber()
        val orderedAt = existing?.orderedAt ?: System.currentTimeMillis()
        val oldLines = existing?.lines().orEmpty().associateBy { it.productId }
        val orderLines = lines.filter { it.qty > 0 }.map {
            OrderLine(oldLines[it.product.id]?.id ?: Ulid.next(), it.product.id, it.product.nameBn ?: it.product.name, it.product.packSize, it.qty, it.unitPrice)
        }
        val subtotal = orderLines.sumOf { it.lineTotal }
        val total = subtotal - discount

        val data = buildJsonObject {
            put("number", number)
            put("shop_id", shop.id)
            put("ordered_at", Time.toIso(orderedAt))
            put("discount", discount)
            note?.let { put("note", it) }
            put("device_id", session.current.deviceId)
            location(fix)
            put("items", buildJsonArray {
                orderLines.forEach { l ->
                    add(buildJsonObject {
                        put("id", l.id); put("product_id", l.productId); put("qty", l.qty); put("unit_price", l.unitPrice)
                    })
                }
            })
        }

        db.withTransaction {
            dao.upsertOrder(
                OrderEntity(
                    id = id, number = number, shopId = shop.id, shopName = shop.nameBn ?: shop.name, status = "pending",
                    orderedAt = orderedAt, subtotal = subtotal, discount = discount, total = total, paid = 0, note = note,
                    rejectReason = null, tripNumber = null,
                    itemsJson = AppJson.encodeToString(LinesSerializer, orderLines),
                    flags = AppJson.encodeToString(FlagsSerializer, flags),
                    lat = fix?.lat, lng = fix?.lng, accuracyM = fix?.accuracy?.toInt(),
                    clientVersion = version, sync = "pending", syncError = null,
                ),
            )
            queue("order", id, data, version)
            dao.touchShop(shop.id, orderedAt)
            if (trail.isNotEmpty()) queuePings(trail, "order", id)
        }
        return id
    }

    private suspend fun queuePings(points: List<Fix>, source: String, refId: String?) {
        queue("location_ping", Ulid.next(), buildJsonObject {
            put("pings", buildJsonArray {
                points.forEach { p ->
                    add(buildJsonObject {
                        put("source", source); refId?.let { put("ref_id", it) }
                        put("lat", p.lat); put("lng", p.lng); put("accuracy_m", p.accuracy.toInt())
                        put("is_mock", p.isMock); put("recorded_at", Time.toIso(p.time))
                    })
                }
            })
        })
    }

    suspend fun saveShop(
        name: String,
        nameBn: String?,
        ownerName: String?,
        phone: String?,
        category: String,
        routeId: String?,
        fix: Fix?,
    ): ShopEntity {
        val shop = ShopEntity(
            id = Ulid.next(), routeId = routeId, code = null, name = name, nameBn = nameBn, ownerName = ownerName,
            phone = phone, category = category, lat = fix?.lat, lng = fix?.lng, creditLimit = 0, due = 0,
            status = "pending_approval", lastOrderAt = null,
        )
        val data = buildJsonObject {
            put("name", name)
            nameBn?.let { put("name_bn", it) }
            ownerName?.let { put("owner_name", it) }
            phone?.let { put("phone", it) }
            put("category", category)
            routeId?.let { put("route_id", it) }
            put("device_id", session.current.deviceId)
            location(fix)
        }
        db.withTransaction {
            dao.upsertShops(listOf(shop))
            queue("shop", shop.id, data)
        }
        return shop
    }

    suspend fun saveVisit(shop: ShopEntity, reason: String, fix: Fix?) {
        val id = Ulid.next()
        val now = System.currentTimeMillis()
        db.withTransaction {
            dao.insertVisit(VisitEntity(id, shop.id, "no_order", reason, now))
            queue("visit", id, buildJsonObject {
                put("shop_id", shop.id)
                put("outcome", "no_order")
                put("no_order_reason", reason)
                put("checked_in_at", Time.toIso(now))
                location(fix)
            })
        }
    }

    /** Delivery man finished one stop: result + delivered quantities + money taken. */
    suspend fun saveDelivery(
        stop: StopEntity,
        result: String,
        delivered: Map<String, Int>,
        reason: String?,
        amount: Long,
        method: String,
        reference: String?,
        fix: Fix?,
    ) {
        val lines = stop.lines().map { it.copy(deliveredQty = if (result == "failed") 0 else delivered[it.id] ?: it.qty) }
        val value = lines.sumOf { (it.deliveredQty ?: 0) * it.unitPrice }
        val now = System.currentTimeMillis()

        db.withTransaction {
            dao.upsertStop(
                stop.copy(
                    localResult = result,
                    status = when (result) {
                        "failed" -> "failed"
                        "partial" -> "partially_delivered"
                        else -> "delivered"
                    },
                    total = if (result == "failed") stop.total else value,
                    localCollected = stop.localCollected + amount,
                    itemsJson = AppJson.encodeToString(LinesSerializer, lines),
                ),
            )
            queue("delivery", Ulid.next(), buildJsonObject {
                put("order_id", stop.orderId)
                put("result", result)
                reason?.let { put("reason", it) }
                put("at", Time.toIso(now))
                put("items", buildJsonArray {
                    lines.forEach { l -> add(buildJsonObject { put("id", l.id); put("delivered_qty", l.deliveredQty ?: 0) }) }
                })
                location(fix)
            })
            if (amount > 0) {
                queue("collection", Ulid.next(), buildJsonObject {
                    put("shop_id", stop.shopId)
                    put("order_id", stop.orderId)
                    put("method", method)
                    put("amount", amount)
                    reference?.let { put("reference", it) }
                    put("collected_at", Time.toIso(now))
                    put("device_id", session.current.deviceId)
                    fix?.let { put("lat", it.lat); put("lng", it.lng) }
                })
                if (method == "cash") dao.addTripCash(stop.tripId, amount)
            }
        }
    }

    suspend fun setTripStatus(tripId: String, status: String) {
        db.withTransaction {
            dao.setTripStatus(tripId, status)
            queue("trip_status", Ulid.next(), buildJsonObject { put("trip_id", tripId); put("status", status) })
        }
    }

    /** Throw away a record the server refused (or that the user no longer wants to send). */
    suspend fun discard(row: OutboxEntity) {
        db.withTransaction {
            dao.deleteOutbox(row.seq)
            when (row.entity) {
                "order" -> if (row.clientVersion <= 1) dao.deleteOrder(row.recordId)
                "shop" -> dao.deleteShops(listOf(row.recordId))
                "visit" -> dao.deleteVisit(row.recordId)
            }
        }
        // Re-read the office copy of orders and trips so the phone matches the server again.
        if (row.entity == "order") session.setCursor("orders", null)
    }

    suspend fun retry(row: OutboxEntity) {
        dao.retryOutbox(row.seq)
        if (row.entity == "order") dao.setOrderSync(row.recordId, "pending", null)
    }

    suspend fun wipe() = db.clearAllTables()
}
