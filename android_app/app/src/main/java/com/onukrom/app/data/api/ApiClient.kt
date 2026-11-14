package com.onukrom.app.data.api

import com.onukrom.app.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/** A failed API call. `code` is the server error code, "NETWORK" for no connection, "SERVER" otherwise. */
class ApiException(val code: String, message: String?, val status: Int = 0) : Exception(message) {
    val isNetwork get() = code == "NETWORK"
    val isUnauthorized get() = status == 401
}

val AppJson = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    explicitNulls = false
    encodeDefaults = true
    isLenient = true
}

/**
 * Small JSON client over OkHttp. `baseUrl`, `token`, `tenant` and `deviceId`
 * are read on every call so a fresh login takes effect immediately.
 */
class ApiClient(
    private val baseUrl: () -> String,
    private val token: () -> String?,
    private val tenant: () -> String?,
    private val deviceId: () -> String,
) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(45, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val jsonType = "application/json; charset=utf-8".toMediaType()

    private suspend fun <T> call(
        method: String,
        path: String,
        serializer: KSerializer<T>,
        body: String? = null,
        query: Map<String, String?> = emptyMap(),
        base: String = baseUrl(),
    ): T = withContext(Dispatchers.IO) {
        val url = (base.trimEnd('/') + "/" + path.trimStart('/')).toHttpUrl().newBuilder().apply {
            query.forEach { (k, v) -> if (v != null) addQueryParameter(k, v) }
        }.build()

        val request = Request.Builder().url(url)
            .header("Accept", "application/json")
            .header("X-Device-Id", deviceId())
            .header("X-App-Version", BuildConfig.VERSION_NAME)
            .apply {
                tenant()?.let { header("X-Tenant", it) }
                token()?.let { header("Authorization", "Bearer $it") }
                when (method) {
                    "GET" -> get()
                    else -> method(method, (body ?: "{}").toRequestBody(jsonType))
                }
            }
            .build()

        val response = try {
            http.newCall(request).execute()
        } catch (e: IOException) {
            throw ApiException("NETWORK", e.message)
        }

        response.use { res ->
            val text = res.body.string()
            if (!res.isSuccessful) {
                // Path and server answer only: never the token or the body we sent.
                android.util.Log.w("OnukromApi", "${request.method} ${request.url.encodedPath}?${request.url.encodedQuery.orEmpty()} → ${res.code} ${text.take(300)}")
                val err = runCatching { AppJson.decodeFromString(ApiErrorBody.serializer(), text).error }.getOrNull()
                throw ApiException(err?.code ?: if (res.code == 401) "UNAUTHENTICATED" else "SERVER", err?.message ?: "HTTP ${res.code} ${request.url.encodedPath}", res.code)
            }
            try {
                AppJson.decodeFromString(Envelope.serializer(serializer), text).data
            } catch (e: Exception) {
                throw ApiException("SERVER", e.message, res.code)
            }
        }
    }

    /** Lookup always goes to the app's home server (it tells us the company's API address). */
    suspend fun lookup(code: String): TenantLookup =
        call("GET", "tenants/lookup", TenantLookup.serializer(), query = mapOf("code" to code), base = BuildConfig.API_BASE_URL)

    suspend fun login(req: LoginRequest): Me =
        call("POST", "auth/login", Me.serializer(), AppJson.encodeToString(LoginRequest.serializer(), req))

    suspend fun me(): Me = call("GET", "me", Me.serializer())

    suspend fun changePassword(current: String, new: String) {
        call("POST", "auth/password", kotlinx.serialization.json.JsonObject.serializer(), AppJson.encodeToString(PasswordRequest.serializer(), PasswordRequest(current, new)))
    }

    suspend fun logout() {
        call("POST", "auth/logout", kotlinx.serialization.json.JsonObject.serializer())
    }

    suspend fun pull(entity: String, cursor: String?, limit: Int = 500, overlap: Boolean = false): PullPage =
        call(
            "GET", "sync/pull", PullPage.serializer(),
            query = mapOf("entity" to entity, "cursor" to cursor, "limit" to limit.toString(), "overlap" to if (overlap) "1" else null),
        )

    suspend fun push(ops: List<PushOperation>): PushResponse =
        call("POST", "sync/push", PushResponse.serializer(), AppJson.encodeToString(PushRequest.serializer(), PushRequest(ops)))
}
