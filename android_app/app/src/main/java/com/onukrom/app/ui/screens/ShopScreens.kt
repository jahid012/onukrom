package com.onukrom.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.AddBusiness
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Directions
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.DoNotDisturbOn
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
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
import com.onukrom.app.core.Geo
import com.onukrom.app.data.db.ShopEntity
import com.onukrom.app.i18n.LocalStrings
import com.onukrom.app.location.Fix
import com.onukrom.app.ui.Routes
import com.onukrom.app.ui.components.Avatar
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
import com.onukrom.app.ui.components.SearchBox
import com.onukrom.app.ui.components.SectionTitle
import com.onukrom.app.ui.components.Tone
import com.onukrom.app.ui.theme.C
import kotlinx.coroutines.launch

/** All shops on my routes. In pick mode a tap starts an order for that shop. */
@Composable
fun ShopsScreen(nav: NavHostController, pickMode: Boolean) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val me = c.session.current.me
    val shops by c.repo.dao.shops().collectAsState(initial = null)
    val routes by c.repo.dao.routes().collectAsState(initial = emptyList())
    var query by rememberSaveable { mutableStateOf("") }
    var route by rememberSaveable { mutableStateOf<String?>(null) }
    var here by remember { mutableStateOf<Fix?>(null) }

    // A quick fix so the nearest shops come first.
    LaunchedEffect(Unit) { here = c.location.current(10000) }

    val todayRoutes = routes.filter { todayKey() in it.visitDays.split(",") }.map { it.id }.toSet()
    val list = (shops ?: emptyList())
        .filter { route == null || it.routeId == route }
        .filter {
            query.isBlank() || listOfNotNull(it.name, it.nameBn, it.ownerName, it.phone, it.code).any { v -> v.contains(query.trim(), ignoreCase = true) }
        }
        .map { it to here?.let { h -> if (it.lat != null && it.lng != null) Geo.distanceM(h.lat, h.lng, it.lat, it.lng) else null } }
        .sortedWith(compareBy({ if (it.first.routeId in todayRoutes) 0 else 1 }, { it.second ?: Int.MAX_VALUE }, { it.first.name }))

    Screen(
        title = if (pickMode) s.pickShop else s.navShops,
        onBack = if (pickMode) ({ nav.popBackStack() }) else null,
        actions = {
            if (c.hasMapKey) IconButton(onClick = { nav.navigate(Routes.SHOP_MAP) }) { Icon(Icons.Default.Map, s.mapView) }
        },
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SearchBox(query, { query = it }, s.searchShops)
                // Up top, next to the search: a floating button at the bottom
                // sat over the list and under the phone's gesture bar.
                if (me?.can("shop.create") == true) {
                    OutlineButton(
                        s.addShop,
                        { nav.navigate(Routes.newShop(forOrder = pickMode)) },
                        Modifier.fillMaxWidth(),
                        icon = Icons.Default.AddBusiness,
                    )
                }
                if (routes.size > 1) Chips(listOf<Pair<String?, String>>(null to s.allRoutes) + routes.map { it.id to it.name }, route, { route = it })
            }
            when {
                shops == null -> Loading()
                list.isEmpty() -> Empty(Icons.Default.Storefront, s.noShops, fill = true)
                else -> LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(list, key = { it.first.id }) { (shop, distance) ->
                        ShopRow(shop, distance) {
                            if (pickMode) nav.navigate(Routes.order(shop.id)) else nav.navigate(Routes.shop(shop.id))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ShopRow(shop: ShopEntity, distance: Int?, onClick: () -> Unit) {
    val s = LocalStrings.current
    val f = s.fmt
    FlatCard(onClick = onClick, padding = 12.dp) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(shop.display(s))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(shop.display(s), style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    listOfNotNull(shop.ownerName, shop.phone?.let(f::digits)).joinToString(" · ").ifEmpty { shop.code ?: "" },
                    color = C.Muted, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
                Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (shop.status == "pending_approval") Badge(s.pendingApproval, Tone.Warning)
                    if (shop.due > 0) Badge("${s.due} ${f.money(shop.due)}", Tone.Danger)
                }
            }
            if (distance != null) {
                Text(
                    if (distance < 1000) f.num(distance) + (if (s.bangla) " মি" else " m") else f.digits("%.1f".format(distance / 1000.0)) + (if (s.bangla) " কিমি" else " km"),
                    color = C.Muted, style = MaterialTheme.typography.labelMedium,
                )
            }
        }
    }
}

@Composable
fun ShopDetailScreen(nav: NavHostController, shopId: String) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val f = s.fmt
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbar = LocalSnackbar.current
    val shop by remember { c.repo.dao.shop(shopId) }.collectAsState(initial = null)
    val recent by remember { c.repo.dao.recentOrdersFor(shopId) }.collectAsState(initial = emptyList())
    val routes by c.repo.dao.routes().collectAsState(initial = emptyList())
    var askReason by remember { mutableStateOf(false) }

    val sh = shop ?: run { Screen(s.navShops, onBack = { nav.popBackStack() }) { Loading() }; return }
    val me = c.session.current.me

    Screen(
        title = sh.display(s),
        subtitle = listOfNotNull(sh.code, routes.firstOrNull { it.id == sh.routeId }?.name).joinToString(" · "),
        onBack = { nav.popBackStack() },
        bottomBar = {
            if (me?.isSales == true) BottomActionBar {
                OutlineButton(s.noOrder, { askReason = true }, Modifier.weight(1f), icon = Icons.Default.DoNotDisturbOn, color = C.Muted)
                BigButton(s.takeOrder, { nav.navigate(Routes.order(sh.id)) }, Modifier.weight(1.4f), icon = Icons.AutoMirrored.Filled.ReceiptLong)
            }
        },
    ) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (sh.status == "pending_approval") com.onukrom.app.ui.components.Notice(s.pendingApproval, Tone.Warning)
            FlatCard {
                if (!sh.ownerName.isNullOrBlank()) KeyValue(s.ownerName, sh.ownerName)
                sh.category?.let { KeyValue(s.category, s.categoryNames[it] ?: it) }
                KeyValue(s.due, f.money(sh.due), if (sh.due > 0) C.Danger else C.Text, bold = true)
                if (sh.creditLimit > 0) KeyValue(s.creditLimit, f.money(sh.creditLimit))
                KeyValue(s.lastOrder, sh.lastOrderAt?.let { s.ago(it) } ?: s.never)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlineButton(s.call, { sh.phone?.let { call(context, it) } }, Modifier.weight(1f), icon = Icons.Default.Call, enabled = !sh.phone.isNullOrBlank())
                OutlineButton(s.directions, { directions(context, sh.lat!!, sh.lng!!, sh.name) }, Modifier.weight(1f), icon = Icons.Default.Directions, enabled = sh.lat != null)
            }
            if (c.hasMapKey && sh.lat != null && sh.lng != null) {
                ShopMiniMap(sh)
            }
            if (recent.isNotEmpty()) {
                SectionTitle(s.myOrders)
                recent.forEach { o -> OrderRow(o) { nav.navigate(Routes.orderDetail(o.id)) } }
            }
            Spacer(Modifier.height(8.dp))
        }
    }

    if (askReason) {
        NoOrderDialog(onDismiss = { askReason = false }) { reason ->
            askReason = false
            scope.launch {
                val fix = c.location.current(8000)
                c.repo.saveVisit(sh, reason, fix)
                c.syncSoon()
                snackbar.showSnackbar(s.visitSaved)
                nav.popBackStack()
            }
        }
    }
}

@Composable
fun NoOrderDialog(onDismiss: () -> Unit, onSave: (String) -> Unit) {
    val s = LocalStrings.current
    var reason by remember { mutableStateOf<String?>(null) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(s.noOrderTitle) },
        text = { ChoiceList(s.noOrderReasons.toList(), reason) { reason = it } },
        confirmButton = { TextButton(enabled = reason != null, onClick = { onSave(reason!!) }) { Text(s.save) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text(s.cancel) } },
        containerColor = C.Card,
        tonalElevation = 0.dp,
    )
}

/** Add a shop on the spot. It works offline; the office approves it later. */
@Composable
fun AddShopScreen(nav: NavHostController, forOrder: Boolean) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val scope = rememberCoroutineScope()
    val snackbar = LocalSnackbar.current
    val settings = c.session.current.me?.settings
    val routes by c.repo.dao.routes().collectAsState(initial = emptyList())
    val loc = rememberLiveLocation(settings?.maxAccuracy ?: 50, settings?.maxAge ?: 60)

    var name by rememberSaveable { mutableStateOf("") }
    var nameBn by rememberSaveable { mutableStateOf("") }
    var owner by rememberSaveable { mutableStateOf("") }
    var phone by rememberSaveable { mutableStateOf("") }
    var category by rememberSaveable { mutableStateOf("grocery") }
    var route by rememberSaveable { mutableStateOf<String?>(null) }
    var tried by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(routes) {
        if (route == null) route = (routes.firstOrNull { todayKey() in it.visitDays.split(",") } ?: routes.firstOrNull())?.id
    }

    val needFix = settings?.locationMode == "required"
    val phoneOk = phone.isBlank() || phone.filter(Char::isDigit).length in 11..13
    val canSave = (name.isNotBlank() || nameBn.isNotBlank()) && phoneOk && (!needFix || loc.fix != null)

    Screen(
        title = s.addShop,
        onBack = { nav.popBackStack() },
        bottomBar = {
            BottomActionBar {
                BigButton(s.saveShop, loading = busy, enabled = canSave || !tried, onClick = {
                    tried = true
                    if (!canSave) return@BigButton
                    busy = true
                    scope.launch {
                        val shop = c.repo.saveShop(
                            name = name.trim().ifBlank { nameBn.trim() },
                            nameBn = nameBn.trim().ifBlank { null },
                            ownerName = owner.trim().ifBlank { null },
                            phone = phone.trim().ifBlank { null },
                            category = category,
                            routeId = route,
                            fix = loc.fix,
                        )
                        c.syncSoon()
                        snackbar.showSnackbar(s.shopSaved)
                        if (forOrder) {
                            nav.navigate(Routes.order(shop.id)) { popUpTo("home") }
                        } else {
                            nav.popBackStack()
                        }
                    }
                })
            }
        },
    ) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Field(nameBn, { nameBn = it }, s.shopNameBn, error = if (tried && name.isBlank() && nameBn.isBlank()) s.required else null)
            Field(name, { name = it }, s.shopName)
            Field(owner, { owner = it }, s.ownerName)
            Field(phone, { phone = it }, s.phone, keyboard = KeyboardType.Phone, placeholder = "01XXXXXXXXX", error = if (!phoneOk) s.phone else null)
            SectionTitle(s.category)
            Chips(s.categoryNames.toList(), category, { category = it })
            if (routes.size > 1) {
                SectionTitle(s.route)
                Chips(routes.map { it.id to it.name }, route, { route = it })
            }
            SectionTitle(s.shopLocation)
            LocationCard(loc)
            Text(s.shopLocationHint, color = C.Muted, style = MaterialTheme.typography.bodySmall)
            if (tried && needFix && loc.fix == null) Text(s.gpsRequired, color = C.Danger, fontWeight = FontWeight.Medium)
            Spacer(Modifier.fillMaxWidth().height(12.dp))
        }
    }
}
