package com.onukrom.app.ui.screens

import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.onukrom.app.BuildConfig
import com.onukrom.app.LocalContainer
import com.onukrom.app.data.SessionState
import com.onukrom.app.data.api.ApiException
import com.onukrom.app.i18n.LocalStrings
import com.onukrom.app.ui.Routes
import com.onukrom.app.ui.components.Avatar
import com.onukrom.app.ui.components.Badge
import com.onukrom.app.ui.components.BigButton
import com.onukrom.app.ui.components.Chips
import com.onukrom.app.ui.components.Empty
import com.onukrom.app.ui.components.Field
import com.onukrom.app.ui.components.FlatCard
import com.onukrom.app.ui.components.LocalSnackbar
import com.onukrom.app.ui.components.Notice
import com.onukrom.app.ui.components.Screen
import com.onukrom.app.ui.components.SectionTitle
import com.onukrom.app.ui.components.SyncBar
import com.onukrom.app.ui.components.Tone
import com.onukrom.app.ui.theme.C
import kotlinx.coroutines.launch

@Composable
fun MoreScreen(nav: NavHostController, session: SessionState) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val scope = rememberCoroutineScope()
    val me = session.me!!
    var confirm by remember { mutableStateOf(false) }
    var unsent by remember { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf(false) }

    Screen(title = s.navMore) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            FlatCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Avatar(me.user.name, 52.dp)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(me.user.name, style = MaterialTheme.typography.titleMedium)
                        Text(listOfNotNull(me.user.employeeCode, me.user.phone?.let(s.fmt::digits)).joinToString(" · "), color = C.Muted)
                        Text(me.tenant.name, color = C.Muted, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            FlatCard(padding = 0.dp) {
                Column(Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Language, null, tint = C.Muted)
                        Spacer(Modifier.width(12.dp))
                        Text(s.language, modifier = Modifier.weight(1f))
                        Chips(listOf("bn" to "বাংলা", "en" to "English"), session.locale, { scope.launch { c.session.setLocale(it) } })
                    }
                }
                HorizontalDivider(color = C.Border)
                MenuRow(Icons.Default.Key, s.changePassword) { nav.navigate(Routes.PASSWORD) }
                HorizontalDivider(color = C.Border)
                MenuRow(Icons.Default.Sync, s.syncDetails) { nav.navigate(Routes.SYNC) }
            }

            BigButton(s.logout, color = C.Danger, icon = Icons.AutoMirrored.Filled.Logout, loading = busy, onClick = {
                scope.launch {
                    unsent = c.repo.dao.outboxCount()
                    confirm = true
                }
            })
            Text("${s.version} ${BuildConfig.VERSION_NAME}", color = C.Faint, style = MaterialTheme.typography.bodySmall, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        }
    }

    if (confirm) {
        AlertDialog(
            onDismissRequest = { confirm = false },
            title = { Text(s.logoutConfirm) },
            text = { if (unsent > 0) Text(s.logoutPending(unsent), color = C.Danger) },
            confirmButton = {
                TextButton(onClick = {
                    confirm = false
                    busy = true
                    scope.launch { c.logout() }
                }) { Text(s.logout, color = C.Danger) }
            },
            dismissButton = { TextButton(onClick = { confirm = false }) { Text(s.cancel) } },
            containerColor = C.Card,
            tonalElevation = 0.dp,
        )
    }
}

@Composable
private fun MenuRow(icon: ImageVector, label: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = C.Muted)
        Spacer(Modifier.width(12.dp))
        Text(label, modifier = Modifier.weight(1f))
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = C.Faint)
    }
}

@Composable
fun PasswordScreen(nav: NavHostController) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val scope = rememberCoroutineScope()
    val snackbar = LocalSnackbar.current
    var current by remember { mutableStateOf("") }
    var new by remember { mutableStateOf("") }
    var again by remember { mutableStateOf("") }
    var show by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val visual = if (show) VisualTransformation.None else PasswordVisualTransformation()
    val eye: @Composable () -> Unit = { IconButton(onClick = { show = !show }) { Icon(if (show) Icons.Default.VisibilityOff else Icons.Default.Visibility, null) } }

    Screen(title = s.changePassword, onBack = { nav.popBackStack() }) { pad ->
        Column(Modifier.padding(pad).verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Field(current, { current = it; error = null }, s.currentPassword, keyboard = KeyboardType.Password, visual = visual, trailing = eye)
            Field(new, { new = it; error = null }, s.newPassword, keyboard = KeyboardType.Password, visual = visual,
                error = if (new.isNotEmpty() && new.length < 6) s.passwordShort else null)
            Field(again, { again = it; error = null }, s.confirmPassword, keyboard = KeyboardType.Password, visual = visual,
                error = if (again.isNotEmpty() && again != new) s.passwordMismatch else null)
            if (error != null) Notice(error!!, Tone.Danger)
            Spacer(Modifier.height(8.dp))
            BigButton(s.save, loading = busy, enabled = current.isNotEmpty() && new.length >= 6 && new == again, onClick = {
                busy = true
                scope.launch {
                    try {
                        c.changePassword(current, new)
                        snackbar.showSnackbar(s.passwordChanged)
                        nav.popBackStack()
                    } catch (e: ApiException) {
                        error = if (e.isNetwork) s.noInternet else s.error(e.code, e.message)
                    } finally {
                        busy = false
                    }
                }
            })
        }
    }
}

/** What is waiting to go to the server, and what the server refused. */
@Composable
fun SyncScreen(nav: NavHostController) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val scope = rememberCoroutineScope()
    val sync = rememberSyncUi()
    val rows by c.repo.dao.outbox().collectAsState(initial = emptyList())
    val pending = rows.filter { it.state == "pending" && it.entity != "location_ping" }
    val rejected = rows.filter { it.state == "rejected" }

    Screen(title = s.syncDetails, onBack = { nav.popBackStack() }) { pad ->
        LazyColumn(Modifier.padding(pad).fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                SyncBar(sync.online, sync.running, sync.pending, sync.failed, sync.lastSyncAt,
                    onSync = { scope.launch { runCatching { c.sync.run() } } }, onOpen = {})
            }
            if (pending.isEmpty() && rejected.isEmpty()) item { Empty(Icons.Default.CloudDone, s.synced) }
            if (rejected.isNotEmpty()) {
                item { SectionTitle(s.failedItems) }
                items(rejected, key = { it.seq }) { row ->
                    FlatCard {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Badge(s.entityNames[row.entity] ?: row.entity, Tone.Danger)
                            Spacer(Modifier.width(8.dp))
                            Text(s.ago(row.createdAt), color = C.Muted, style = MaterialTheme.typography.bodySmall)
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(s.error(row.errorCode, row.errorMessage), fontWeight = FontWeight.Medium)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                            if (row.entity == "order") TextButton(onClick = { nav.navigate(Routes.orderDetail(row.recordId)) }) { Text(s.editOrder) }
                            TextButton(onClick = { scope.launch { c.repo.retry(row); c.syncSoon() } }) { Text(s.retry) }
                            TextButton(onClick = { scope.launch { c.repo.discard(row) } }) { Text(s.discard, color = C.Danger) }
                        }
                    }
                }
            }
            if (pending.isNotEmpty()) {
                item { SectionTitle(s.pendingItems) }
                items(pending, key = { it.seq }) { row ->
                    FlatCard(padding = 12.dp) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Badge(s.entityNames[row.entity] ?: row.entity, Tone.Warning)
                            Spacer(Modifier.width(8.dp))
                            Text(s.ago(row.createdAt), color = C.Muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
                            if (row.attempts > 0) Text("×${s.fmt.num(row.attempts)}", color = C.Faint, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
}
