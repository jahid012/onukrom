package com.onukrom.app

import android.app.Application
import android.content.Context
import android.os.Build
import androidx.compose.runtime.staticCompositionLocalOf
import com.mapbox.common.MapboxOptions
import com.onukrom.app.data.Repository
import com.onukrom.app.data.Session
import com.onukrom.app.data.api.ApiClient
import com.onukrom.app.data.api.ApiException
import com.onukrom.app.data.api.DeviceInfo
import com.onukrom.app.data.api.LoginRequest
import com.onukrom.app.data.api.TenantLookup
import com.onukrom.app.data.db.AppDatabase
import com.onukrom.app.location.LocationProvider
import com.onukrom.app.sync.Connectivity
import com.onukrom.app.sync.SyncEngine
import com.onukrom.app.sync.SyncWorker
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class OnukromApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        getString(R.string.mapbox_access_token).takeIf { it.isNotBlank() }?.let { MapboxOptions.accessToken = it }
        if (container.session.current.loggedIn) SyncWorker.schedulePeriodic(this)
    }
}

/** Hand-wired dependencies — small app, no DI framework needed. */
class AppContainer(private val context: Context) {
    val session = Session(context)
    val db = AppDatabase.create(context)
    val api = ApiClient(
        baseUrl = { session.current.apiBase },
        token = { session.current.token },
        tenant = { session.current.companyCode },
        deviceId = { session.current.deviceId },
    )
    val repo = Repository(db, session)
    val sync = SyncEngine(db, api, session)
    val location = LocationProvider(context)

    // Declared before `connectivity`: its callback can fire as soon as it is registered.
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val kicks = Channel<Unit>(Channel.CONFLATED)

    val connectivity = Connectivity(context) { syncSoon() }
    val hasMapKey = context.getString(R.string.mapbox_access_token).isNotBlank()

    init {
        // One loop does every sync the app asks for. Requests that arrive
        // while a sync runs merge into a single follow-up sync.
        scope.launch {
            for (kick in kicks) {
                delay(1_500) // a burst of saves (order + location trail) goes in one sync
                if (!session.current.loggedIn) continue
                if (!connectivity.online.value) {
                    SyncWorker.syncSoon(context) // WorkManager waits for the network
                    continue
                }
                try {
                    sync.run()
                } catch (e: CancellationException) {
                    throw e
                } catch (_: Exception) {
                    SyncWorker.syncSoon(context) // retried with back-off
                }
            }
        }
        // Anything new waiting to be sent (order, shop, visit, delivery, trip
        // status, a retry) → send it at once, no matter which screen saved it.
        scope.launch {
            var known: Set<Long>? = null
            db.dao().outbox()
                .map { rows -> rows.filter { it.state == "pending" }.map { it.seq }.toSet() }
                .distinctUntilChanged()
                .collect { now ->
                    val before = known
                    if (before != null && (now - before).isNotEmpty()) syncSoon()
                    known = now
                }
        }
    }

    /** Send and fetch now when online; when offline it goes as soon as the net is back. */
    fun syncSoon() {
        if (session.current.loggedIn) kicks.trySend(Unit)
    }

    suspend fun lookup(code: String): TenantLookup {
        val tenant = api.lookup(code.trim().lowercase())
        session.setCompany(tenant.code, tenant.name, tenant.apiBaseUrl)
        return tenant
    }

    suspend fun login(phone: String, password: String) {
        val previousUser = session.current.me?.user?.id
        val me = api.login(
            LoginRequest(
                phone = phone,
                password = password,
                device = DeviceInfo(session.current.deviceId, "${Build.MANUFACTURER} ${Build.MODEL}".take(100), BuildConfig.VERSION_NAME),
            ),
        )
        // A different person on this phone: start with a clean copy of the data.
        if (previousUser != null && previousUser != me.user.id) {
            withContext(Dispatchers.IO) { repo.wipe() }
            session.signOut()
        }
        session.signIn(me)
        SyncWorker.schedulePeriodic(context)
        runCatching { sync.run() } // first download; if it fails the worker will retry
    }

    suspend fun changePassword(current: String, new: String) = api.changePassword(current, new)

    suspend fun logout() {
        try {
            api.logout()
        } catch (_: ApiException) {
            // offline — the token is dropped on this phone anyway
        }
        SyncWorker.cancelAll(context)
        withContext(Dispatchers.IO) { repo.wipe() }
        session.signOut()
    }
}

val LocalContainer = staticCompositionLocalOf<AppContainer> { error("No container") }
