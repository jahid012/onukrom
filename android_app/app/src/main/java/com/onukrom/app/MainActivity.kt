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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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

    override fun onResume() {
        super.onResume()
        val container = (application as OnukromApp).container
        if (container.session.current.loggedIn) container.syncSoon()
    }
}
