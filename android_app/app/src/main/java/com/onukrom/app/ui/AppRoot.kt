package com.onukrom.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Storefront
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.Text
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.onukrom.app.data.SessionState
import com.onukrom.app.i18n.LocalStrings
import com.onukrom.app.ui.components.LocalSnackbar
import com.onukrom.app.ui.screens.AddShopScreen
import com.onukrom.app.ui.screens.CompanyScreen
import com.onukrom.app.ui.screens.HomeScreen
import com.onukrom.app.ui.screens.LoginScreen
import com.onukrom.app.ui.screens.MapScreen
import com.onukrom.app.ui.screens.MoreScreen
import com.onukrom.app.ui.screens.OrderDetailScreen
import com.onukrom.app.ui.screens.OrderScreen
import com.onukrom.app.ui.screens.OrdersScreen
import com.onukrom.app.ui.screens.PasswordScreen
import com.onukrom.app.ui.screens.ShopDetailScreen
import com.onukrom.app.ui.screens.ShopsScreen
import com.onukrom.app.ui.screens.StopScreen
import com.onukrom.app.ui.screens.SyncScreen
import com.onukrom.app.ui.screens.TripScreen
import com.onukrom.app.ui.screens.TripsScreen
import com.onukrom.app.ui.theme.C

@Composable
fun AppRoot(session: SessionState) {
    when {
        session.companyCode == null -> CompanyScreen()
        !session.loggedIn -> LoginScreen(session)
        else -> MainNav(session)
    }
}

private data class Tab(val route: String, val label: String, val icon: ImageVector)

object Routes {
    fun shop(id: String) = "shop/$id"
    fun order(shopId: String, edit: String? = null) = "order/$shopId" + (edit?.let { "?edit=$it" } ?: "")
    fun orderDetail(id: String) = "orderDetail/$id"
    fun trip(id: String) = "trip/$id"
    fun stop(orderId: String) = "stop/$orderId"
    fun newShop(forOrder: Boolean) = "newShop?forOrder=$forOrder"
    fun tripMap(id: String) = "map?trip=$id"
    const val SHOP_MAP = "map"
    const val PICK_SHOP = "pickShop"
    const val PASSWORD = "password"
    const val SYNC = "sync"
}

/** Go to a bottom tab, keeping one copy of each tab on the back stack. */
fun NavHostController.tab(route: String) = navigate(route) {
    popUpTo(graph.findStartDestination().id) { saveState = true }
    launchSingleTop = true
    restoreState = true
}

@Composable
private fun MainNav(session: SessionState) {
    val s = LocalStrings.current
    val me = session.me!!
    val nav = rememberNavController()
    val snackbar = LocalSnackbar.current

    val tabs = buildList {
        add(Tab("home", s.navHome, Icons.Default.Home))
        if (me.isSales) add(Tab("orders", s.navOrders, Icons.AutoMirrored.Filled.ReceiptLong))
        if (me.isSales) add(Tab("shops", s.navShops, Icons.Default.Storefront))
        if (me.isDelivery) add(Tab("trips", s.navDeliveries, Icons.Default.LocalShipping))
        add(Tab("more", s.navMore, Icons.Default.Menu))
    }
    val backStack by nav.currentBackStackEntryAsState()
    val current = backStack?.destination?.route

    Scaffold(
        contentWindowInsets = WindowInsets(0),
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            if (tabs.any { it.route == current }) {
                Column {
                    HorizontalDivider(color = C.Border)
                    NavigationBar(containerColor = C.Card, tonalElevation = androidx.compose.ui.unit.Dp(0f)) {
                        tabs.forEach { t ->
                            val selected = current == t.route
                            NavigationBarItem(
                                selected = selected,
                                onClick = { nav.tab(t.route) },
                                // Material's indicator is always a pill; draw a sharp one instead.
                                icon = {
                                    androidx.compose.foundation.layout.Box(
                                        Modifier
                                            .background(if (selected) C.PrimarySoft else Color.Transparent, RectangleShape)
                                            .padding(horizontal = 18.dp, vertical = 4.dp),
                                    ) { Icon(t.icon, null) }
                                },
                                label = { Text(t.label, maxLines = 1) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = C.Primary, selectedTextColor = C.Primary, indicatorColor = Color.Transparent,
                                    unselectedIconColor = C.Muted, unselectedTextColor = C.Muted,
                                ),
                            )
                        }
                    }
                }
            }
        },
    ) { pad ->
        NavHost(nav, startDestination = "home", modifier = Modifier.padding(pad)) {
            composable("home") { HomeScreen(nav, session) }
            composable("orders") { OrdersScreen(nav) }
            composable("shops") { ShopsScreen(nav, pickMode = false) }
            composable(Routes.PICK_SHOP) { ShopsScreen(nav, pickMode = true) }
            composable("trips") { TripsScreen(nav) }
            composable("more") { MoreScreen(nav, session) }
            composable("shop/{id}") { ShopDetailScreen(nav, it.arguments!!.getString("id")!!) }
            composable(
                "newShop?forOrder={forOrder}",
                arguments = listOf(navArgument("forOrder") { type = NavType.BoolType; defaultValue = false }),
            ) { AddShopScreen(nav, it.arguments!!.getBoolean("forOrder")) }
            composable(
                "order/{shopId}?edit={edit}",
                arguments = listOf(navArgument("edit") { type = NavType.StringType; nullable = true; defaultValue = null }),
            ) { OrderScreen(nav, it.arguments!!.getString("shopId")!!, it.arguments!!.getString("edit")) }
            composable("orderDetail/{id}") { OrderDetailScreen(nav, it.arguments!!.getString("id")!!) }
            composable("trip/{id}") { TripScreen(nav, it.arguments!!.getString("id")!!) }
            composable("stop/{orderId}") { StopScreen(nav, it.arguments!!.getString("orderId")!!) }
            composable(
                "map?trip={trip}",
                arguments = listOf(navArgument("trip") { type = NavType.StringType; nullable = true; defaultValue = null }),
            ) { MapScreen(nav, it.arguments!!.getString("trip")) }
            composable(Routes.PASSWORD) { PasswordScreen(nav) }
            composable(Routes.SYNC) { SyncScreen(nav) }
        }
    }
}
