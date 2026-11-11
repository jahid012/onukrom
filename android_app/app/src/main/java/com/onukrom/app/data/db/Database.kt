package com.onukrom.app.data.db

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.Serializable

/* -------------------------------------------------------------------------
 * The phone keeps its own copy of everything the staff need, so the app
 * works with no internet. Records made on the phone go to `outbox` and are
 * sent by the sync worker when the network comes back.
 * ---------------------------------------------------------------------- */

@Entity(tableName = "routes")
data class RouteEntity(@PrimaryKey val id: String, val name: String, val code: String?, val visitDays: String)

@Entity(tableName = "categories")
data class CategoryEntity(@PrimaryKey val id: String, val name: String, val nameBn: String?, val sort: Int)

@Entity(tableName = "products")
data class ProductEntity(
    @PrimaryKey val id: String,
    val categoryId: String?,
    val sku: String?,
    val name: String,
    val nameBn: String?,
    val brand: String?,
    val packSize: Int,
    val mrp: Long,
    val price: Long,
    val active: Boolean,
)

@Entity(tableName = "price_items", primaryKeys = ["listId", "productId"])
data class PriceItemEntity(val listId: String, val appliesTo: String, val target: String?, val productId: String, val unitPrice: Long)

@Entity(tableName = "stock")
data class StockEntity(@PrimaryKey val productId: String, val available: Int)

@Entity(tableName = "shops", indices = [Index("routeId")])
data class ShopEntity(
    @PrimaryKey val id: String,
    val routeId: String?,
    val code: String?,
    val name: String,
    val nameBn: String?,
    val ownerName: String?,
    val phone: String?,
    val category: String?,
    val lat: Double?,
    val lng: Double?,
    val creditLimit: Long,
    val due: Long,
    val status: String,
    val lastOrderAt: Long?,
)

@Serializable
data class OrderLine(
    val id: String,
    val productId: String,
    val name: String,
    val packSize: Int = 1,
    val qty: Int,
    val unitPrice: Long,
    val deliveredQty: Int? = null,
) {
    val lineTotal get() = qty * unitPrice
}

/** sync: "pending" (in outbox) | "synced" | "rejected" (server refused; see syncError). */
@Entity(tableName = "orders", indices = [Index("shopId"), Index("orderedAt")])
data class OrderEntity(
    @PrimaryKey val id: String,
    val number: String,
    val shopId: String,
    val shopName: String,
    val status: String,
    val orderedAt: Long,
    val subtotal: Long,
    val discount: Long,
    val total: Long,
    val paid: Long,
    val note: String?,
    val rejectReason: String?,
    val tripNumber: String?,
    val itemsJson: String,
    val flags: String,
    val lat: Double?,
    val lng: Double?,
    val accuracyM: Int?,
    val clientVersion: Int,
    val sync: String,
    val syncError: String?,
)

@Entity(tableName = "visits", indices = [Index("at")])
data class VisitEntity(@PrimaryKey val id: String, val shopId: String, val outcome: String, val reason: String?, val at: Long)

@Entity(tableName = "trips")
data class TripEntity(
    @PrimaryKey val id: String,
    val number: String,
    val route: String?,
    val vehicle: String?,
    val status: String,
    val cashCollected: Long,
)

/** One order on a delivery man's trip. `localResult` is set when delivered on the phone but not yet synced. */
@Entity(tableName = "stops", indices = [Index("tripId")])
data class StopEntity(
    @PrimaryKey val orderId: String,
    val tripId: String,
    val sort: Int,
    val number: String,
    val shopId: String,
    val shopName: String,
    val shopNameBn: String?,
    val ownerName: String?,
    val phone: String?,
    val lat: Double?,
    val lng: Double?,
    val shopDue: Long,
    val status: String,
    val total: Long,
    val paid: Long,
    val itemsJson: String,
    val localResult: String?,
    val localCollected: Long,
)

/** state: "pending" | "rejected". One row per record; editing a pending record replaces its row. */
@Entity(tableName = "outbox", indices = [Index(value = ["entity", "recordId"], unique = true)])
data class OutboxEntity(
    @PrimaryKey(autoGenerate = true) val seq: Long = 0,
    val entity: String,
    val recordId: String,
    val clientVersion: Int = 1,
    val payload: String,
    val state: String = "pending",
    val errorCode: String? = null,
    val errorMessage: String? = null,
    val attempts: Int = 0,
    val createdAt: Long = System.currentTimeMillis(),
)

@Dao
interface AppDao {
    // ---- reference data (replaced in full on every pull) ----
    @Query("SELECT * FROM routes ORDER BY name") fun routes(): Flow<List<RouteEntity>>
    @Query("SELECT * FROM routes") suspend fun routesNow(): List<RouteEntity>
    @Query("SELECT * FROM categories ORDER BY sort, name") fun categories(): Flow<List<CategoryEntity>>
    @Query("SELECT * FROM price_items") fun priceItems(): Flow<List<PriceItemEntity>>
    @Query("SELECT * FROM stock") fun stock(): Flow<List<StockEntity>>

    @Query("DELETE FROM routes") suspend fun clearRoutes()
    @Query("DELETE FROM categories") suspend fun clearCategories()
    @Query("DELETE FROM price_items") suspend fun clearPriceItems()
    @Query("DELETE FROM stock") suspend fun clearStock()
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertRoutes(rows: List<RouteEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertCategories(rows: List<CategoryEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertPriceItems(rows: List<PriceItemEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertStock(rows: List<StockEntity>)

    @Transaction
    suspend fun replaceReference(routes: List<RouteEntity>?, categories: List<CategoryEntity>?, prices: List<PriceItemEntity>?, stock: List<StockEntity>?) {
        routes?.let { clearRoutes(); insertRoutes(it) }
        categories?.let { clearCategories(); insertCategories(it) }
        prices?.let { clearPriceItems(); insertPriceItems(it) }
        stock?.let { clearStock(); insertStock(it) }
    }

    // ---- products ----
    @Query("SELECT * FROM products WHERE active = 1 ORDER BY name") fun products(): Flow<List<ProductEntity>>
    @Query("SELECT * FROM products") suspend fun productsNow(): List<ProductEntity>
    @Upsert suspend fun upsertProducts(rows: List<ProductEntity>)
    @Query("DELETE FROM products WHERE id IN (:ids)") suspend fun deleteProducts(ids: List<String>)

    // ---- shops ----
    @Query("SELECT * FROM shops WHERE status != 'inactive' ORDER BY name") fun shops(): Flow<List<ShopEntity>>
    @Query("SELECT * FROM shops WHERE id = :id") fun shop(id: String): Flow<ShopEntity?>
    @Query("SELECT * FROM shops WHERE id = :id") suspend fun shopNow(id: String): ShopEntity?
    @Query("SELECT * FROM shops") suspend fun shopsNow(): List<ShopEntity>
    @Upsert suspend fun upsertShops(rows: List<ShopEntity>)
    @Query("DELETE FROM shops WHERE id IN (:ids)") suspend fun deleteShops(ids: List<String>)
    @Query("UPDATE shops SET status = :status, code = COALESCE(:code, code) WHERE id = :id") suspend fun updateShopStatus(id: String, status: String, code: String?)
    @Query("UPDATE shops SET lastOrderAt = :at WHERE id = :id") suspend fun touchShop(id: String, at: Long)

    // ---- orders ----
    @Query("SELECT * FROM orders ORDER BY orderedAt DESC") fun orders(): Flow<List<OrderEntity>>
    @Query("SELECT * FROM orders WHERE id = :id") fun order(id: String): Flow<OrderEntity?>
    @Query("SELECT * FROM orders WHERE id = :id") suspend fun orderNow(id: String): OrderEntity?
    @Query("SELECT * FROM orders WHERE shopId = :shopId ORDER BY orderedAt DESC LIMIT 1") suspend fun lastOrderFor(shopId: String): OrderEntity?
    @Query("SELECT * FROM orders WHERE shopId = :shopId ORDER BY orderedAt DESC LIMIT 5") fun recentOrdersFor(shopId: String): Flow<List<OrderEntity>>
    @Upsert suspend fun upsertOrder(row: OrderEntity)
    @Upsert suspend fun upsertOrders(rows: List<OrderEntity>)
    @Query("DELETE FROM orders WHERE id = :id") suspend fun deleteOrder(id: String)
    @Query("UPDATE orders SET sync = :sync, syncError = :error WHERE id = :id") suspend fun setOrderSync(id: String, sync: String, error: String?)
    @Query("UPDATE orders SET sync = 'synced', syncError = NULL, status = :status, number = :number, total = :total, flags = :flags WHERE id = :id AND clientVersion = :version")
    suspend fun orderAccepted(id: String, version: Int, status: String, number: String, total: Long, flags: String)

    // ---- visits ----
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertVisit(row: VisitEntity)
    @Query("SELECT COUNT(*) FROM visits WHERE at >= :since") fun visitsSince(since: Long): Flow<Int>
    @Query("DELETE FROM visits WHERE at < :before") suspend fun pruneVisits(before: Long)
    @Query("DELETE FROM visits WHERE id = :id") suspend fun deleteVisit(id: String)

    // ---- trips (delivery man) ----
    @Query("SELECT * FROM trips ORDER BY number DESC") fun trips(): Flow<List<TripEntity>>
    @Query("SELECT * FROM trips WHERE id = :id") fun trip(id: String): Flow<TripEntity?>
    @Query("SELECT * FROM stops ORDER BY sort") fun allStops(): Flow<List<StopEntity>>
    @Query("SELECT * FROM stops WHERE tripId = :tripId ORDER BY sort") fun stops(tripId: String): Flow<List<StopEntity>>
    @Query("SELECT * FROM stops WHERE orderId = :orderId") fun stop(orderId: String): Flow<StopEntity?>
    @Query("SELECT * FROM stops") suspend fun stopsNow(): List<StopEntity>
    @Query("UPDATE trips SET status = :status WHERE id = :id") suspend fun setTripStatus(id: String, status: String)
    @Query("UPDATE trips SET cashCollected = cashCollected + :amount WHERE id = :id") suspend fun addTripCash(id: String, amount: Long)
    @Upsert suspend fun upsertStop(row: StopEntity)
    @Query("DELETE FROM trips") suspend fun clearTrips()
    @Query("DELETE FROM stops") suspend fun clearStops()
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertTrips(rows: List<TripEntity>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun insertStops(rows: List<StopEntity>)

    @Transaction
    suspend fun replaceTrips(trips: List<TripEntity>, stops: List<StopEntity>) {
        clearTrips(); clearStops(); insertTrips(trips); insertStops(stops)
    }

    // ---- outbox ----
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun enqueue(row: OutboxEntity): Long
    @Query("SELECT * FROM outbox WHERE state = 'pending' ORDER BY seq LIMIT :limit") suspend fun pendingOutbox(limit: Int): List<OutboxEntity>
    @Query("SELECT * FROM outbox ORDER BY seq") fun outbox(): Flow<List<OutboxEntity>>
    @Query("SELECT * FROM outbox WHERE entity = :entity AND recordId = :id") suspend fun outboxFor(entity: String, id: String): OutboxEntity?
    @Query("SELECT recordId FROM outbox WHERE entity = :entity") suspend fun outboxIds(entity: String): List<String>
    @Query("SELECT COUNT(*) FROM outbox") suspend fun outboxCount(): Int
    @Query("DELETE FROM outbox WHERE seq = :seq") suspend fun deleteOutbox(seq: Long)
    @Query("UPDATE outbox SET state = 'rejected', errorCode = :code, errorMessage = :message WHERE seq = :seq") suspend fun rejectOutbox(seq: Long, code: String?, message: String?)
    @Query("UPDATE outbox SET attempts = attempts + 1, errorCode = :code WHERE seq = :seq") suspend fun bumpOutbox(seq: Long, code: String?)
    @Query("UPDATE outbox SET state = 'pending', attempts = 0, errorCode = NULL, errorMessage = NULL WHERE seq = :seq") suspend fun retryOutbox(seq: Long)
}

@Database(
    entities = [
        RouteEntity::class, CategoryEntity::class, ProductEntity::class, PriceItemEntity::class, StockEntity::class,
        ShopEntity::class, OrderEntity::class, VisitEntity::class, TripEntity::class, StopEntity::class, OutboxEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun dao(): AppDao

    companion object {
        fun create(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, "onukrom.db").build()
    }
}
