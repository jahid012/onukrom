package com.onukrom.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.onukrom.app.LocalContainer
import com.onukrom.app.core.Time
import com.onukrom.app.data.flagList
import com.onukrom.app.data.lines
import com.onukrom.app.i18n.LocalStrings
import com.onukrom.app.ui.Routes
import com.onukrom.app.ui.components.Badge
import com.onukrom.app.ui.components.BigButton
import com.onukrom.app.ui.components.BottomActionBar
import com.onukrom.app.ui.components.Chips
import com.onukrom.app.ui.components.Empty
import com.onukrom.app.ui.components.FlatCard
import com.onukrom.app.ui.components.KeyValue
import com.onukrom.app.ui.components.Loading
import com.onukrom.app.ui.components.Notice
import com.onukrom.app.ui.components.Screen
import com.onukrom.app.ui.components.Tone
import com.onukrom.app.ui.components.orderTone
import com.onukrom.app.ui.theme.C

@Composable
fun OrdersScreen(nav: NavHostController) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val orders by c.repo.dao.orders().collectAsState(initial = null)
    var filter by rememberSaveable { mutableStateOf("today") }

    val list = (orders ?: emptyList()).filter {
        when (filter) {
            "today" -> it.orderedAt >= Time.startOfToday()
            "waiting" -> it.sync != "synced" || it.status == "pending"
            else -> true
        }
    }

    Screen(title = s.myOrders) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            Chips(
                listOf("today" to s.today, "waiting" to s.orderStatus.getValue("pending"), "all" to s.all),
                filter, { filter = it },
                Modifier.padding(16.dp),
            )
            when {
                orders == null -> Loading()
                list.isEmpty() -> Empty(Icons.AutoMirrored.Filled.ReceiptLong, s.noOrders, fill = true)
                else -> LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(list, key = { it.id }) { o -> OrderRow(o) { nav.navigate(Routes.orderDetail(o.id)) } }
                }
            }
        }
    }
}

@Composable
fun OrderDetailScreen(nav: NavHostController, orderId: String) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val f = s.fmt
    val order by remember { c.repo.dao.order(orderId) }.collectAsState(initial = null)
    val o = order ?: run { Screen(s.myOrders, onBack = { nav.popBackStack() }) { Loading() }; return }
    val me = c.session.current.me
    // Editable until the office acts on it (spec: order.edit_own_pending).
    val canEdit = o.status == "pending" && me?.can("order.edit_own_pending") == true

    Screen(
        title = o.number,
        subtitle = o.shopName,
        onBack = { nav.popBackStack() },
        bottomBar = {
            if (canEdit) BottomActionBar {
                BigButton(s.editOrder, { nav.navigate(Routes.order(o.shopId, o.id)) }, icon = Icons.Default.Edit)
            }
        },
    ) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            when (o.sync) {
                "pending" -> Notice(s.notSent + " — " + s.offline, Tone.Warning)
                "rejected" -> Notice(s.notAccepted + ": " + s.error(o.syncError, null), Tone.Danger)
            }
            if (o.status == "rejected" && !o.rejectReason.isNullOrBlank()) Notice(o.rejectReason, Tone.Danger)

            FlatCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(s.orderedAt, color = C.Muted, modifier = Modifier.weight(1f))
                    Badge(s.orderStatus[o.status] ?: o.status, orderTone(o.status))
                }
                Text(f.date(o.orderedAt), style = MaterialTheme.typography.titleSmall)
                if (o.tripNumber != null) KeyValue(s.trip, o.tripNumber)
                val flags = o.flagList()
                if (flags.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) { flags.forEach { Badge(s.flags[it] ?: it, Tone.Warning) } }
                }
            }

            FlatCard {
                o.lines().forEachIndexed { i, l ->
                    if (i > 0) HorizontalDivider(Modifier.padding(vertical = 8.dp), color = C.Border)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(l.name, style = MaterialTheme.typography.bodyLarge)
                            Text("${f.qty(l.qty, l.packSize, s.ctn, s.pcs)} × ${f.money(l.unitPrice)}", color = C.Muted, style = MaterialTheme.typography.bodySmall)
                            if (l.deliveredQty != null && l.deliveredQty != l.qty) {
                                Text("${s.giving}: ${f.qty(l.deliveredQty, l.packSize, s.ctn, s.pcs)}", color = C.Warning, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                        Text(f.money(l.lineTotal), fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            FlatCard {
                KeyValue(s.subtotal, f.money(o.subtotal))
                if (o.discount > 0) KeyValue(s.discount, "− " + f.money(o.discount), C.Danger)
                KeyValue(s.total, f.money(o.total), bold = true)
                if (o.paid > 0) KeyValue(s.alreadyPaid, f.money(o.paid), C.Success)
            }
            if (!o.note.isNullOrBlank()) FlatCard { KeyValue(s.note, o.note) }
        }
    }
}
