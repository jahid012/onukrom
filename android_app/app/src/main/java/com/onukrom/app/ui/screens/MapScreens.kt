package com.onukrom.app.ui.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Directions
import androidx.compose.material.icons.filled.Map
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.mapbox.geojson.Point
import com.mapbox.maps.extension.compose.MapEffect
import com.mapbox.maps.extension.compose.MapboxMap
import com.mapbox.maps.extension.compose.animation.viewport.rememberMapViewportState
import com.mapbox.maps.extension.compose.annotation.generated.CircleAnnotation
import com.mapbox.maps.plugin.locationcomponent.createDefault2DPuck
import com.mapbox.maps.plugin.locationcomponent.location
import com.onukrom.app.LocalContainer
import com.onukrom.app.data.db.ShopEntity
import com.onukrom.app.i18n.LocalStrings
import com.onukrom.app.ui.Routes
import com.onukrom.app.ui.components.BigButton
import com.onukrom.app.ui.components.Empty
import com.onukrom.app.ui.components.FlatCard
import com.onukrom.app.ui.components.OutlineButton
import com.onukrom.app.ui.components.Screen
import com.onukrom.app.ui.theme.C
import kotlin.math.abs
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min

data class Pin(val id: String, val lat: Double, val lng: Double, val title: String, val subtitle: String, val color: Color)

private fun cameraFor(pins: List<Pin>): Pair<Point, Double> {
    if (pins.isEmpty()) return Point.fromLngLat(90.4125, 23.8103) to 11.0 // Dhaka
    val minLat = pins.minOf { it.lat }
    val maxLat = pins.maxOf { it.lat }
    val minLng = pins.minOf { it.lng }
    val maxLng = pins.maxOf { it.lng }
    val span = max(abs(maxLat - minLat), abs(maxLng - minLng)).coerceAtLeast(0.002)
    val zoom = min(16.0, ln(360.0 / span) / ln(2.0) - 1.2)
    return Point.fromLngLat((minLng + maxLng) / 2, (minLat + maxLat) / 2) to zoom
}

/** Mapbox map with round pins and the user's own position. */
@Composable
fun PinMap(pins: List<Pin>, modifier: Modifier = Modifier, onPin: (Pin) -> Unit = {}) {
    val c = LocalContainer.current
    val (center, zoom) = remember(pins.map { it.id }) { cameraFor(pins) }
    val viewport = rememberMapViewportState {
        setCameraOptions {
            center(center)
            zoom(zoom)
        }
    }
    MapboxMap(modifier, mapViewportState = viewport) {
        if (c.location.hasPermission()) {
            MapEffect(Unit) { view ->
                view.location.updateSettings {
                    locationPuck = createDefault2DPuck(withBearing = false)
                    enabled = true
                }
            }
        }
        pins.forEach { p ->
            CircleAnnotation(point = Point.fromLngLat(p.lng, p.lat)) {
                circleRadius = 9.0
                circleColor = p.color
                circleStrokeWidth = 2.5
                circleStrokeColor = Color.White
                interactionsState.onClicked {
                    onPin(p)
                    true
                }
            }
        }
    }
}

@Composable
fun ShopMiniMap(shop: ShopEntity) {
    val s = LocalStrings.current
    val pins = remember(shop.id) { listOf(Pin(shop.id, shop.lat!!, shop.lng!!, shop.display(s), "", C.Primary)) }
    Box(Modifier.fillMaxWidth().height(180.dp).clip(RoundedCornerShape(12.dp))) {
        PinMap(pins, Modifier.fillMaxSize())
    }
}

/** Shops on a map (sales rep) or the stops of one trip (delivery man). */
@Composable
fun MapScreen(nav: NavHostController, tripId: String?) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val f = s.fmt
    val context = LocalContext.current
    val shops by c.repo.dao.shops().collectAsState(initial = emptyList())
    val stops by remember(tripId) { c.repo.dao.stops(tripId ?: "") }.collectAsState(initial = emptyList())
    var selected by remember { mutableStateOf<Pin?>(null) }

    val pins = if (tripId != null) {
        stops.filter { it.lat != null && it.lng != null }.map {
            val done = it.status in listOf("delivered", "partially_delivered", "failed")
            Pin(it.orderId, it.lat!!, it.lng!!, if (s.bangla) it.shopNameBn ?: it.shopName else it.shopName,
                "${it.number} · ${f.money(it.total - it.paid)}", if (done) C.Faint else C.Primary)
        }
    } else {
        shops.filter { it.lat != null && it.lng != null }.map {
            Pin(it.id, it.lat!!, it.lng!!, it.display(s), listOfNotNull(it.ownerName, if (it.due > 0) "${s.due} ${f.money(it.due)}" else null).joinToString(" · "),
                if (it.due > 0) C.Warning else C.Primary)
        }
    }

    Screen(title = if (tripId != null) s.showOnMap else s.mapView, onBack = { nav.popBackStack() }) { pad ->
        Box(Modifier.padding(pad).fillMaxSize()) {
            if (!c.hasMapKey) {
                Empty(Icons.Default.Map, s.mapKeyMissing)
            } else {
                PinMap(pins, Modifier.fillMaxSize()) { selected = it }
            }
            selected?.let { p ->
                FlatCard(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(12.dp)) {
                    Text(p.title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (p.subtitle.isNotEmpty()) Text(p.subtitle, color = C.Muted, style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(10.dp))
                    Row {
                        OutlineButton(s.directions, { directions(context, p.lat, p.lng, p.title) }, Modifier.weight(1f), icon = Icons.Default.Directions)
                        Spacer(Modifier.width(10.dp))
                        BigButton(
                            if (tripId != null) s.deliver else s.takeOrder,
                            onClick = { nav.navigate(if (tripId != null) Routes.stop(p.id) else Routes.order(p.id)) },
                            modifier = Modifier.weight(1f).height(50.dp),
                        )
                    }
                }
            }
        }
    }
}
