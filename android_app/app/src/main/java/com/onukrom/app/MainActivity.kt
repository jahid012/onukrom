package com.onukrom.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.material3.SnackbarHostState
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import com.onukrom.app.i18n.Bn
import com.onukrom.app.i18n.En
import com.onukrom.app.i18n.LocalStrings
import com.onukrom.app.ui.AppRoot
import com.onukrom.app.ui.components.LocalSnackbar
import com.onukrom.app.ui.theme.OnukromTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(statusBarStyle = SystemBarStyle.light(android.graphics.Color.WHITE, android.graphics.Color.WHITE))
        val container = (application as OnukromApp).container

        // While the app is on screen: sync when it opens, then every few minutes.
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (true) {
                    container.syncSoon()
                    delay(FOREGROUND_SYNC_MS)
                }
            }
        }

        setContent {
            val session by container.session.state.collectAsStateWithLifecycle()
            val snackbar = remember { SnackbarHostState() }
            CompositionLocalProvider(
                LocalContainer provides container,
                LocalStrings provides if (session.locale == "en") En else Bn,
                LocalSnackbar provides snackbar,
            ) {
                OnukromTheme { AppRoot(session) }
            }
        }
    }

    private companion object {
        const val FOREGROUND_SYNC_MS = 5 * 60 * 1000L
    }
}
