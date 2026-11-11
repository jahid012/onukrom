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
import kotlinx.coroutines.Dispatchers
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
    val connectivity = Connectivity(context) { if (session.current.loggedIn) SyncWorker.syncSoon(context) }
    val hasMapKey = context.getString(R.string.mapbox_access_token).isNotBlank()

    fun syncSoon() = SyncWorker.syncSoon(context)

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
