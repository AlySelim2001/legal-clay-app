package net.crimsys.app.core.evidence

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream

/**
 * Hash-linking for the evidence chain of custody.
 *
 * Each event's digest is `SHA-256(prevHash ‖ action ‖ timestamp)` with every
 * segment length-prefixed (4-byte big-endian) before hashing so concatenation
 * is unambiguous — `("AB","C")` can never collide with `("A","BC")`.
 *
 * Consequences (deliberate):
 *  - Any single-bit change to an event, or reordering of two events, breaks
 *    every link after it — tampering is detectable, not preventable.
 *  - The first event of a chain passes [previousHash] = null (the domain
 *    `ChainEvent.previousHash` contract); it hashes over [GENESIS_BYTES], so
 *    a chain can never silently "start from nowhere".
 *  - Timestamps participate in the hash but are NOT trusted for ordering —
 *    the device clock is user-settable. Ordering is the append order.
 *
 * The action is accepted as a [String] (the caller passes
 * `ChainAction.name`) so this core-layer object never imports the domain
 * layer. The seed was bumped to `haris-chain-v2` when the digest surface
 * changed (payload segment removed, nullable genesis) — v1 and v2 digests
 * over the same logical event are intentionally never comparable.
 */
object ChainEventHasher {

    private const val SEED = "haris-chain-v2"

    /** Canonical genesis prev-hash representation: 64 zero hex chars. */
    const val GENESIS_PREV: String = "0".repeat(64)

    private val GENESIS_BYTES = GENESIS_PREV.toByteArray(Charsets.UTF_8)

    fun hash(
        previousHash: String?,
        actionName: String,
        timestampEpochMillis: Long,
    ): String {
        if (previousHash != null) {
            require(previousHash.length == 64) { "prevHash must be a full SHA-256 hex string or null (genesis)" }
        }

        val bytes = ByteArrayOutputStream()
        DataOutputStream(bytes).use { dos ->
            writeSegment(dos, SEED.toByteArray(Charsets.UTF_8))
            writeSegment(dos, previousHash?.toByteArray(Charsets.UTF_8) ?: GENESIS_BYTES)
            writeSegment(dos, actionName.toByteArray(Charsets.UTF_8))
            writeSegment(dos, timestampEpochMillis.toString().toByteArray(Charsets.UTF_8))
        }
        return Sha256.ofBytes(bytes.toByteArray())
    }

    private fun writeSegment(dos: DataOutputStream, segment: ByteArray) {
        dos.writeInt(segment.size)
        dos.write(segment)
    }
}
