package com.onukrom.app

import com.onukrom.app.core.Fmt
import com.onukrom.app.core.Geo
import com.onukrom.app.core.Ulid
import com.onukrom.app.data.Pricing
import com.onukrom.app.data.db.PriceItemEntity
import com.onukrom.app.data.db.ProductEntity
import com.onukrom.app.data.db.RouteEntity
import com.onukrom.app.data.db.ShopEntity
import com.onukrom.app.location.Fix
import com.onukrom.app.location.FixPicker
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CoreTest {
    @Test
    fun ulids_are_26_chars_unique_and_time_ordered() {
        val a = Ulid.next()
        Thread.sleep(2)
        val b = Ulid.next()
        assertEquals(26, a.length)
        assertTrue(a.all { it in "0123456789abcdefghjkmnpqrstvwxyz" })
        assertTrue(a < b)
        assertEquals(1000, List(1000) { Ulid.next() }.toSet().size)
    }

    @Test
    fun money_uses_south_asian_grouping_and_bangla_digits() {
        assertEquals("৳12,34,567", Fmt(false).money(123456700L))
        assertEquals("৳১২,৩৪,৫৬৭", Fmt(true).money(123456700L))
        assertEquals("৳999.50", Fmt(false).money(99950L))
        assertEquals("৳0", Fmt(false).money(0L))
    }

    @Test
    fun quantity_is_split_into_cartons_and_pieces() {
        val f = Fmt(false)
        assertEquals("2 ctn 4 pcs", f.qty(28, 12, "ctn", "pcs"))
        assertEquals("3 ctn", f.qty(36, 12, "ctn", "pcs"))
        assertEquals("5 pcs", f.qty(5, 12, "ctn", "pcs"))
        assertEquals("7 pcs", f.qty(7, 1, "ctn", "pcs"))
    }

    @Test
    fun price_follows_shop_type_then_route_then_default() {
        val product = ProductEntity("p1", null, "FC-250", "Face cream", null, null, 12, 15000, 12000, true)
        val routes = listOf(RouteEntity("r1", "Mirpur-10", "MR-10", "sat,tue"))
        val shop = ShopEntity("s1", "r1", null, "Shop", null, null, null, "pharmacy", null, null, 0, 0, "active", null)
        val items = listOf(
            PriceItemEntity("l1", "area", "Mirpur-10", "p1", 11500),
            PriceItemEntity("l2", "shop_category", "pharmacy", "p1", 11000),
        )
        assertEquals(11000L, Pricing(items, routes).priceFor(shop, product))
        assertEquals(11500L, Pricing(items, routes).priceFor(shop.copy(category = "grocery"), product))
        assertEquals(12000L, Pricing(items, routes).priceFor(shop.copy(category = "grocery", routeId = null), product))
    }

    @Test
    fun distance_matches_the_server_formula() {
        // ~1.11 km per 0.01° of latitude
        assertNear(1112, Geo.distanceM(23.8069, 90.3687, 23.8169, 90.3687), 2)
    }

    private fun assertNear(expected: Int, actual: Int, delta: Int) = assertTrue("$actual not within $delta of $expected", kotlin.math.abs(expected - actual) <= delta)

    @Test
    fun fix_picker_prefers_a_fresh_accurate_fix() {
        val now = System.currentTimeMillis()
        val picker = FixPicker(maxAccuracy = 50, maxAgeSec = 60)
        picker.offer(Fix(23.8, 90.3, 120f, now, false))
        assertFalse(picker.good())
        picker.offer(Fix(23.8, 90.3, 80f, now, false))
        assertAcc(80f, picker.best!!.accuracy)
        picker.offer(Fix(23.8, 90.3, 200f, now, false)) // worse — ignored
        assertAcc(80f, picker.best!!.accuracy)
        picker.offer(Fix(23.8, 90.3, 12f, now, false))
        assertTrue(picker.good())
    }

    private fun assertAcc(expected: Float, actual: Float) = org.junit.Assert.assertEquals(expected, actual, 0.01f)
}
