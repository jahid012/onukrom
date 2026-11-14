package com.onukrom.app.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.CloudUpload
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sync
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.onukrom.app.LocalContainer
import com.onukrom.app.i18n.LocalStrings
import com.onukrom.app.ui.theme.C
import com.onukrom.app.ui.theme.Corners
import kotlinx.coroutines.launch

/** App-wide snackbar for short "saved" messages. */
val LocalSnackbar = staticCompositionLocalOf { SnackbarHostState() }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Screen(
    title: String,
    onBack: (() -> Unit)? = null,
    subtitle: String? = null,
    actions: @Composable RowScope.() -> Unit = {},
    bottomBar: @Composable () -> Unit = {},
    floating: @Composable () -> Unit = {},
    /** Pull down anywhere on the page to sync with the server (off for the map). */
    refresh: Boolean = true,
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        containerColor = C.Bg,
        contentWindowInsets = WindowInsets(0),
        topBar = {
            Column {
                TopAppBar(
                    title = {
                        Column {
                            Text(title, style = MaterialTheme.typography.titleLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = C.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    },
                    navigationIcon = {
                        if (onBack != null) IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, LocalStrings.current.back) }
                    },
                    actions = actions,
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = C.Card),
                    windowInsets = TopAppBarDefaults.windowInsets,
                )
                HorizontalDivider(color = C.Border)
            }
        },
        bottomBar = bottomBar,
        floatingActionButton = floating,
        content = { pad ->
            if (refresh) {
                SyncRefresh(Modifier.padding(pad).fillMaxSize()) { content(PaddingValues(0.dp)) }
            } else {
                content(pad)
            }
        },
    )
}

@Composable
fun FlatCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    color: Color = C.Card,
    border: Color = C.Border,
    padding: Dp = 14.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = Corners.Card,
        color = color,
        border = BorderStroke(1.dp, border),
        onClick = onClick ?: {},
        enabled = onClick != null,
    ) {
        Column(Modifier.padding(padding), content = content)
    }
}

@Composable
fun BigButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null,
    color: Color = C.Primary,
    loading: Boolean = false,
) {
    Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.fillMaxWidth().height(54.dp),
        shape = Corners.Control,
        colors = ButtonDefaults.buttonColors(containerColor = color, disabledContainerColor = C.Border, disabledContentColor = C.Faint),
        elevation = null,
    ) {
        if (loading) {
            CircularProgressIndicator(Modifier.size(22.dp), color = Color.White, strokeWidth = 2.dp)
        } else {
            if (icon != null) {
                Icon(icon, null, Modifier.size(22.dp)); Spacer(Modifier.width(8.dp))
            }
            Text(text, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
fun OutlineButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, icon: ImageVector? = null, color: Color = C.Primary, enabled: Boolean = true) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(50.dp),
        shape = Corners.Control,
        border = BorderStroke(1.dp, if (enabled) color.copy(alpha = .5f) else C.Border),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = color),
    ) {
        if (icon != null) {
            Icon(icon, null, Modifier.size(20.dp)); Spacer(Modifier.width(6.dp))
        }
        Text(text, style = MaterialTheme.typography.labelLarge, maxLines = 1)
    }
}

enum class Tone(val fg: Color, val bg: Color) {
    Primary(C.Primary, C.PrimarySoft),
    Success(C.Success, C.SuccessSoft),
    Warning(C.Warning, C.WarningSoft),
    Danger(C.Danger, C.DangerSoft),
    Info(C.Info, C.InfoSoft),
    Neutral(C.Neutral, C.NeutralSoft),
}

@Composable
fun Badge(text: String, tone: Tone, modifier: Modifier = Modifier, icon: ImageVector? = null) {
    Row(
        modifier.background(tone.bg, Corners.Small).padding(horizontal = 10.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            Icon(icon, null, Modifier.size(14.dp), tint = tone.fg); Spacer(Modifier.width(4.dp))
        }
        Text(text, color = tone.fg, style = MaterialTheme.typography.labelMedium, maxLines = 1)
    }
}

fun orderTone(status: String) = when (status) {
    "pending" -> Tone.Warning
    "approved" -> Tone.Info
    "dispatched" -> Tone.Primary
    "delivered", "partially_delivered" -> Tone.Success
    "failed", "rejected" -> Tone.Danger
    else -> Tone.Neutral
}

/** + / − buttons big enough for a thumb, with the number in the middle. */
@Composable
fun Stepper(value: Int, onChange: (Int) -> Unit, label: String, modifier: Modifier = Modifier, max: Int = 99999) {
    val fmt = LocalStrings.current.fmt
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        StepButton(Icons.Default.Remove, enabled = value > 0) { onChange((value - 1).coerceAtLeast(0)) }
        Column(Modifier.widthIn(min = 44.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(fmt.num(value), style = MaterialTheme.typography.titleMedium, color = if (value > 0) C.Text else C.Faint)
            Text(label, style = MaterialTheme.typography.labelSmall, color = C.Muted)
        }
        StepButton(Icons.Default.Add, enabled = value < max, filled = true) { onChange((value + 1).coerceAtMost(max)) }
    }
}

@Composable
private fun StepButton(icon: ImageVector, enabled: Boolean, filled: Boolean = false, onClick: () -> Unit) {
    Box(
        Modifier
            .size(42.dp)
            .clip(Corners.Control).background(if (!enabled) C.NeutralSoft else if (filled) C.Primary else C.PrimarySoft, Corners.Control)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, null, tint = if (!enabled) C.Faint else if (filled) Color.White else C.Primary)
    }
}

@Composable
fun Field(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    keyboard: KeyboardType = KeyboardType.Text,
    error: String? = null,
    placeholder: String? = null,
    singleLine: Boolean = true,
    visual: VisualTransformation = VisualTransformation.None,
    trailing: @Composable (() -> Unit)? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it, color = C.Faint) } },
        modifier = modifier.fillMaxWidth(),
        singleLine = singleLine,
        isError = error != null,
        supportingText = error?.let { { Text(it) } },
        keyboardOptions = KeyboardOptions(keyboardType = keyboard),
        visualTransformation = visual,
        trailingIcon = trailing,
        shape = Corners.Control,
        colors = OutlinedTextFieldDefaults.colors(unfocusedBorderColor = C.Border, focusedContainerColor = C.Card, unfocusedContainerColor = C.Card),
    )
}

@Composable
fun SearchBox(value: String, onChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        placeholder = { Text(placeholder, color = C.Faint) },
        leadingIcon = { Icon(Icons.Default.Search, null, tint = C.Muted) },
        trailingIcon = if (value.isNotEmpty()) {
            { IconButton(onClick = { onChange("") }) { Icon(Icons.Default.Close, null) } }
        } else null,
        singleLine = true,
        modifier = modifier.fillMaxWidth(),
        shape = Corners.Control,
        colors = OutlinedTextFieldDefaults.colors(unfocusedBorderColor = C.Border, focusedContainerColor = C.Card, unfocusedContainerColor = C.Card),
    )
}

/** A row of choices that scrolls sideways (categories, routes, reasons…). */
@Composable
fun <T> Chips(options: List<Pair<T, String>>, selected: T?, onSelect: (T) -> Unit, modifier: Modifier = Modifier) {
    Row(modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { (value, label) ->
            val on = value == selected
            Box(
                Modifier
                    .clip(Corners.Chip).background(if (on) C.Primary else C.Card, Corners.Chip)
                    .border(1.dp, if (on) C.Primary else C.Border, Corners.Chip)
                    .clickable { onSelect(value) }
                    .padding(horizontal = 14.dp, vertical = 8.dp),
            ) {
                Text(label, color = if (on) Color.White else C.Text, style = MaterialTheme.typography.labelMedium)
            }
        }
    }
}

/** Big choice tiles, one per row, used for reasons and delivery result. */
@Composable
fun ChoiceList(options: List<Pair<String, String>>, selected: String?, onSelect: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { (value, label) ->
            val on = value == selected
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(Corners.Control).background(if (on) C.PrimarySoft else C.Card, Corners.Control)
                    .border(if (on) 2.dp else 1.dp, if (on) C.Primary else C.Border, Corners.Control)
                    .clickable { onSelect(value) }
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier.size(20.dp).border(2.dp, if (on) C.Primary else C.Faint, CircleShape).padding(4.dp)
                        .background(if (on) C.Primary else Color.Transparent, CircleShape),
                )
                Spacer(Modifier.width(12.dp))
                Text(label, style = MaterialTheme.typography.bodyLarge, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal)
            }
        }
    }
}

@Composable
fun Empty(icon: ImageVector, text: String, modifier: Modifier = Modifier, fill: Boolean = false, action: (@Composable () -> Unit)? = null) {
    // fill = true when it is the whole page body (not inside a list), so pull-to-refresh still works.
    val outer = if (fill) modifier.fillMaxSize().verticalScroll(rememberScrollState()) else modifier
    Column(outer.fillMaxWidth().padding(vertical = 48.dp, horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(64.dp).background(C.NeutralSoft, CircleShape), contentAlignment = Alignment.Center) {
            Icon(icon, null, Modifier.size(32.dp), tint = C.Faint)
        }
        Spacer(Modifier.height(12.dp))
        Text(text, color = C.Muted, textAlign = TextAlign.Center)
        if (action != null) {
            Spacer(Modifier.height(16.dp)); action()
        }
    }
}

@Composable
fun Loading() {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = C.Primary) }
}

@Composable
fun KeyValue(key: String, value: String, valueColor: Color = C.Text, bold: Boolean = false) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(key, color = C.Muted, modifier = Modifier.weight(1f))
        Text(value, color = valueColor, fontWeight = if (bold) FontWeight.Bold else FontWeight.Medium)
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier, trailing: @Composable (() -> Unit)? = null) {
    Row(modifier.fillMaxWidth().padding(top = 8.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text, style = MaterialTheme.typography.titleSmall, color = C.Muted, modifier = Modifier.weight(1f))
        trailing?.invoke()
    }
}

@Composable
fun Notice(text: String, tone: Tone, icon: ImageVector = Icons.Default.ErrorOutline, action: (@Composable () -> Unit)? = null) {
    Row(
        Modifier.fillMaxWidth().background(tone.bg, Corners.Control).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = tone.fg, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(10.dp))
        Text(text, color = tone.fg, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        action?.invoke()
    }
}

/** Sync state in one line: offline / sending / waiting / all done. */
@Composable
fun SyncBar(online: Boolean, running: Boolean, pending: Int, failed: Int, lastSyncAt: Long, onSync: () -> Unit, onOpen: () -> Unit) {
    val s = LocalStrings.current
    val (tone, icon, text) = when {
        failed > 0 -> Triple(Tone.Danger, Icons.Default.ErrorOutline, s.failedCount(failed))
        !online -> Triple(Tone.Warning, Icons.Default.CloudOff, if (pending > 0) s.pendingCount(pending) + " · " + s.offline else s.offline)
        running -> Triple(Tone.Info, Icons.Default.Sync, s.syncing)
        pending > 0 -> Triple(Tone.Warning, Icons.Default.CloudUpload, s.pendingCount(pending))
        else -> Triple(Tone.Success, Icons.Default.CloudDone, s.synced)
    }
    Row(
        Modifier.fillMaxWidth().clip(Corners.Control).background(tone.bg, Corners.Control).clickable(onClick = onOpen).padding(start = 12.dp, top = 6.dp, bottom = 6.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = tone.fg, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(text, color = tone.fg, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
            Text("${s.lastSync}: ${s.ago(lastSyncAt)}", color = tone.fg.copy(alpha = .8f), style = MaterialTheme.typography.bodySmall)
        }
        if (online && !running) TextButton(onClick = onSync) { Text(s.syncNow, color = tone.fg) }
        if (running) CircularProgressIndicator(Modifier.padding(12.dp).size(20.dp), color = tone.fg, strokeWidth = 2.dp)
    }
}

/**
 * Pull down to send what is waiting and fetch the latest from the server.
 * Replaces the always-on sync banner; the spinner shows only while pulling.
 * Built into [Screen], so every page has it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SyncRefresh(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    val c = LocalContainer.current
    val s = LocalStrings.current
    val snackbar = LocalSnackbar.current
    val scope = rememberCoroutineScope()
    var refreshing by remember { mutableStateOf(false) }
    val state = rememberPullToRefreshState()
    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = {
            scope.launch {
                refreshing = true
                val ok = c.connectivity.online.value && runCatching { c.sync.run() }.isSuccess
                refreshing = false
                if (!ok) {
                    c.syncSoon() // keeps trying in the background
                    snackbar.showSnackbar(if (c.connectivity.online.value) s.syncFailed else s.offline)
                }
            }
        },
        modifier = modifier,
        state = state,
        indicator = {
            PullToRefreshDefaults.Indicator(
                state = state,
                isRefreshing = refreshing,
                modifier = Modifier.align(Alignment.TopCenter),
                containerColor = C.Card,
                color = C.Primary,
            )
        },
        content = content,
    )
}

/**
 * Only when the SR / DM must act: something the server refused, or work
 * waiting while offline. Everything fine → nothing is shown.
 */
@Composable
fun SyncAlert(online: Boolean, pending: Int, failed: Int, onOpen: () -> Unit) {
    val s = LocalStrings.current
    val (tone, icon, text) = when {
        failed > 0 -> Triple(Tone.Danger, Icons.Default.ErrorOutline, s.failedCount(failed))
        !online && pending > 0 -> Triple(Tone.Warning, Icons.Default.CloudOff, s.pendingCount(pending) + " · " + s.offline)
        else -> return
    }
    Row(
        Modifier.fillMaxWidth().clip(Corners.Control).background(tone.bg, Corners.Control).border(1.dp, tone.fg.copy(alpha = .3f), Corners.Control)
            .clickable(onClick = onOpen).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = tone.fg, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(10.dp))
        Text(text, color = tone.fg, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
    }
}

@Composable
fun BottomActionBar(content: @Composable RowScope.() -> Unit) {
    Column(Modifier.background(C.Card).navigationBarsPadding().imePadding()) {
        HorizontalDivider(color = C.Border)
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
    }
}

@Composable
fun Avatar(text: String, size: Dp = 44.dp, color: Color = C.PrimarySoft, fg: Color = C.Primary) {
    Box(Modifier.size(size).background(color, CircleShape), contentAlignment = Alignment.Center) {
        Text(text.trim().take(1).uppercase(), color = fg, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
    }
}
