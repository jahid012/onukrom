package com.onukrom.app.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.onukrom.app.BuildConfig
import com.onukrom.app.core.Time
import com.onukrom.app.data.api.AppJson
import com.onukrom.app.data.api.Me
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import java.util.UUID

private val Context.store by preferencesDataStore("session")

data class SessionState(
    val companyCode: String? = null,
    val companyName: String? = null,
    val apiBase: String = BuildConfig.API_BASE_URL,
    val token: String? = null,
    val me: Me? = null,
    val locale: String = "bn",
    val deviceId: String = "",
    val lastSyncAt: Long = 0,
    val expired: Boolean = false,
) {
    val loggedIn get() = token != null && me != null
}

/** Everything about "who is using this phone", kept in DataStore and mirrored in a StateFlow. */
class Session(private val context: Context) {
    private object K {
        val code = stringPreferencesKey("company_code")
        val name = stringPreferencesKey("company_name")
        val api = stringPreferencesKey("api_base")
        val token = stringPreferencesKey("token")
        val me = stringPreferencesKey("me")
        val locale = stringPreferencesKey("locale")
        val device = stringPreferencesKey("device_id")
        val lastSync = longPreferencesKey("last_sync")
        val orderSeq = stringPreferencesKey("order_seq")
        fun cursor(entity: String) = stringPreferencesKey("cursor_$entity")
    }

    private var prefs: Preferences = runBlocking { context.store.data.first() }
    private val _state = MutableStateFlow(read(prefs))
    val state: StateFlow<SessionState> = _state
    val current get() = _state.value

    init {
        if (current.deviceId.isEmpty()) runBlocking { edit { it[K.device] = UUID.randomUUID().toString() } }
    }

    private fun read(p: Preferences) = SessionState(
        companyCode = p[K.code],
        companyName = p[K.name],
        apiBase = p[K.api] ?: BuildConfig.API_BASE_URL,
        token = p[K.token],
        me = p[K.me]?.let { runCatching { AppJson.decodeFromString(Me.serializer(), it) }.getOrNull() },
        locale = p[K.locale] ?: "bn",
        deviceId = p[K.device] ?: "",
        lastSyncAt = p[K.lastSync] ?: 0,
    )

    private suspend fun edit(block: (androidx.datastore.preferences.core.MutablePreferences) -> Unit) {
        prefs = context.store.edit(block)
        _state.value = read(prefs).copy(expired = _state.value.expired)
    }

    suspend fun setCompany(code: String, name: String, apiBase: String) = edit {
        it[K.code] = code
        it[K.name] = name
        it[K.api] = apiBase.trimEnd('/') + "/"
    }

    suspend fun clearCompany() = edit {
        it.remove(K.code); it.remove(K.name); it.remove(K.api)
    }

    suspend fun signIn(me: Me) {
        _state.value = _state.value.copy(expired = false)
        edit {
            it[K.token] = me.token!!
            it[K.me] = AppJson.encodeToString(Me.serializer(), me.copy(token = null))
            it[K.name] = me.tenant.name
        }
    }

    suspend fun updateMe(me: Me) = edit {
        it[K.me] = AppJson.encodeToString(Me.serializer(), me.copy(token = null))
        it[K.name] = me.tenant.name
    }

    /** Token refused by the server: go back to login but keep unsent data. */
    suspend fun markExpired() {
        edit { it.remove(K.token) }
        _state.value = _state.value.copy(expired = true)
    }

    suspend fun signOut() = edit { p ->
        p.remove(K.token); p.remove(K.me); p.remove(K.lastSync); p.remove(K.orderSeq)
        listOf("shops", "products", "orders").forEach { p.remove(K.cursor(it)) }
    }

    suspend fun setLocale(locale: String) = edit { it[K.locale] = locale }

    suspend fun setLastSync(at: Long) = edit { it[K.lastSync] = at }

    fun cursor(entity: String): String? = prefs[K.cursor(entity)]

    suspend fun setCursor(entity: String, cursor: String?) = edit {
        if (cursor == null) it.remove(K.cursor(entity)) else it[K.cursor(entity)] = cursor
    }

    /** Order numbers made on the phone: SR07-261112-003. The server renumbers on a clash. */
    suspend fun nextOrderNumber(): String {
        val day = Time.dayKey()
        val (lastDay, lastN) = (prefs[K.orderSeq] ?: "").split(":").let { (it.getOrNull(0) ?: "") to (it.getOrNull(1)?.toIntOrNull() ?: 0) }
        val n = if (lastDay == day) lastN + 1 else 1
        edit { it[K.orderSeq] = "$day:$n" }
        val code = current.me?.user?.employeeCode ?: "APP"
        return "$code-$day-" + n.toString().padStart(3, '0')
    }
}
