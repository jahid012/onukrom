package com.onukrom.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.Directions
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Inventory
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.onukrom.app.LocalContainer
import com.onukrom.app.data.db.StopEntity
import com.onukrom.app.data.lines
import com.onukrom.app.i18n.LocalStrings
import com.onukrom.app.ui.Routes
import com.onukrom.app.ui.components.Badge
import com.onukrom.app.ui.components.BigButton
import com.onukrom.app.ui.components.BottomActionBar
import com.onukrom.app.ui.components.ChoiceList
import com.onukrom.app.ui.components.Chips
import com.onukrom.app.ui.components.Empty
import com.onukrom.app.ui.components.Field
import com.onukrom.app.ui.components.FlatCard
import com.onukrom.app.ui.components.KeyValue
import com.onukrom.app.ui.components.Loading
import com.onukrom.app.ui.components.LocalSnackbar
import com.onukrom.app.ui.components.OutlineButton
import com.onukrom.app.ui.components.Screen
import com.onukrom.app.ui.components.SectionTitle
import com.onukrom.app.ui.components.Stepper
import com.onukrom.app.ui.components.SyncBar
import com.onukrom.app.ui.components.Tone
import com.onukrom.app.ui.components.orderTone
import com.onukrom.app.ui.theme.C
import kotlinx.coroutines.launch

private val DONE = setOf("delivered", "partially_delivered", "failed")

private fun tripTone(status: String) = when (status) {
    "planned" -> Tone.Neutral
    "loaded" -> Tone.Info
    "in_progress" -> Tone.Primary
    else -> Tone.Success
}

@Composable
fun TripsScreen(nav: NavHostController) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val f = s.fmt
    val trips by c.repo.dao.trips().collectAsState(initial = null)
    val stops by c.repo.dao.allStops().collectAsState(initial = emptyList())
    val sync = rememberSyncUi()
    val scope = rememberCoroutineScope()

    Screen(title = s.myTrips) { pad ->
        LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item {
                SyncBar(sync.online, sync.running, sync.pending, sync.failed, sync.lastSyncAt,
                    onSync = { scope.launch { runCatching { c.sync.run() } } }, onOpen = { nav.navigate(Routes.SYNC) })
            }
            val list = trips
            when {
                list == null -> item { Loading() }
                list.isEmpty() -> item { Empty(Icons.Default.LocalShipping, s.noTrips) }
                else -> items(list, key = { it.id }) { t ->
                    val mine = stops.filter { it.tripId == t.id }
                    val done = mine.count { it.status in DONE }
                    FlatCard(onClick = { nav.navigate(Routes.trip(t.id)) }) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(t.number, style = MaterialTheme.typography.titleMedium)
                                Text(listOfNotNull(t.route, t.vehicle).joinToString(" · "), color = C.Muted, style = MaterialTheme.typography.bodySmall)
                            }
                            Badge(s.tripStatus[t.status] ?: t.status, tripTone(t.status))
                        }
                        Spacer(Modifier.height(10.dp))
                        Row {
                            Text("${f.num(done)}/${f.num(mine.size)} · ${s.ordersCount(mine.size)}", color = C.Muted, modifier = Modifier.weight(1f))
                            Text("${s.cashCollected}: ${f.money(t.cashCollected)}", fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TripScreen(nav: NavHostController, tripId: String) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val f = s.fmt
    val scope = rememberCoroutineScope()
    val trip by remember { c.repo.dao.trip(tripId) }.collectAsState(initial = null)
    val stops by remember { c.repo.dao.stops(tripId) }.collectAsState(initial = emptyList())
    val t = trip ?: run { Screen(s.myTrips, onBack = { nav.popBackStack() }) { Loading() }; return }

    val next = when (t.status) {
        "planned" -> "loaded" to s.markLoaded
        "loaded" -> "in_progress" to s.startTrip
        else -> null
    }
    val left = stops.filter { it.status !in DONE }

    Screen(
        title = t.number,
        subtitle = listOfNotNull(t.route, t.vehicle).joinToString(" · "),
        onBack = { nav.popBackStack() },
        actions = {
            if (c.hasMapKey) IconButton(onClick = { nav.navigate(Routes.tripMap(t.id)) }) { Icon(Icons.Default.Map, s.showOnMap) }
        },
        bottomBar = {
            if (next != null) BottomActionBar {
                BigButton(next.second, {
                    scope.launch { c.repo.setTripStatus(t.id, next.first); c.syncSoon() }
                }, icon = if (next.first == "loaded") Icons.Default.Inventory else Icons.Default.PlayArrow)
            }
        },
    ) { pad ->
        LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                FlatCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(s.tripStatus[t.status] ?: t.status, modifier = Modifier.weight(1f), style = MaterialTheme.typography.titleSmall)
                        Badge(s.stopsLeft(left.size), if (left.isEmpty()) Tone.Success else Tone.Warning)
                    }
                    KeyValue(s.toCollect, f.money(left.sumOf { it.total - it.paid }))
                    KeyValue(s.cashCollected, f.money(t.cashCollected), C.Success, bold = true)
                }
            }
            items(stops, key = { it.orderId }) { stop -> StopRow(stop) { nav.navigate(Routes.stop(stop.orderId)) } }
        }
    }
}

@Composable
private fun StopRow(stop: StopEntity, onClick: () -> Unit) {
    val s = LocalStrings.current
    val f = s.fmt
    val done = stop.status in DONE
    FlatCard(onClick = onClick, color = if (done) C.Bg else C.Card) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (done) {
                Icon(Icons.Default.CheckCircle, null, tint = if (stop.status == "failed") C.Danger else C.Success)
                Spacer(Modifier.width(10.dp))
            }
            Column(Modifier.weight(1f)) {
                Text(if (s.bangla) stop.shopNameBn ?: stop.shopName else stop.shopName, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${stop.number} · ${stop.ownerName ?: ""}", color = C.Muted, style = MaterialTheme.typography.bodySmall, maxLines = 1)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(f.money((stop.total - stop.paid - stop.localCollected).coerceAtLeast(0)), fontWeight = FontWeight.Bold)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (stop.localResult != null) Icon(Icons.Default.CloudUpload, s.notSent, tint = C.Warning, modifier = Modifier.padding(end = 4.dp))
                    Badge(s.orderStatus[stop.status] ?: stop.status, orderTone(stop.status))
                }
            }
        }
    }
}

/** Hand over the goods and take the money for one order. */
@Composable
fun StopScreen(nav: NavHostController, orderId: String) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val f = s.fmt
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = LocalSnackbar.current
    val me = c.session.current.me
    val stop by remember { c.repo.dao.stop(orderId) }.collectAsState(initial = null)
    val st = stop ?: run { Screen(s.deliver, onBack = { nav.popBackStack() }) { Loading() }; return }
    val items = remember(st.itemsJson) { st.lines() }
    val done = st.status in DONE

    var result by rememberSaveable { mutableStateOf("delivered") }
    var reason by rememberSaveable { mutableStateOf<String?>(null) }
    val delivered = remember { mutableStateMapOf<String, Int>() }
    LaunchedEffect(items) { items.forEach { if (it.id !in delivered) delivered[it.id] = it.qty } }
    val value = if (result == "failed") 0 else items.sumOf { (if (result == "partial") delivered[it.id] ?: it.qty else it.qty) * it.unitPrice }
    val due = (value - st.paid).coerceAtLeast(0)
    var amount by rememberSaveable(result, value) { mutableStateOf((due / 100).toString()) }
    var method by rememberSaveable { mutableStateOf("cash") }
    var reference by rememberSaveable { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }

    val amountPaisa = (amount.toLongOrNull() ?: 0) * 100
    val canSave = !saving && when (result) {
        "failed" -> reason != null
        else -> amountPaisa <= due + 100 && (method == "cash" || amountPaisa == 0L || reference.isNotBlank())
    }

    val results = buildList {
        add("delivered" to s.deliveredAll)
        if (me?.can("delivery.partial") == true) add("partial" to s.partial)
        add("failed" to s.notDelivered)
    }

    Screen(
        title = if (s.bangla) st.shopNameBn ?: st.shopName else st.shopName,
        subtitle = st.number,
        onBack = { nav.popBackStack() },
        bottomBar = {
            if (!done) BottomActionBar {
                BigButton(s.saveDelivery, loading = saving, enabled = canSave, onClick = {
                    saving = true
                    scope.launch {
                        val fix = c.location.current(6000)
                        c.repo.saveDelivery(
                            stop = st,
                            result = result,
                            delivered = if (result == "partial") delivered.toMap() else emptyMap(),
                            reason = if (result == "failed") reason else null,
                            amount = if (result == "failed") 0 else amountPaisa,
                            method = method,
                            reference = reference.trim().ifBlank { null },
                            fix = fix,
                        )
                        c.syncSoon()
                        snackbar.showSnackbar(s.deliverySaved)
                        nav.popBackStack()
                    }
                })
            }
        },
    ) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            FlatCard {
                if (!st.ownerName.isNullOrBlank()) KeyValue(s.ownerName, st.ownerName)
                KeyValue(s.total, f.money(st.total), bold = true)
                if (st.paid > 0) KeyValue(s.alreadyPaid, f.money(st.paid), C.Success)
                if (st.shopDue > 0) KeyValue(s.due, f.money(st.shopDue), C.Danger)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlineButton(s.call, { st.phone?.let { call(context, it) } }, Modifier.weight(1f), icon = Icons.Default.Call, enabled = !st.phone.isNullOrBlank())
                    OutlineButton(s.directions, { directions(context, st.lat!!, st.lng!!, st.shopName) }, Modifier.weight(1f), icon = Icons.Default.Directions, enabled = st.lat != null)
                }
            }

            if (done) {
                Badge(s.orderStatus[st.status] ?: st.status, orderTone(st.status))
                if (st.localCollected > 0) KeyValue(s.cashCollected, f.money(st.localCollected), C.Success, bold = true)
            } else {
                ChoiceList(results, result) { result = it }
            }

            if (result == "failed" && !done) {
                SectionTitle(s.reason)
                ChoiceList(s.failReasons.toList(), reason) { reason = it }
            } else {
                FlatCard {
                    items.forEachIndexed { i, l ->
                        if (i > 0) HorizontalDivider(Modifier.padding(vertical = 8.dp), color = C.Border)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(l.name, style = MaterialTheme.typography.bodyLarge)
                                Text("${s.ordered}: ${f.qty(l.qty, l.packSize, s.ctn, s.pcs)}", color = C.Muted, style = MaterialTheme.typography.bodySmall)
                            }
                            if (result == "partial" && !done) {
                                Stepper(delivered[l.id] ?: l.qty, { delivered[l.id] = it.coerceAtMost(l.qty) }, s.pcs, max = l.qty)
                            } else {
                                Text(f.money((l.deliveredQty ?: l.qty) * l.unitPrice), fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                }
                if (!done) {
                    SectionTitle(s.payment)
                    FlatCard {
                        KeyValue(s.toCollect, f.money(due), bold = true)
                    }
                    Chips(s.methods.toList(), method, { method = it })
                    Field(amount, { v -> amount = v.filter(Char::isDigit).take(8) }, "${s.amount} (৳)", keyboard = KeyboardType.Number)
                    if (method != "cash") Field(reference, { reference = it }, s.reference)
                }
            }
            Spacer(Modifier.height(8.dp))
        }
    }
}
