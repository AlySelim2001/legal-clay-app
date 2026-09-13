package net.crimsys.app.core.evidence

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ChainEventHasherTest {

    private val prev = ChainEventHasher.GENESIS_PREV

    @Test
    fun `genesis link is 64 hex zeros`() {
        assertEquals(64, ChainEventHasher.GENESIS_PREV.length)
        assertTrue(ChainEventHasher.GENESIS_PREV.all { it == '0' })
    }

    @Test
    fun `hashing is deterministic`() {
        val h1 = ChainEventHasher.hash(prev, "captured", 1_700_000_000_000, byteArrayOf(1, 2, 3))
        val h2 = ChainEventHasher.hash(prev, "captured", 1_700_000_000_000, byteArrayOf(1, 2, 3))
        assertEquals(h1, h2)
    }

    @Test
    fun `any changed segment changes the hash`() {
        val base = ChainEventHasher.hash(prev, "captured", 1_700_000_000_000, byteArrayOf(1))
        assertNotEquals(base, ChainEventHasher.hash(prev, "sealed", 1_700_000_000_000, byteArrayOf(1)))
        assertNotEquals(base, ChainEventHasher.hash(prev, "captured", 1_700_000_000_001, byteArrayOf(1)))
        assertNotEquals(base, ChainEventHasher.hash(prev, "captured", 1_700_000_000_000, byteArrayOf(2)))
        assertNotEquals(base, ChainEventHasher.hash(prev, "captured", 1_700_000_000_000, null))
        assertNotEquals(base, ChainEventHasher.hash(prev, "captured", 1_700_000_000_000, byteArrayOf(1)))
        // prev link participates — reordering two events is detectable:
        assertNotEquals(base, ChainEventHasher.hash(prev.dropLast(1) + "1", "captured", 1_700_000_000_000, byteArrayOf(1)))
    }

    @Test
    fun `length prefixes disambiguate segment boundaries`() {
        // Naive concatenation would make ("AB","C") and ("A","BC") identical:
        // "ABC" == "ABC". Length-prefixed hashing must separate them.
        val abC = ChainEventHasher.hash(prev, "AB", 42, byteArrayOf('C'.code.toByte()))
        val aBC = ChainEventHasher.hash(prev, "A", 42, byteArrayOf('B'.code.toByte(), 'C'.code.toByte()))
        assertNotEquals(abC, aBC)
    }

    @Test
    fun `rejects malformed prev hash`() {
        assertThrows(IllegalArgumentException::class.java) {
            ChainEventHasher.hash("tooshort", "captured", 42, null)
        }
    }

    @Test
    fun `chained links verify end to end`() {
        var link = prev
        val events = listOf("captured", "hash_verified", "exported").mapIndexed { i, kind ->
            val h = ChainEventHasher.hash(link, kind, 1_700_000_000_000L + i, null)
            link = h
            h
        }
        assertEquals(3, events.toSet().size)
    }
}
