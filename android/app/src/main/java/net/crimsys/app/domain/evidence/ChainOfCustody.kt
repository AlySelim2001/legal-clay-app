package net.crimsys.app.domain.evidence

import kotlinx.coroutines.CancellationException
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * The chain of custody embedded in an evidence row
 * (`evidence.chainOfCustodyJson`).
 *
 * A versioned envelope (not a bare array) so future custody metadata — device
 * attestation, capture context — can be added without re-shaping stored rows.
 *
 * The codec is total: [decode] returns null for ANY malformed input (bad JSON,
 * unknown [ChainAction] value — the closed vocabulary is enforced at decode),
 * so a corrupted custody column surfaces as corrupt data at the repository
 * boundary instead of a serialization crash mid-drain.
 */
@Serializable
data class ChainOfCustody(
    /** Append-ordered links, hash-linked per [ChainEventHasher]. */
    val events: List<ChainEvent> = emptyList(),
) {
    companion object {
        private val json = Json {
            encodeDefaults = true
            ignoreUnknownKeys = true
        }

        fun encode(custody: ChainOfCustody): String =
            json.encodeToString(serializer(), custody)

        fun decode(raw: String): ChainOfCustody? = try {
            json.decodeFromString(serializer(), raw)
        } catch (t: Throwable) {
            if (t is CancellationException) throw t
            null
        }
    }
}
