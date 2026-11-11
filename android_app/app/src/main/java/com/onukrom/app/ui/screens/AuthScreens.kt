package com.onukrom.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Apartment
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.onukrom.app.LocalContainer
import com.onukrom.app.data.SessionState
import com.onukrom.app.data.api.ApiException
import com.onukrom.app.i18n.LocalStrings
import com.onukrom.app.ui.components.BigButton
import com.onukrom.app.ui.components.Chips
import com.onukrom.app.ui.components.Field
import com.onukrom.app.ui.components.Notice
import com.onukrom.app.ui.components.Tone
import com.onukrom.app.ui.theme.C
import kotlinx.coroutines.launch

@Composable
private fun AuthLayout(title: String, subtitle: String, content: @Composable () -> Unit) {
    val container = LocalContainer.current
    val s = LocalStrings.current
    val scope = rememberCoroutineScope()
    Column(
        Modifier.fillMaxSize().background(C.Bg).systemBarsPadding().imePadding().verticalScroll(rememberScrollState()).padding(20.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            Chips(
                options = listOf("bn" to "বাংলা", "en" to "English"),
                selected = if (s.bangla) "bn" else "en",
                onSelect = { scope.launch { container.session.setLocale(it) } },
            )
        }
        Spacer(Modifier.height(40.dp))
        Text("Onukrom", color = C.Primary, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(12.dp))
        Text(title, style = MaterialTheme.typography.headlineSmall)
        Spacer(Modifier.height(4.dp))
        Text(subtitle, color = C.Muted)
        Spacer(Modifier.height(28.dp))
        content()
    }
}

@Composable
fun CompanyScreen() {
    val container = LocalContainer.current
    val s = LocalStrings.current
    val scope = rememberCoroutineScope()
    var code by rememberSaveable { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    AuthLayout(s.companyTitle, s.companyHint) {
        Field(code, { code = it.trim(); error = null }, s.companyCode, error = error, placeholder = "rahimtraders")
        Spacer(Modifier.height(16.dp))
        BigButton(s.next, loading = busy, enabled = code.length >= 2, onClick = {
            scope.launch {
                busy = true
                try {
                    container.lookup(code)
                } catch (e: ApiException) {
                    error = if (e.isNetwork) s.noInternet else s.error(e.code, e.message)
                } finally {
                    busy = false
                }
            }
        })
    }
}

@Composable
fun LoginScreen(session: SessionState) {
    val container = LocalContainer.current
    val s = LocalStrings.current
    val scope = rememberCoroutineScope()
    var phone by rememberSaveable { mutableStateOf(session.me?.user?.phone ?: "") }
    var password by rememberSaveable { mutableStateOf("") }
    var show by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    AuthLayout(s.loginTitle, session.companyName ?: "") {
        if (session.expired) {
            Notice(s.sessionExpired, Tone.Warning); Spacer(Modifier.height(16.dp))
        }
        Field(phone, { phone = it; error = null }, s.phone, keyboard = KeyboardType.Phone, placeholder = "01XXXXXXXXX")
        Spacer(Modifier.height(8.dp))
        Field(
            password, { password = it; error = null }, s.password,
            keyboard = KeyboardType.Password,
            visual = if (show) VisualTransformation.None else PasswordVisualTransformation(),
            placeholder = s.passwordHint,
            trailing = {
                IconButton(onClick = { show = !show }) { Icon(if (show) Icons.Default.VisibilityOff else Icons.Default.Visibility, null) }
            },
        )
        if (error != null) {
            Spacer(Modifier.height(8.dp)); Notice(error!!, Tone.Danger)
        }
        Spacer(Modifier.height(16.dp))
        BigButton(s.login, loading = busy, enabled = phone.length >= 10 && password.isNotEmpty(), onClick = {
            scope.launch {
                busy = true
                try {
                    container.login(phone, password)
                } catch (e: ApiException) {
                    error = if (e.isNetwork) s.noInternet else s.error(e.code, e.message)
                } finally {
                    busy = false
                }
            }
        })
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Default.Apartment, null, tint = C.Muted, modifier = Modifier.size(18.dp))
            Text(" ${session.companyCode}", color = C.Muted, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
            TextButton(onClick = { scope.launch { container.session.clearCompany() } }) { Text(s.changeCompany) }
        }
    }
}
