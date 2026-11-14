package com.onukrom.app.ui.screens

import androidx.activity.compose.BackHandler
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Replay
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import com.onukrom.app.LocalContainer
import com.onukrom.app.core.Geo
import com.onukrom.app.data.DraftLine
import com.onukrom.app.data.Pricing
import com.onukrom.app.data.db.OrderEntity
import com.onukrom.app.data.db.ProductEntity
import com.onukrom.app.data.lines
import com.onukrom.app.i18n.LocalStrings
import com.onukrom.app.ui.Routes
import com.onukrom.app.ui.components.BigButton
import com.onukrom.app.ui.components.BottomActionBar
import com.onukrom.app.ui.components.Chips
import com.onukrom.app.ui.components.Empty
import com.onukrom.app.ui.components.Field
import com.onukrom.app.ui.components.FlatCard
import com.onukrom.app.ui.components.KeyValue
import com.onukrom.app.ui.components.Loading
import com.onukrom.app.ui.components.LocalSnackbar
import com.onukrom.app.ui.components.Notice
import com.onukrom.app.ui.components.OutlineButton
import com.onukrom.app.ui.components.Screen
import com.onukrom.app.ui.components.SearchBox
import com.onukrom.app.ui.components.SectionTitle
import com.onukrom.app.ui.components.Stepper
import com.onukrom.app.ui.components.Tone
import com.onukrom.app.ui.theme.C
import kotlinx.coroutines.launch

/** The cart survives screen rotation and the trip to the review step. */
class OrderDraft : ViewModel() {
    val qty = mutableStateMapOf<String, Int>()
    var discount by mutableStateOf("")
    var note by mutableStateOf("")
    var editing: OrderEntity? = null
    var loaded = false
}

@Composable
fun OrderScreen(nav: NavHostController, shopId: String, editId: String?) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val f = s.fmt
    val scope = rememberCoroutineScope()
    val snackbar = LocalSnackbar.current
    val draft: OrderDraft = viewModel()
    val me = c.session.current.me!!
    val settings = me.settings

    val shop by remember { c.repo.dao.shop(shopId) }.collectAsState(initial = null)
    val products by c.repo.dao.products().collectAsState(initial = null)
    val categories by c.repo.dao.categories().collectAsState(initial = emptyList())
    val stockRows by c.repo.dao.stock().collectAsState(initial = emptyList())
    val priceItems by c.repo.dao.priceItems().collectAsState(initial = emptyList())
    val routes by c.repo.dao.routes().collectAsState(initial = emptyList())
    var lastOrder by remember { mutableStateOf<OrderEntity?>(null) }

    var review by rememberSaveable { mutableStateOf(false) }
    var query by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf<String?>(null) }
    var confirmLeave by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }

    // GPS starts now, so a good fix is ready by the time the order is saved.
    val loc = rememberLiveLocation(settings.maxAccuracy, settings.maxAge)

    LaunchedEffect(Unit) {
        if (!draft.loaded) {
            draft.loaded = true
            editId?.let { id ->
                c.repo.dao.orderNow(id)?.let { o ->
                    draft.editing = o
                    o.lines().forEach { draft.qty[it.productId] = it.qty }
                    if (o.discount > 0) draft.discount = (o.discount / 100).toString()
                    draft.note = o.note ?: ""
                }
            }
        }
        lastOrder = c.repo.dao.lastOrderFor(shopId)?.takeIf { it.id != editId }
    }

    val sh = shop
    val all = products
    if (sh == null || all == null) {
        Screen(s.newOrder, onBack = { nav.popBackStack() }) { Loading() }
        return
    }

    val pricing = remember(priceItems, routes) { Pricing(priceItems, routes) }
    val stock = remember(stockRows) { stockRows.associate { it.productId to it.available } }
    val byId = remember(all) { all.associateBy { it.id } }
    val lines = draft.qty.filterValues { it > 0 }.mapNotNull { (id, q) -> byId[id]?.let { DraftLine(it, q, pricing.priceFor(sh, it)) } }
    val subtotal = lines.sumOf { it.qty * it.unitPrice }
    val canDiscount = me.can("order.give_discount")
    val discount = if (canDiscount) ((draft.discount.toLongOrNull() ?: 0L) * 100).coerceIn(0, subtotal) else 0L
    val total = subtotal - discount

    fun leave() {
        if (draft.qty.values.any { it > 0 } && draft.editing == null) confirmLeave = true else nav.popBackStack()
    }
    BackHandler { if (review) review = false else leave() }

    if (!review) {
        val visible = all
            .filter { category == null || it.categoryId == category }
            .filter { query.isBlank() || listOfNotNull(it.name, it.nameBn, it.brand, it.sku).any { v -> v.contains(query.trim(), true) } }

        Screen(
            title = sh.display(s),
            subtitle = if (draft.editing != null) "${s.editOrder} · ${draft.editing!!.number}" else s.newOrder,
            onBack = { leave() },
            bottomBar = {
                BottomActionBar {
                    Column(Modifier.weight(1f)) {
                        Text(s.itemsCount(lines.size), color = C.Muted, style = MaterialTheme.typography.bodySmall)
                        Text(f.money(subtotal), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    }
                    BigButton(s.review, { review = true }, Modifier.weight(1.2f), enabled = lines.isNotEmpty())
                }
            },
        ) { pad ->
            Column(Modifier.padding(pad).fillMaxSize()) {
                Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    SearchBox(query, { query = it }, s.searchProducts)
                    if (categories.isNotEmpty()) {
                        Chips(listOf<Pair<String?, String>>(null to s.all) + categories.map { it.id to (if (s.bangla) it.nameBn ?: it.name else it.name) }, category, { category = it })
                    }
                    val last = lastOrder
                    if (last != null && lines.isEmpty() && draft.editing == null) {
                        OutlineButton(
                            "${s.repeatLast} · ${f.money(last.total)}",
                            {
                                last.lines().forEach { l -> if (byId[l.productId] != null) draft.qty[l.productId] = l.qty }
                            },
                            icon = Icons.Default.Replay,
                        )
                    }
                }
                if (visible.isEmpty()) {
                    Empty(Icons.Default.Inventory2, s.nothingHere, fill = true)
                } else {
                    LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(visible, key = { it.id }) { p ->
                            ProductRow(p, pricing.priceFor(sh, p), stock[p.id], draft.qty[p.id] ?: 0) { draft.qty[p.id] = it }
                        }
                    }
                }
            }
        }
    } else {
        val creditOver = sh.creditLimit > 0 && sh.due + total > sh.creditLimit
        val creditBlocked = creditOver && settings.creditMode == "block"
        val overStock = lines.filter { l -> stock[l.product.id]?.let { l.qty > it } == true }
        val stockBlocked = overStock.isNotEmpty() && settings.blockOverStock
        val maxDiscount = (subtotal * settings.maxDiscount / 100).toLong()
        val discountBad = discount > maxDiscount
        val fix = loc.fix
        val mockBlocked = fix?.isMock == true && settings.blockMock
        val locationOk = when (settings.locationMode) {
            "off" -> true
            "required" -> fix != null && (loc.good || loc.waitedSec >= settings.wait)
            else -> fix != null || loc.waitedSec >= settings.wait
        }
        val canSave = lines.isNotEmpty() && locationOk && !mockBlocked && !creditBlocked && !stockBlocked && !discountBad && !saving

        Screen(
            title = s.review,
            subtitle = sh.display(s),
            onBack = { review = false },
            bottomBar = {
                BottomActionBar {
                    Column(Modifier.weight(1f)) {
                        Text(s.total, color = C.Muted, style = MaterialTheme.typography.bodySmall)
                        Text(f.money(total), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    }
                    BigButton(
                        if (draft.editing != null) s.updateOrder else s.saveOrder,
                        modifier = Modifier.weight(1.4f),
                        enabled = canSave,
                        loading = saving,
                        onClick = {
                            saving = true
                            scope.launch {
                                val chosen = if (settings.locationMode == "off") null else loc.fix
                                val flags = buildList {
                                    if (chosen == null && settings.locationMode != "off") add("no_location")
                                    if (chosen != null && !loc.good) add("low_accuracy")
                                    if (chosen?.isMock == true) add("mock")
                                    if (chosen != null && sh.lat != null && sh.lng != null && Geo.distanceM(chosen.lat, chosen.lng, sh.lat, sh.lng) > settings.geofence) add("far_from_shop")
                                    if (creditOver) add("over_credit")
                                    if (overStock.isNotEmpty()) add("over_stock")
                                }
                                val id = c.repo.saveOrder(
                                    existing = draft.editing,
                                    shop = sh,
                                    lines = lines,
                                    discount = discount,
                                    note = draft.note.trim().ifBlank { null },
                                    fix = chosen,
                                    flags = flags,
                                    trail = loc.picker.trail.toList(),
                                )
                                c.syncSoon()
                                draft.qty.clear()
                                snackbar.showSnackbar(s.orderSaved)
                                nav.navigate(Routes.orderDetail(id)) { popUpTo("home") }
                            }
                        },
                    )
                }
            },
        ) { pad ->
            LazyColumn(Modifier.padding(pad), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                item {
                    FlatCard {
                        lines.forEachIndexed { i, l ->
                            if (i > 0) HorizontalDivider(Modifier.padding(vertical = 8.dp), color = C.Border)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(Modifier.weight(1f)) {
                                    Text(l.product.nameBn?.takeIf { s.bangla } ?: l.product.name, style = MaterialTheme.typography.bodyLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text(
                                        "${f.qty(l.qty, l.product.packSize, s.ctn, s.pcs)} × ${f.money(l.unitPrice)}",
                                        color = if (l in overStock) C.Danger else C.Muted, style = MaterialTheme.typography.bodySmall,
                                    )
                                }
                                Text(f.money(l.qty * l.unitPrice), fontWeight = FontWeight.SemiBold)
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        TextButton(onClick = { review = false }) { Text(s.editOrder) }
                    }
                }
                item {
                    FlatCard {
                        KeyValue(s.subtotal, f.money(subtotal))
                        if (discount > 0) KeyValue(s.discount, "− " + f.money(discount), C.Danger)
                        KeyValue(s.total, f.money(total), bold = true)
                        if (sh.due > 0) KeyValue(s.due, f.money(sh.due), C.Danger)
                    }
                }
                if (canDiscount) item {
                    Field(
                        draft.discount, { v -> draft.discount = v.filter(Char::isDigit).take(7) }, "${s.discount} (৳)",
                        keyboard = KeyboardType.Number,
                        error = if (discountBad) s.discountMax(f.money(maxDiscount)) else null,
                        placeholder = s.discountMax(f.money(maxDiscount)),
                    )
                }
                item { Field(draft.note, { draft.note = it.take(250) }, s.note, placeholder = s.notePlaceholder, singleLine = false) }
                if (creditOver) item { Notice(if (creditBlocked) s.creditBlock else s.creditWarn, if (creditBlocked) Tone.Danger else Tone.Warning) }
                if (overStock.isNotEmpty()) item { Notice(s.overStock, if (stockBlocked) Tone.Danger else Tone.Warning, Icons.Default.Warning) }
                if (settings.locationMode != "off") {
                    item { SectionTitle(s.shopLocation) }
                    item { LocationCard(loc, sh) }
                    if (!locationOk) item {
                        Text(if (settings.locationMode == "required") s.gpsRequired else s.gpsSearching, color = C.Muted, style = MaterialTheme.typography.bodySmall)
                    } else if (fix == null) item {
                        Text(s.noLocationOk, color = C.Muted, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }

    if (confirmLeave) {
        AlertDialog(
            onDismissRequest = { confirmLeave = false },
            title = { Text(s.leaveOrderTitle) },
            text = { Text(s.leaveOrderBody) },
            confirmButton = { TextButton(onClick = { confirmLeave = false; draft.qty.clear(); nav.popBackStack() }) { Text(s.leave, color = C.Danger) } },
            dismissButton = { TextButton(onClick = { confirmLeave = false }) { Text(s.stay) } },
            containerColor = C.Card,
            tonalElevation = 0.dp,
        )
    }
}

/** One product: name, price, stock, and carton + piece steppers. */
@Composable
private fun ProductRow(p: ProductEntity, price: Long, available: Int?, qty: Int, onQty: (Int) -> Unit) {
    val s = LocalStrings.current
    val f = s.fmt
    val pack = p.packSize.coerceAtLeast(1)
    val ctn = qty / pack
    val pcs = qty % pack
    val out = available != null && available <= 0
    FlatCard(padding = 12.dp, border = if (qty > 0) C.Primary else C.Border) {
        Row(verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                Text(p.nameBn?.takeIf { s.bangla } ?: p.name, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(
                    listOfNotNull(p.brand, if (pack > 1) "${f.num(pack)} ${s.pcs}/${s.ctn}" else null).joinToString(" · "),
                    color = C.Muted, style = MaterialTheme.typography.bodySmall,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(f.money(price), fontWeight = FontWeight.Bold)
                Text(s.perPiece, color = C.Faint, style = MaterialTheme.typography.labelSmall)
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                if (available == null) "" else if (out) s.outOfStock else "${s.stock}: ${f.qty(available, pack, s.ctn, s.pcs)}",
                color = if (out || (available != null && qty > available)) C.Danger else C.Muted,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.weight(1f),
            )
            if (pack > 1) {
                Stepper(ctn, { onQty(it * pack + pcs) }, s.ctn)
                Spacer(Modifier.width(10.dp))
            }
            // Going past a full carton rolls over into cartons (pcs = pack → +1 ctn).
            Stepper(pcs, { v -> onQty(ctn * pack + v) }, s.pcs, max = if (pack > 1) pack else 99999)
        }
        if (qty > 0) {
            Text(
                "= ${f.qty(qty, pack, s.ctn, s.pcs)} · ${f.money(qty * price)}",
                color = C.Primary, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
    }
}
