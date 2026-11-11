package com.onukrom.app.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.ErrorOutline
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.onukrom.app.LocalContainer
import com.onukrom.app.data.db.OrderEntity
import com.onukrom.app.data.db.ShopEntity
import com.onukrom.app.i18n.LocalStrings
import com.onukrom.app.i18n.Strings
import com.onukrom.app.ui.components.Badge
import com.onukrom.app.ui.components.FlatCard
import com.onukrom.app.ui.components.Tone
import com.onukrom.app.ui.components.orderTone
import com.onukrom.app.ui.theme.C
import kotlinx.coroutines.flow.map
import java.util.Calendar

data class SyncUi(val online: Boolean, val running: Boolean, val pending: Int, val failed: Int, val lastSyncAt: Long)

/** Live sync numbers for the banner (pending excludes background location pings). */
@Composable
fun rememberSyncUi(): SyncUi {
    val c = LocalContainer.current
    val online by c.connectivity.online.collectAsState()
    val status by c.sync.status.collectAsState()
    val session by c.session.state.collectAsState()
    val counts by remember {
        c.repo.dao.outbox().map { rows ->
            rows.count { it.state == "pending" && it.entity != "location_ping" } to rows.count { it.state == "rejected" }
        }
    }.collectAsState(initial = 0 to 0)
    return SyncUi(online, status.running, counts.first, counts.second, session.lastSyncAt)
}

fun todayKey(): String = when (Calendar.getInstance().get(Calendar.DAY_OF_WEEK)) {
    Calendar.SATURDAY -> "sat"
    Calendar.SUNDAY -> "sun"
    Calendar.MONDAY -> "mon"
    Calendar.TUESDAY -> "tue"
    Calendar.WEDNESDAY -> "wed"
    Calendar.THURSDAY -> "thu"
    else -> "fri"
}

fun ShopEntity.display(s: Strings) = if (s.bangla && !nameBn.isNullOrBlank()) nameBn else name

fun call(context: Context, phone: String) {
    context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

/** Opens Google Maps (or any maps app) with directions to the point. */
fun directions(context: Context, lat: Double, lng: Double, label: String) {
    val uri = Uri.parse("geo:$lat,$lng?q=$lat,$lng(${Uri.encode(label)})")
    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

@Composable
fun OrderRow(order: OrderEntity, onClick: () -> Unit) {
    val s = LocalStrings.current
    val f = s.fmt
    FlatCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(order.shopName, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${order.number} · ${f.date(order.orderedAt)}", style = MaterialTheme.typography.bodySmall, color = C.Muted)
            }
            Spacer(Modifier.width(8.dp))
            Text(f.money(order.total), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            when (order.sync) {
                "pending" -> Badge(s.notSent, Tone.Warning, icon = Icons.Default.CloudUpload)
                "rejected" -> Badge(s.notAccepted, Tone.Danger, icon = Icons.Default.ErrorOutline)
                else -> Badge(s.orderStatus[order.status] ?: order.status, orderTone(order.status))
            }
            if (order.sync == "rejected") {
                Spacer(Modifier.width(8.dp))
                Icon(Icons.Default.ErrorOutline, null, tint = C.Danger, modifier = Modifier.size(16.dp))
                Text(" " + s.error(order.syncError, null), style = MaterialTheme.typography.bodySmall, color = C.Danger, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}
