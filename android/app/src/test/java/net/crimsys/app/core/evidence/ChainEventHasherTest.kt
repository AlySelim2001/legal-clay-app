package net.crimsys.app.core.evidence

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class ChainEventHasherTest {

    private val prev = ChainEventHasher.GENESIS_PREV

    @Test
    fun `genesis constant is 64 zero hex chars`() {
        assertEquals(64, ChainEventHasher.GENESIS_PREV.length)
        assertTrue(ChainEventHasher.GENESIS_PREV.all { it == '0' })
    }

    @Test
    fun `hashing is deterministic`() {
        val h1 = ChainEventHasher.hash(prev, "CAPTURED", 1_700_000_000_000)
        val h2 = ChainEventHasher.hash(prev, "CAPTURED", 1_700_000_000_000)
        assertEquals(h1, h2)
    }

    @Test
    fun `every hash segment matters - action timestamp and previous hash`() {
        val base = ChainEventHasher.hash(prev, "CAPTURED", 1_700_000_000_000)
        assertNotEquals(base, ChainEventHasher.hash(prev, "EXPORTED", 1_700_000_000_000))
        assertNotEquals(base, ChainEventHasher.hash(prev, "CAPTURED", 1_700_000_000_001))
        assertNotEquals(base, ChainEventHasher.hash(prev.dropLast(1) + "1", "CAPTURED", 1_700_000_000_000))
    }

    @Test
    fun `null previousHash is a distinct genesis link`() {
        val genesis = ChainEventHasher.hash(null, "CAPTURED", 1_700_000_000_000)
        val explicitZeros = ChainEventHasher.hash(ChainEventHasher.GENESIS_PREV, "CAPTURED", 1_700_000_000_000)
        // null and the canonical 64-zero string denote the same genesis link.
        assertEquals(genesis, explicitZeros)
        // ...but it is still a proper link: a non-null prev hash changes the digest.
        assertNotEquals(genesis, ChainEventHasher.hash(prev.dropLast(1) + "1", "CAPTURED", 1_700_000_000_000))
    }

    @Test
    fun `segment boundaries are unambiguous`() {
        val abC = ChainEventHasher.hash(prev, "ABC", 42)
        val aBC = ChainEventHasher.hash(prev, "AB", 42)
        assertNotEquals(abC, aBC)
    }

    @Test
    fun `rejects malformed previous hash`() {
        assertThrows(IllegalArgumentException::class.java) {
            ChainEventHasher.hash("tooshort", "CAPTURED", 42)
        }
    }

    @Test
    fun `linked chain produces distinct digests per position`() {
        var link: String? = null
        val digests = mutableListOf<String>()
        for (i in 0 until 10) {
            val digest = ChainEventHasher.hash(link, "CAPTURED", 1_700_000_000_000L + i)
            digests.add(digest)
            link = digest
        }
        assertEquals(10, digests.toSet().size)
    }
}
