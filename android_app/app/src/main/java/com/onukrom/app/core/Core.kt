package com.onukrom.app.core

import java.security.SecureRandom
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/** ULIDs are created on the phone, so a record keeps the same id offline and on the server. */
object Ulid {
    private const val ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"
    private val random = SecureRandom()

    fun next(): String {
        val out = CharArray(26)
        var time = System.currentTimeMillis()
        for (i in 9 downTo 0) {
            out[i] = ALPHABET[(time and 31).toInt()]
            time = time shr 5
        }
        val bytes = ByteArray(10).also(random::nextBytes)
        // 80 random bits → 16 base32 chars
        var buffer = 0L
        var bits = 0
        var pos = 10
        for (b in bytes) {
            buffer = (buffer shl 8) or (b.toLong() and 0xff)
            bits += 8
            while (bits >= 5) {
                bits -= 5
                out[pos++] = ALPHABET[((buffer shr bits) and 31).toInt()]
            }
        }
        return String(out)
    }
}

object Geo {
    /** Distance in metres (haversine) — same formula the server uses. */
    fun distanceM(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Int {
        val r = 6371000.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLng = Math.toRadians(lng2 - lng1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2) * sin(dLng / 2)
        return (r * 2 * atan2(sqrt(a), sqrt(1 - a))).roundToInt()
    }
}

object Time {
    private fun iso() = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }

    fun nowIso(): String = iso().format(Date())
    fun toIso(millis: Long): String = iso().format(Date(millis))

    fun parse(value: String?): Long? {
        if (value.isNullOrBlank()) return null
        val patterns = listOf("yyyy-MM-dd'T'HH:mm:ss.SSSX", "yyyy-MM-dd'T'HH:mm:ssX", "yyyy-MM-dd'T'HH:mm:ss.SSSXXX", "yyyy-MM-dd'T'HH:mm:ssXXX")
        for (p in patterns) {
            runCatching { return SimpleDateFormat(p, Locale.US).parse(value)?.time }
        }
        return null
    }

    fun startOfToday(): Long {
        val c = java.util.Calendar.getInstance()
        c.set(java.util.Calendar.HOUR_OF_DAY, 0)
        c.set(java.util.Calendar.MINUTE, 0)
        c.set(java.util.Calendar.SECOND, 0)
        c.set(java.util.Calendar.MILLISECOND, 0)
        return c.timeInMillis
    }

    fun dayKey(millis: Long = System.currentTimeMillis()): String = SimpleDateFormat("yyMMdd", Locale.US).format(Date(millis))
}

/** Numbers, money and dates in Bangla or English digits. Money is always integer paisa. */
class Fmt(val bangla: Boolean) {
    private val bnDigits = charArrayOf('০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯')

    fun digits(s: String): String = if (!bangla) s else buildString {
        for (c in s) append(if (c in '0'..'9') bnDigits[c - '0'] else c)
    }

    /** 1234567 → 12,34,567 (South-Asian grouping). */
    fun group(n: Long): String {
        val neg = n < 0
        val s = kotlin.math.abs(n).toString()
        if (s.length <= 3) return digits((if (neg) "-" else "") + s)
        val last3 = s.takeLast(3)
        var rest = s.dropLast(3)
        val parts = mutableListOf<String>()
        while (rest.length > 2) {
            parts.add(0, rest.takeLast(2)); rest = rest.dropLast(2)
        }
        if (rest.isNotEmpty()) parts.add(0, rest)
        return digits((if (neg) "-" else "") + parts.joinToString(",") + "," + last3)
    }

    fun num(n: Int): String = group(n.toLong())
    fun num(n: Long): String = group(n)

    /** Paisa → "৳১,২৩৪" (paisa shown only when not whole taka). */
    fun money(paisa: Long): String {
        val taka = paisa / 100
        val rem = kotlin.math.abs(paisa % 100)
        return "৳" + group(taka) + if (rem != 0L) digits("." + rem.toString().padStart(2, '0')) else ""
    }

    fun money(paisa: Int): String = money(paisa.toLong())

    /** Pieces → "2 ctn 4 pcs" using the pack size. */
    fun qty(pcs: Int, packSize: Int, ctn: String, pc: String): String {
        if (packSize <= 1) return "${num(pcs)} $pc"
        val c = pcs / packSize
        val p = pcs % packSize
        return when {
            c == 0 -> "${num(p)} $pc"
            p == 0 -> "${num(c)} $ctn"
            else -> "${num(c)} $ctn ${num(p)} $pc"
        }
    }

    fun time(millis: Long): String = digits(SimpleDateFormat("h:mm a", Locale.US).format(Date(millis)))
        .let { if (bangla) it.replace("AM", "এএম").replace("PM", "পিএম") else it }

    fun date(millis: Long): String = digits(SimpleDateFormat("d MMM, h:mm a", if (bangla) Locale.forLanguageTag("bn-BD") else Locale.US).format(Date(millis)))
}
