package com.onukrom.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/* Flat UI: one brand colour, white cards with thin borders, no shadows.
 * Light only — easier to read outdoors in the sun. */
object C {
    val Primary = Color(0xFF0E7C66)
    val PrimaryDark = Color(0xFF0A5E4E)
    val PrimarySoft = Color(0xFFE3F2EE)
    val Bg = Color(0xFFF4F6F5)
    val Card = Color.White
    val Border = Color(0xFFE1E5E3)
    val Text = Color(0xFF16201D)
    val Muted = Color(0xFF5E6B67)
    val Faint = Color(0xFF8A9692)
    val Warning = Color(0xFFB86E00)
    val WarningSoft = Color(0xFFFFF3DC)
    val Danger = Color(0xFFC6362D)
    val DangerSoft = Color(0xFFFDE8E6)
    val Info = Color(0xFF2A78D6)
    val InfoSoft = Color(0xFFE6F0FC)
    val Success = Color(0xFF0A8A6C)
    val SuccessSoft = Color(0xFFE1F5EE)
    val Neutral = Color(0xFF66706D)
    val NeutralSoft = Color(0xFFEDF0EF)
}

private val colors = lightColorScheme(
    primary = C.Primary,
    onPrimary = Color.White,
    primaryContainer = C.PrimarySoft,
    onPrimaryContainer = C.PrimaryDark,
    secondary = C.Primary,
    onSecondary = Color.White,
    secondaryContainer = C.PrimarySoft,
    onSecondaryContainer = C.PrimaryDark,
    background = C.Bg,
    onBackground = C.Text,
    surface = C.Card,
    onSurface = C.Text,
    surfaceVariant = C.NeutralSoft,
    onSurfaceVariant = C.Muted,
    surfaceContainer = C.Card,
    surfaceContainerLow = C.Card,
    surfaceContainerHigh = C.Card,
    surfaceContainerHighest = C.NeutralSoft,
    outline = C.Border,
    outlineVariant = C.Border,
    error = C.Danger,
    errorContainer = C.DangerSoft,
)

private val type = Typography(
    headlineSmall = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Bold, lineHeight = 30.sp),
    titleLarge = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.SemiBold, lineHeight = 28.sp),
    titleMedium = TextStyle(fontSize = 17.sp, fontWeight = FontWeight.SemiBold, lineHeight = 24.sp),
    titleSmall = TextStyle(fontSize = 15.sp, fontWeight = FontWeight.SemiBold, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontSize = 15.sp, lineHeight = 22.sp),
    bodySmall = TextStyle(fontSize = 13.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
    labelMedium = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Medium),
    labelSmall = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium),
)

private val shapes = Shapes(
    extraSmall = androidx.compose.foundation.shape.RoundedCornerShape(6.dp),
    small = androidx.compose.foundation.shape.RoundedCornerShape(8.dp),
    medium = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
    large = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
)

@Composable
fun OnukromTheme(content: @Composable () -> Unit) {
    val typography = remember {
        val f = AppFonts.family
        Typography(
            headlineSmall = type.headlineSmall.copy(fontFamily = f),
            titleLarge = type.titleLarge.copy(fontFamily = f),
            titleMedium = type.titleMedium.copy(fontFamily = f),
            titleSmall = type.titleSmall.copy(fontFamily = f),
            bodyLarge = type.bodyLarge.copy(fontFamily = f),
            bodyMedium = type.bodyMedium.copy(fontFamily = f),
            bodySmall = type.bodySmall.copy(fontFamily = f),
            labelLarge = type.labelLarge.copy(fontFamily = f),
            labelMedium = type.labelMedium.copy(fontFamily = f),
            labelSmall = type.labelSmall.copy(fontFamily = f),
        )
    }
    MaterialTheme(colorScheme = colors, typography = typography, shapes = shapes, content = content)
}
