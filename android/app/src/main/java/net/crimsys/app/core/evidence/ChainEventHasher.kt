package net.crimsys.app.core.evidence

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream

/**
 * Hash-linking for the evidence chain of custody.
 *
 * Each event's digest is `SHA-256(prevHash ‖ type ‖ timestamp ‖ payload)`,
 * with every segment length-prefixed (4-byte big-endian) before hashing so
 * concatenation is unambiguous — `("AB","C")` can never collide with
 * `("A","BC")`.
 *
 * Consequences (deliberate):
 *  - Any single-bit change to an event, or reordering of two events, breaks
 *    every link after it — tampering is detectable, not preventable.
 *  - The first event links to [GENESIS_PREV] (64 zeros), so a chain can never
 *    silently "start from nowhere".
 *  - Timestamps participate in the hash but are NOT trusted for ordering —
 *    the device clock is user-settable. Ordering is the append order.
 */
object ChainEventHasher {

    private const val SEED = "haris-chain-v1"

    /** Link target for the first event of any chain. */
    const val GENESIS_PREV: String = "0".repeat(64)

    fun hash(prevHash: String, type: String, timestampEpochMs: Long, payload: ByteArray?): String {
        require(prevHash.length == 64) { "prevHash must be a full SHA-256 hex string" }

        val bytes = ByteArrayOutputStream()
        DataOutputStream(bytes).use { dos ->
            writeSegment(dos, SEED.toByteArray(Charsets.UTF_8))
            writeSegment(dos, prevHash.toByteArray(Charsets.UTF_8))
            writeSegment(dos, type.toByteArray(Charsets.UTF_8))
            writeSegment(dos, timestampEpochMs.toString().toByteArray(Charsets.UTF_8))
            writeSegment(dos, payload ?: ByteArray(0))
        }
        return Sha256.ofBytes(bytes.toByteArray())
    }

    private fun writeSegment(dos: DataOutputStream, segment: ByteArray) {
        dos.writeInt(segment.size)
        dos.write(segment)
    }
}
