package com.onukrom.app.ui.theme

import android.content.Context
import android.graphics.fonts.Font
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.compose.ui.text.font.AndroidFont
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontLoadingStrategy
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import com.onukrom.app.R
import android.graphics.Typeface as AndroidTypeface
import android.graphics.fonts.FontFamily as AndroidFontFamily
import android.graphics.fonts.FontStyle as AndroidFontStyle
import androidx.compose.ui.text.font.Font as ComposeFont

/**
 * Same order as the admin panel's CSS stack:
 *   Roboto → SolaimanLipi → system fonts.
 * Roboto has no Bangla letters, so Bangla falls through to SolaimanLipi and
 * English stays in Roboto — even inside one line ("Rahim Traders · ৳১,২০০").
 */
object AppFonts {
    private val weights = listOf(FontWeight.Normal, FontWeight.Medium, FontWeight.SemiBold, FontWeight.Bold)

    val family: FontFamily by lazy {
        if (Build.VERSION.SDK_INT >= 29) {
            FontFamily(weights.map { FallbackFont(it) })
        } else {
            // Android 9 and older: Roboto, Bangla from the phone's own font.
            FontFamily(
                ComposeFont(R.font.roboto_400, FontWeight.Normal),
                ComposeFont(R.font.roboto_500, FontWeight.Medium),
                ComposeFont(R.font.roboto_600, FontWeight.SemiBold),
                ComposeFont(R.font.roboto_700, FontWeight.Bold),
            )
        }
    }

    private val cache = HashMap<Int, AndroidTypeface>()

    /** One platform typeface per weight: Roboto first, SolaimanLipi for Bangla, then the system. */
    @RequiresApi(29)
    @Synchronized
    fun typeface(context: Context, weight: Int): AndroidTypeface = cache.getOrPut(weight) {
        val res = context.resources
        fun font(id: Int, w: Int) = Font.Builder(res, id).setWeight(w).build()

        val roboto = AndroidFontFamily.Builder(font(R.font.roboto_400, 400))
            .addFont(font(R.font.roboto_500, 500))
            .addFont(font(R.font.roboto_600, 600))
            .addFont(font(R.font.roboto_700, 700))
            .build()
        val solaimanLipi = AndroidFontFamily.Builder(font(R.font.solaimanlipi_regular, 400))
            .addFont(font(R.font.solaimanlipi_bold, 700))
            .build()

        AndroidTypeface.CustomFallbackBuilder(roboto)
            .addCustomFallback(solaimanLipi)
            .setSystemFallback("sans-serif")
            .setStyle(AndroidFontStyle(weight, AndroidFontStyle.FONT_SLANT_UPRIGHT))
            .build()
    }

    private object Loader : AndroidFont.TypefaceLoader {
        override fun loadBlocking(context: Context, font: AndroidFont): AndroidTypeface? =
            if (Build.VERSION.SDK_INT >= 29) runCatching { typeface(context, font.weight.weight) }.getOrNull() else null

        override suspend fun awaitLoad(context: Context, font: AndroidFont): AndroidTypeface? = loadBlocking(context, font)
    }

    private class FallbackFont(override val weight: FontWeight) :
        AndroidFont(FontLoadingStrategy.Blocking, Loader, FontVariation.Settings()) {
        override val style: FontStyle = FontStyle.Normal
    }
}
