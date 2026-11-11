package com.onukrom.app.data.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

@Serializable
data class Envelope<T>(val data: T)

@Serializable
data class ApiErrorBody(val error: ApiErrorDetail)

@Serializable
data class ApiErrorDetail(val code: String, val message: String? = null)

@Serializable
data class TenantLookup(
    val code: String,
    val name: String,
    @SerialName("api_base_url") val apiBaseUrl: String,
    @SerialName("min_app_version") val minAppVersion: Int = 1,
)

@Serializable
data class DeviceInfo(
    @SerialName("device_id") val deviceId: String,
    val model: String,
    @SerialName("app_version") val appVersion: String,
)

@Serializable
data class LoginRequest(val phone: String, val password: String, val device: DeviceInfo)

@Serializable
data class MeUser(val id: Long, val name: String, val phone: String? = null, @SerialName("employee_code") val employeeCode: String? = null)

@Serializable
data class MeTenant(val code: String, val name: String, val phone: String? = null, val address: String? = null)

/** Company rules the app follows offline (spec §10.5, §16). */
@Serializable
data class TenantSettings(
    val autoApprove: Boolean = false,
    val creditMode: String = "warn",
    val maxDiscount: Double = 5.0,
    val blockOverStock: Boolean = false,
    val locationMode: String = "required",
    val maxAccuracy: Int = 50,
    val maxAge: Int = 60,
    val wait: Int = 20,
    val geofence: Int = 150,
    val blockMock: Boolean = false,
    val shopFromOrder: Boolean = true,
    val dutyTracking: Boolean = false,
    val oneDevice: Boolean = true,
)

@Serializable
data class Me(
    val user: MeUser,
    val tenant: MeTenant,
    val roles: List<String> = emptyList(),
    val permissions: List<String> = emptyList(),
    @SerialName("route_ids") val routeIds: List<String> = emptyList(),
    val settings: TenantSettings = TenantSettings(),
    val token: String? = null,
) {
    fun can(permission: String) = permission in permissions
    val isSales get() = can("app.sales")
    val isDelivery get() = can("app.delivery")
}

@Serializable
data class PasswordRequest(@SerialName("current_password") val current: String, @SerialName("new_password") val new: String)

@Serializable
data class PullPage(
    val entity: String,
    val mode: String,
    val items: List<JsonObject>,
    @SerialName("next_cursor") val nextCursor: String? = null,
    @SerialName("has_more") val hasMore: Boolean = false,
)

@Serializable
data class PushOperation(
    val entity: String,
    val op: String = "upsert",
    val id: String,
    @SerialName("client_version") val clientVersion: Int = 1,
    val data: JsonElement,
)

@Serializable
data class PushRequest(val operations: List<PushOperation>)

@Serializable
data class PushResult(
    val entity: String,
    val id: String,
    val result: String,
    val error: ApiErrorDetail? = null,
    val server: JsonElement? = null,
)

@Serializable
data class PushResponse(val results: List<PushResult>)

/* ---- pulled records ---- */

@Serializable
data class RouteDto(val id: String, val name: String, val code: String? = null, @SerialName("visit_days") val visitDays: List<String> = emptyList())

@Serializable
data class CategoryDto(val id: String, val key: String? = null, val name: String, @SerialName("name_bn") val nameBn: String? = null, val sort: Int = 0)

@Serializable
data class PriceListDto(
    val id: String,
    @SerialName("applies_to") val appliesTo: String,
    val target: String? = null,
    val items: List<PriceItemDto> = emptyList(),
)

@Serializable
data class PriceItemDto(@SerialName("product_id") val productId: String, @SerialName("unit_price") val unitPrice: Long)

@Serializable
data class StockDto(@SerialName("product_id") val productId: String, val available: Int)

@Serializable
data class ShopDto(
    val id: String,
    val deleted: Boolean = false,
    @SerialName("route_id") val routeId: String? = null,
    val code: String? = null,
    val name: String,
    @SerialName("name_bn") val nameBn: String? = null,
    @SerialName("owner_name") val ownerName: String? = null,
    val phone: String? = null,
    val category: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    @SerialName("credit_limit") val creditLimit: Long = 0,
    val due: Long = 0,
    val status: String = "active",
    @SerialName("last_order_at") val lastOrderAt: String? = null,
)

@Serializable
data class ProductDto(
    val id: String,
    val deleted: Boolean = false,
    @SerialName("category_id") val categoryId: String? = null,
    val sku: String? = null,
    val name: String,
    @SerialName("name_bn") val nameBn: String? = null,
    val brand: String? = null,
    @SerialName("pack_size") val packSize: Int = 1,
    val mrp: Long = 0,
    val price: Long = 0,
    val active: Boolean = true,
)

@Serializable
data class OrderItemDto(
    val id: String,
    @SerialName("product_id") val productId: String,
    val qty: Int,
    @SerialName("unit_price") val unitPrice: Long,
    val discount: Long = 0,
    @SerialName("line_total") val lineTotal: Long = 0,
    @SerialName("delivered_qty") val deliveredQty: Int? = null,
)

@Serializable
data class TripShopDto(
    val id: String,
    val name: String,
    @SerialName("name_bn") val nameBn: String? = null,
    @SerialName("owner_name") val ownerName: String? = null,
    val phone: String? = null,
    val lat: Double? = null,
    val lng: Double? = null,
    val due: Long = 0,
)

@Serializable
data class OrderDto(
    val id: String,
    val deleted: Boolean = false,
    val number: String,
    @SerialName("shop_id") val shopId: String,
    val status: String,
    @SerialName("ordered_at") val orderedAt: String,
    val subtotal: Long = 0,
    val discount: Long = 0,
    val total: Long = 0,
    val paid: Long = 0,
    val note: String? = null,
    @SerialName("reject_reason") val rejectReason: String? = null,
    @SerialName("trip_number") val tripNumber: String? = null,
    val items: List<OrderItemDto> = emptyList(),
    val shop: TripShopDto? = null,
)

@Serializable
data class TripDto(
    val id: String,
    val number: String,
    val route: String? = null,
    val vehicle: String? = null,
    val status: String,
    @SerialName("cash_collected") val cashCollected: Long = 0,
    val orders: List<OrderDto> = emptyList(),
)
