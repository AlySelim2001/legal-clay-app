package net.crimsys.app.domain.evidence

/**
 * One append-only entry in an evidence item's chain of custody.
 *
 * Immutability contract: instances are never mutated after creation. A new
 * state of the evidence produces a NEW event appended AFTER the previous one
 * — never an update. The [eventHash] binds the entry to its predecessor via
 * [net.crimsys.app.core.evidence.ChainEventHasher], so any reordering or edit
 * is detectable.
 *
 * Ordering rule: the append order is the authoritative order (Room
 * autoincrement ids). [occurredAtEpochMs] is recorded for humans but never
 * trusted for ordering — device clocks are user-settable.
 */
data class ChainEvent(
    /** Stable identity, assigned by the persistence layer (UUID). */
    val id: String,
    /** Evidence item this event belongs to. */
    val evidenceId: String,
    /** Whether the device was offline at creation — not a lesser event. */
    val offline: Boolean,
    /** Semantic kind — one of the constants in [Kind] (free-form operator ids allowed). */
    val kind: String,
    /** Payload bytes, or null for events that carry none (e.g. NOTE). */
    val payload: ByteArray?,
    /** Human-meaningful display time (device clock; NOT trusted for ordering). */
    val occurredAtEpochMs: Long,
    /** SHA-256 hex linking this event to [previousEventHash]. */
    val eventHash: String,
    /** Hash of the preceding event, or [net.crimsys.app.core.evidence.ChainEventHasher.GENESIS_PREV]. */
    val previousEventHash: String,
) {
    /** Canonical event kinds. Operators may use additional free-form ids. */
    object Kind {
        const val CAPTURED = "captured"
        const val HASH_VERIFIED = "hash_verified"
        const val EXPORTED = "exported"
        const val SEALED = "sealed"
        const val NOTE = "note"
    }

    /** Structural equality includes payload content (byte-array safe). */
    override fun equals(other: Any?): Boolean =
        this === other ||
            other is ChainEvent &&
            id == other.id &&
            evidenceId == other.evidenceId &&
            offline == other.offline &&
            kind == other.kind &&
            (payload?.contentEquals(other.payload) ?: (other.payload == null)) &&
            occurredAtEpochMs == other.occurredAtEpochMs &&
            eventHash == other.eventHash &&
            previousEventHash == other.previousEventHash

    override fun hashCode(): Int {
        var result = id.hashCode()
        result = 31 * result + evidenceId.hashCode()
        result = 31 * result + offline.hashCode()
        result = 31 * result + kind.hashCode()
        result = 31 * result + (payload?.contentHashCode() ?: 0)
        result = 31 * result + occurredAtEpochMs.hashCode()
        result = 31 * result + eventHash.hashCode()
        result = 31 * result + previousEventHash.hashCode()
        return result
    }
}
