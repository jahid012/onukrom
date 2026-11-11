package com.onukrom.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddShoppingCart
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Route
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.onukrom.app.LocalContainer
import com.onukrom.app.core.Time
import com.onukrom.app.data.SessionState
import com.onukrom.app.i18n.LocalStrings
import com.onukrom.app.ui.Routes
import com.onukrom.app.ui.components.Avatar
import com.onukrom.app.ui.components.BigButton
import com.onukrom.app.ui.components.Badge
import com.onukrom.app.ui.components.FlatCard
import com.onukrom.app.ui.components.SectionTitle
import com.onukrom.app.ui.components.SyncBar
import com.onukrom.app.ui.components.Tone
import com.onukrom.app.ui.tab
import com.onukrom.app.ui.theme.C
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(nav: NavHostController, session: SessionState) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val f = s.fmt
    val me = session.me!!
    val sync = rememberSyncUi()
    val scope = androidx.compose.runtime.rememberCoroutineScope()

    val orders by c.repo.dao.orders().collectAsState(initial = emptyList())
    val routes by c.repo.dao.routes().collectAsState(initial = emptyList())
    val stops by c.repo.dao.allStops().collectAsState(initial = emptyList())
    val visits by remember { c.repo.dao.visitsSince(Time.startOfToday()) }.collectAsState(initial = 0)

    val today = Time.startOfToday()
    val todayOrders = orders.filter { it.orderedAt >= today && it.status != "cancelled" }
    val todayRoutes = routes.filter { todayKey() in it.visitDays.split(",") }
    val openStops = stops.filter { it.status == "dispatched" || it.status == "approved" }

    LazyColumn(
        Modifier.fillMaxSize().statusBarsPadding(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(me.user.name)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text("${s.welcome}, ${me.user.name}", style = MaterialTheme.typography.titleMedium)
                    Text(listOfNotNull(me.tenant.name, me.user.employeeCode).joinToString(" · "), color = C.Muted, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        item {
            SyncBar(sync.online, sync.running, sync.pending, sync.failed, sync.lastSyncAt,
                onSync = { scope.launch { runCatching { c.sync.run() } } },
                onOpen = { nav.navigate(Routes.SYNC) })
        }

        if (me.isSales) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Stat(s.todayOrders, f.num(todayOrders.size), Modifier.weight(1f))
                    Stat(s.todaySales, f.money(todayOrders.sumOf { it.total }), Modifier.weight(1.3f))
                    Stat(s.todayVisits, f.num(todayOrders.map { it.shopId }.distinct().size + visits), Modifier.weight(1f))
                }
            }
            if (todayRoutes.isNotEmpty()) item {
                FlatCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Route, null, tint = C.Primary)
                        Spacer(Modifier.width(8.dp))
                        Text(s.todayRoute, color = C.Muted, modifier = Modifier.weight(1f))
                        todayRoutes.forEach { Badge(it.name, Tone.Primary, Modifier.padding(start = 6.dp)) }
                    }
                }
            }
            item { BigButton(s.newOrder, icon = Icons.Default.AddShoppingCart, onClick = { nav.navigate(Routes.PICK_SHOP) }) }
        }

        if (me.isDelivery) {
            item {
                FlatCard(onClick = { nav.tab("trips") }) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.LocalShipping, null, tint = C.Primary)
                        Spacer(Modifier.width(10.dp))
                        Column(Modifier.weight(1f)) {
                            Text(s.myTripsToday, style = MaterialTheme.typography.titleSmall)
                            Text(s.stopsLeft(openStops.size), color = C.Muted, style = MaterialTheme.typography.bodySmall)
                        }
                        Text(f.money(openStops.sumOf { it.total - it.paid }), fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        if (me.isSales && orders.isNotEmpty()) {
            item { SectionTitle(s.myOrders) }
            items(orders.take(5), key = { it.id }) { o -> OrderRow(o) { nav.navigate(Routes.orderDetail(o.id)) } }
        }
        item { Spacer(Modifier.height(8.dp)) }
    }
}

@Composable
private fun Stat(label: String, value: String, modifier: Modifier) {
    FlatCard(modifier, padding = 12.dp) {
        Text(label, color = C.Muted, style = MaterialTheme.typography.bodySmall, maxLines = 1)
        Spacer(Modifier.height(2.dp))
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}
