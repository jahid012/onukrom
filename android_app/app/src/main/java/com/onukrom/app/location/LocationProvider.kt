package com.onukrom.app.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/** One GPS reading. `time` is when the phone measured it (epoch ms). */
data class Fix(val lat: Double, val lng: Double, val accuracy: Float, val time: Long, val isMock: Boolean) {
    val ageSec get() = ((System.currentTimeMillis() - time) / 1000).toInt()
}

private fun Location.toFix() = Fix(
    lat = latitude,
    lng = longitude,
    accuracy = if (hasAccuracy()) accuracy else 999f,
    time = time,
    isMock = if (Build.VERSION.SDK_INT >= 31) isMock else @Suppress("DEPRECATION") isFromMockProvider,
)

class LocationProvider(private val context: Context) {
    private val client = LocationServices.getFusedLocationProviderClient(context)

    fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    fun isGpsOn(): Boolean {
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return LocationManagerCompat.isLocationEnabled(lm)
    }

    /** Live high-accuracy fixes while the screen is open (the order "location session", spec §10.5). */
    @SuppressLint("MissingPermission")
    fun updates(intervalMs: Long = 3000): Flow<Fix> = callbackFlow {
        if (!hasPermission()) {
            close(); return@callbackFlow
        }
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(1000)
            .setWaitForAccurateLocation(false)
            .build()
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.locations.forEach { trySend(it.toFix()) }
            }
        }
        client.lastLocation.addOnSuccessListener { it?.let { loc -> trySend(loc.toFix()) } }
        client.requestLocationUpdates(request, callback, Looper.getMainLooper())
        awaitClose { client.removeLocationUpdates(callback) }
    }

    /** A single fix, for saving a shop visit or delivery. Null if none within the time limit. */
    @SuppressLint("MissingPermission")
    suspend fun current(timeoutMs: Long = 15000): Fix? {
        if (!hasPermission()) return null
        return withTimeoutOrNull(timeoutMs) {
            suspendCancellableCoroutine { cont ->
                client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
                    .addOnSuccessListener { cont.resume(it?.toFix()) }
                    .addOnFailureListener { cont.resume(null) }
            }
        }
    }
}

/**
 * Picks the fix to attach to an order: the newest fix that is accurate enough
 * and fresh enough; otherwise the most accurate one seen in this session.
 */
class FixPicker(private val maxAccuracy: Int, private val maxAgeSec: Int) {
    var best: Fix? = null
        private set
    val trail = mutableListOf<Fix>()
    private var lastTrailAt = 0L

    fun offer(fix: Fix, trailIntervalMs: Long = 30000) {
        val b = best
        best = when {
            b == null -> fix
            fix.accuracy <= maxAccuracy -> fix
            b.ageSec > maxAgeSec -> fix
            fix.accuracy < b.accuracy -> fix
            else -> b
        }
        if (fix.time - lastTrailAt >= trailIntervalMs) {
            trail += fix
            lastTrailAt = fix.time
            if (trail.size > 60) trail.removeAt(0)
        }
    }

    fun good(): Boolean = best?.let { it.accuracy <= maxAccuracy && it.ageSec <= maxAgeSec } == true
}
