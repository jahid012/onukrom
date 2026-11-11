package com.onukrom.app.ui.screens

import android.Manifest
import android.content.Intent
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GpsFixed
import androidx.compose.material.icons.filled.GpsNotFixed
import androidx.compose.material.icons.filled.GpsOff
import androidx.compose.material.icons.filled.LocationDisabled
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.onukrom.app.LocalContainer
import com.onukrom.app.core.Geo
import com.onukrom.app.data.db.ShopEntity
import com.onukrom.app.i18n.LocalStrings
import com.onukrom.app.location.Fix
import com.onukrom.app.location.FixPicker
import com.onukrom.app.ui.components.FlatCard
import com.onukrom.app.ui.components.Tone
import com.onukrom.app.ui.theme.C
import kotlinx.coroutines.delay

@Stable
class LiveLocation(val maxAccuracy: Int, maxAgeSec: Int) {
    val picker = FixPicker(maxAccuracy, maxAgeSec)
    var fix by mutableStateOf<Fix?>(null)
    var permission by mutableStateOf(false)
    var gpsOn by mutableStateOf(true)
    var waitedSec by mutableIntStateOf(0)
    var ask: () -> Unit = {}
    val good get() = picker.good()
}

/**
 * Starts the GPS as soon as the screen opens so a good fix is ready by the
 * time the user taps Save (spec §10.5 "location session").
 */
@Composable
fun rememberLiveLocation(maxAccuracy: Int, maxAgeSec: Int, trailIntervalSec: Int = 30): LiveLocation {
    val c = LocalContainer.current
    val state = remember { LiveLocation(maxAccuracy, maxAgeSec) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        state.permission = c.location.hasPermission()
    }
    LaunchedEffect(Unit) {
        state.permission = c.location.hasPermission()
        if (!state.permission) {
            launcher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        }
    }
    LaunchedEffect(Unit) {
        while (true) {
            state.gpsOn = c.location.isGpsOn()
            state.permission = c.location.hasPermission()
            delay(2000)
            state.waitedSec += 2
        }
    }
    LaunchedEffect(state.permission, state.gpsOn) {
        if (state.permission && state.gpsOn) {
            c.location.updates().collect {
                state.picker.offer(it, trailIntervalSec * 1000L)
                state.fix = state.picker.best
            }
        }
    }
    // Lets the card's "Allow" button ask again.
    state.ask = { launcher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) }
    return state
}

/** One card that tells the user exactly what is happening with GPS. */
@Composable
fun LocationCard(loc: LiveLocation, shop: ShopEntity? = null) {
    val s = LocalStrings.current
    val context = LocalContext.current
    val fix = loc.fix
    val distance = if (fix != null && shop?.lat != null && shop.lng != null) Geo.distanceM(fix.lat, fix.lng, shop.lat, shop.lng) else null
    val geofence = LocalContainer.current.session.current.me?.settings?.geofence ?: 150

    data class View(val tone: Tone, val icon: androidx.compose.ui.graphics.vector.ImageVector, val title: String, val detail: String?, val action: Pair<String, () -> Unit>?)

    val v = when {
        !loc.permission -> View(Tone.Danger, Icons.Default.LocationDisabled, s.permissionNeeded, null, s.grant to loc.ask)
        !loc.gpsOn -> View(Tone.Danger, Icons.Default.GpsOff, s.gpsOff, null, s.turnOnGps to {
            context.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
        })
        fix == null -> View(Tone.Info, Icons.Default.GpsNotFixed, s.gpsSearching, null, null)
        fix.isMock -> View(Tone.Danger, Icons.Default.Warning, s.mockDetected, s.accuracy(fix.accuracy.toInt()), null)
        !loc.good -> View(Tone.Warning, Icons.Default.GpsNotFixed, s.gpsWeak(fix.accuracy.toInt()), distance?.let { s.fromShop(it) }, null)
        distance != null && distance > geofence -> View(Tone.Warning, Icons.Default.Warning, s.farFromShop, s.fromShop(distance) + " · " + s.accuracy(fix.accuracy.toInt()), null)
        else -> View(Tone.Success, Icons.Default.GpsFixed, s.gpsGood, listOfNotNull(s.accuracy(fix.accuracy.toInt()), distance?.let { s.fromShop(it) }).joinToString(" · "), null)
    }

    FlatCard(color = v.tone.bg, border = v.tone.bg, padding = 12.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (v.tone == Tone.Info) {
                CircularProgressIndicator(Modifier.size(20.dp), color = v.tone.fg, strokeWidth = 2.dp)
            } else {
                Icon(v.icon, null, tint = v.tone.fg, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(v.title, color = v.tone.fg, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodyMedium)
                if (v.detail != null) Text(v.detail, color = v.tone.fg.copy(alpha = .85f), style = MaterialTheme.typography.bodySmall)
            }
            v.action?.let { (label, onClick) -> TextButton(onClick = onClick) { Text(label, color = v.tone.fg) } }
        }
    }
}
