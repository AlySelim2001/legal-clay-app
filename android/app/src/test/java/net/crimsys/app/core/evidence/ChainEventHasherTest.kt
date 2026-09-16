package net.crimsys.app.core.evidence

import net.crimsys.app.domain.evidence.ChainAction
import net.crimsys.app.domain.evidence.ChainEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ChainEventHasherTest {

    private val content = "a".repeat(64)

    @Test
    fun `known answer - genesis event has empty previous segment`() {
        // Canonical: "CAPTURED|1700000000000||" + "a" * 64
        val event = ChainEventHasher.create(ChainAction.CAPTURED, 1_700_000_000_000, null, content)
        assertEquals(
            "491b7c687730356d62638410d133bc6054de1c1250dd5c0e332adab082d63a06",
            event.currentHash,
        )
    }

    @Test
    fun `known answer - linked event binds the previous hash`() {
        // Canonical: "OCR_PROCESSED|1700000000001|" + prev + "|" + content
        val prev = "61".repeat(32)
        val event = ChainEventHasher.create(ChainAction.OCR_PROCESSED, 1_700_000_000_001, prev, content)
        assertEquals(
            "b8c5486c6d61002837f3847f03c58fb2446458ce17ac530d3b1d9420da6bd784",
            event.currentHash,
        )
    }

    @Test
    fun `same inputs produce same hash`() {

        val first =
            ChainEventHasher.create(
                action =
                    ChainAction.CAPTURED,
                timestampEpochMillis =
                    1_000L,
                previousHash = null,
                contentHash =
                    "a".repeat(64),
            )

        val second =
            ChainEventHasher.create(
                action =
                    ChainAction.CAPTURED,
                timestampEpochMillis =
                    1_000L,
                previousHash = null,
                contentHash =
                    "a".repeat(64),
            )

        assertEquals(
            first.currentHash,
            second.currentHash,
        )
    }

    @Test
    fun `different parent changes chain`() {

        val first =
            ChainEventHasher.create(
                ChainAction.OCR_PROCESSED,
                1_000L,
                "a".repeat(64),
                "b".repeat(64),
            )

        val second =
            ChainEventHasher.create(
                ChainAction.OCR_PROCESSED,
                1_000L,
                "c".repeat(64),
                "b".repeat(64),
            )

        assertNotEquals(
            first.currentHash,
            second.currentHash,
        )
    }

    @Test
    fun `null and empty previousHash denote the same genesis link`() {
        val fromNull = ChainEventHasher.create(ChainAction.CAPTURED, 42L, null, content)
        val fromEmpty = ChainEventHasher.create(ChainAction.CAPTURED, 42L, "", content)
        assertEquals(fromNull.currentHash, fromEmpty.currentHash)
    }

    @Test
    fun `create returns the event fields intact`() {
        val event: ChainEvent =
            ChainEventHasher.create(ChainAction.EXPORTED, 1_700_000_000_000, null, content)
        assertEquals(ChainAction.EXPORTED, event.action)
        assertEquals(1_700_000_000_000, event.timestampEpochMillis)
        assertNull(event.previousHash)
        assertEquals(64, event.currentHash.length)
        assertTrue(event.currentHash.all { it in "0123456789abcdef" })
    }

    @Test
    fun `every canonical segment matters - action timestamp previous content`() {
        val base = ChainEventHasher.create(ChainAction.CAPTURED, 1_700_000_000_000, null, content)
        assertNotEquals(base.currentHash, ChainEventHasher.create(ChainAction.EXPORTED, 1_700_000_000_000, null, content).currentHash)
        assertNotEquals(base.currentHash, ChainEventHasher.create(ChainAction.CAPTURED, 1_700_000_000_001, null, content).currentHash)
        assertNotEquals(base.currentHash, ChainEventHasher.create(ChainAction.CAPTURED, 1_700_000_000_000, "b".repeat(64), content).currentHash)
        assertNotEquals(base.currentHash, ChainEventHasher.create(ChainAction.CAPTURED, 1_700_000_000_000, null, "c".repeat(64)).currentHash)
    }

    @Test
    fun `timestamps are string-encoded - not zero-padded`() {
        // The canonical string is the decimal rendering; 42 and 420 are
        // different segments ("42|" vs "420|"), so no prefix ambiguity.
        val a = ChainEventHasher.create(ChainAction.CAPTURED, 42L, null, content)
        val b = ChainEventHasher.create(ChainAction.CAPTURED, 420L, null, content)
        assertNotEquals(a.currentHash, b.currentHash)
    }

    @Test
    fun `linked chain produces distinct digests per position`() {
        var link: String? = null
        val digests = mutableListOf<String>()
        for (i in 0 until 10) {
            val event = ChainEventHasher.create(ChainAction.CAPTURED, 1_700_000_000_000L + i, link, content)
            digests.add(event.currentHash)
            link = event.currentHash
        }
        assertEquals(10, digests.toSet().size)
    }
}
