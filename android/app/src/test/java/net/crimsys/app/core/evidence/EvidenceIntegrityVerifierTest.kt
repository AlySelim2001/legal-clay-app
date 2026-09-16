package net.crimsys.app.core.evidence

import java.io.File
import java.nio.file.Files
import net.crimsys.app.domain.evidence.ChainAction
import net.crimsys.app.domain.evidence.ChainEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EvidenceIntegrityVerifierTest {

    private val json = kotlinx.serialization.json.Json

    private fun tempFile(
        bytes: ByteArray,
    ): File = Files.createTempFile("crimsys-rt", ".bin").toFile().apply {
        writeBytes(bytes)
        deleteOnExit()
    }

    private fun eventsJson(
        events: List<ChainEvent>,
    ): String = json.encodeToString(
        kotlinx.serialization.builtins.ListSerializer(ChainEvent.serializer()),
        events,
    )

    private fun capturedChain(
        originalHash: String,
        withOcr: Boolean,
    ): List<ChainEvent> {
        val genesis =
            ChainEventHasher.create(
                ChainAction.CAPTURED,
                1_700_000_000_000,
                null,
                originalHash,
            )
        return if (withOcr) {
            listOf(
                genesis,
                ChainEventHasher.create(
                    ChainAction.OCR_PROCESSED,
                    1_700_000_000_001,
                    genesis.currentHash,
                    "b".repeat(64),
                ),
            )
        } else {
            listOf(genesis)
        }
    }

    // ── Hash verification (red-team: tamper & compare) ───────────────────

    @Test
    fun `intact file verifies against stored hash`() {
        val file = tempFile("عهدة الأدلة".toByteArray(Charsets.UTF_8))
        val stored = file.inputStream().use { Sha256.digest(it) }

        val verdict = EvidenceIntegrityVerifier.verifyHash(file, stored)

        assertEquals(
            EvidenceIntegrityVerifier.HashVerdict.Intact::class,
            verdict::class,
        )
    }

    @Test
    fun `tampered file is detected by re-derivation`() {
        // THE red-team scenario: modify the immutable copy, then compare the
        // stored hash with the current file bytes. Verdict must be Tampered.
        val file = tempFile("المستند الأصلي".toByteArray(Charsets.UTF_8))
        val stored = file.inputStream().use { Sha256.digest(it) }
        file.appendBytes("TAMPERED".toByteArray(Charsets.UTF_8))

        val verdict = EvidenceIntegrityVerifier.verifyHash(file, stored)

        val tampered = verdict as EvidenceIntegrityVerifier.HashVerdict.Tampered
        assertEquals(stored, tampered.stored)
        assertTrue(tampered.actual != stored)
    }

    @Test
    fun `missing immutable copy is treated as tampering`() {
        val file = tempFile("x".toByteArray())
        val stored = file.inputStream().use { Sha256.digest(it) }
        file.delete()

        assertEquals(
            EvidenceIntegrityVerifier.HashVerdict.Missing::class,
            EvidenceIntegrityVerifier.verifyHash(file, stored)::class,
        )
    }

    // ── Chain replay ──────────────────────────────────────────────────────

    @Test
    fun `valid chain replays clean`() {
        val original = "a".repeat(64)

        val verdict = EvidenceIntegrityVerifier.replayChain(
            eventsJson(capturedChain(original, withOcr = true)),
            original,
        )

        assertEquals(EvidenceIntegrityVerifier.ChainVerdict.Valid, verdict)
    }

    @Test
    fun `swapped stored original hash breaks the genesis anchor`() {
        // Attacker rewrites the originalFileHash column but keeps the old
        // custody metadata: the genesis event no longer recomputes from the
        // (new) stored hash.
        val realOriginal = "a".repeat(64)
        val forged = "f".repeat(64)

        val verdict = EvidenceIntegrityVerifier.replayChain(
            eventsJson(capturedChain(realOriginal, withOcr = false)),
            forged,
        )

        assertEquals(
            EvidenceIntegrityVerifier.ChainVerdict.InvalidGenesis::class,
            verdict::class,
        )
    }

    @Test
    fun `reordered events break the link`() {
        val original = "a".repeat(64)
        val events = capturedChain(original, withOcr = true)

        val verdict = EvidenceIntegrityVerifier.replayChain(
            eventsJson(listOf(events[1], events[0])),
            original,
        )

        assertEquals(
            EvidenceIntegrityVerifier.ChainVerdict.BrokenLink::class,
            verdict::class,
        )
    }

    @Test
    fun `injected event with foreign link is detected`() {
        val original = "a".repeat(64)
        val genesis = capturedChain(original, withOcr = false).single()

        // Lazy forgery: an event whose previousHash does not match the chain.
        val forged = ChainEvent(
            action = ChainAction.EXPORTED,
            timestampEpochMillis = 1_700_000_000_002,
            previousHash = "e".repeat(64),
            currentHash = "deadbeef".repeat(8),
        )

        val verdict = EvidenceIntegrityVerifier.replayChain(
            eventsJson(listOf(genesis, forged)),
            original,
        )

        assertEquals(
            EvidenceIntegrityVerifier.ChainVerdict.BrokenLink::class,
            verdict::class,
        )
    }

    @Test
    fun `non-captured genesis is rejected`() {
        val original = "a".repeat(64)
        val orphan = ChainEventHasher.create(
            ChainAction.OCR_PROCESSED,
            1_700_000_000_000,
            null,
            original,
        )

        val verdict = EvidenceIntegrityVerifier.replayChain(
            eventsJson(listOf(orphan)),
            original,
        )

        assertEquals(
            EvidenceIntegrityVerifier.ChainVerdict.InvalidGenesis::class,
            verdict::class,
        )
    }

    @Test
    fun `empty chain is rejected`() {
        val verdict = EvidenceIntegrityVerifier.replayChain(
            "[]",
            "a".repeat(64),
        )

        assertEquals(
            EvidenceIntegrityVerifier.ChainVerdict.InvalidGenesis::class,
            verdict::class,
        )
    }

    @Test
    fun `corrupt custody json is rejected`() {
        val verdict = EvidenceIntegrityVerifier.replayChain(
            "{not json",
            "a".repeat(64),
        )

        assertEquals(
            EvidenceIntegrityVerifier.ChainVerdict.Corrupt::class,
            verdict::class,
        )
    }
}
