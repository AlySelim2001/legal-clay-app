package net.crimsys.app.domain.sync

import java.security.MessageDigest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * One syncable mutation, decoupled from any specific transport.
 *
 * Commands carry a [uuid] minted at enqueue time — the remote document key.
 * A per-device autoincrement id must NEVER be the remote key (two devices
 * would both produce `id = 1` and overwrite each other); the UUID makes
 * remote writes conflict-free by construction.
 */
data class SyncCommand(
    /** Device-independent identity and remote document key. */
    val uuid: String,
    /** Semantic operation — one of [Type] (free-form future types allowed). */
    val type: String,
    /** Self-describing payload; SHA-256 digest travels alongside it. */
    val payloadJson: String,
    /** SHA-256 hex of [payloadJson] — verified before remote write. */
    val payloadSha256: String,
    /** Wall-clock enqueue time (display/ordering aid, not a trust anchor). */
    val createdAtEpochMs: Long,
) {
    /** Canonical command types. */
    object Type {
        const val EVIDENCE_REGISTER = "EVIDENCE_REGISTER"
        const val LEGAL_ATTEST_REQUEST = "LEGAL_ATTEST_REQUEST"
        const val PENDING_LEGAL_QUERY = "PENDING_LEGAL_QUERY"
    }

    /** Codec between [SyncCommand] and the JSON form stored in Room / sent remotely. */
    object Codec {
        private val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }

        /** Envelope keys — schema evolution happens here, explicitly. */
        private const val KEY_UUID = "uuid"
        private const val KEY_TYPE = "type"
        private const val KEY_PAYLOAD = "payload"
        private const val KEY_PAYLOAD_SHA256 = "payloadSha256"
        private const val KEY_CREATED_AT = "createdAt"

        fun toJson(command: SyncCommand): String =
            json.encodeToString(
                JsonObject.serializer(),
                buildJsonObject {
                    put(KEY_UUID, command.uuid)
                    put(KEY_TYPE, command.type)
                    put(KEY_PAYLOAD, command.payloadJson)
                    put(KEY_PAYLOAD_SHA256, command.payloadSha256)
                    put(KEY_CREATED_AT, command.createdAtEpochMs)
                },
            )

        /**
         * Parses the envelope. Returns null for malformed JSON — the caller
         * dead-letters such rows instead of crashing the drain.
         */
        fun fromJson(raw: String): SyncCommand? = try {
            val obj = json.parseToJsonElement(raw).let { it as? JsonObject } ?: return null
            val payload = obj[KEY_PAYLOAD]?.let { if (it is kotlinx.serialization.json.JsonPrimitive) it.content else null }
                ?: return null
            SyncCommand(
                uuid = (obj[KEY_UUID] as? kotlinx.serialization.json.JsonPrimitive)?.content ?: return null,
                type = (obj[KEY_TYPE] as? kotlinx.serialization.json.JsonPrimitive)?.content ?: return null,
                payloadJson = payload,
                payloadSha256 = (obj[KEY_PAYLOAD_SHA256] as? kotlinx.serialization.json.JsonPrimitive)?.content
                    ?: sha256Hex(payload),
                createdAtEpochMs = (obj[KEY_CREATED_AT] as? kotlinx.serialization.json.JsonPrimitive)?.content
                    ?.toLongOrNull() ?: 0L,
            )
        } catch (t: Throwable) {
            if (t is kotlinx.coroutines.CancellationException) throw t
            null
        }
    }

    companion object {
        /** Mints a command and computes its payload digest in one step. */
        fun create(type: String, payloadJson: String, createdAtEpochMs: Long): SyncCommand =
            SyncCommand(
                uuid = java.util.UUID.randomUUID().toString(),
                type = type,
                payloadJson = payloadJson,
                payloadSha256 = sha256Hex(payloadJson),
                createdAtEpochMs = createdAtEpochMs,
            )

        /**
         * Domain-local SHA-256 hex (UTF-8). Kept here — not an import of
         * `core.evidence.Sha256`, whose surface is streaming-only — so the
         * domain layer never depends on core crypto helpers.
         */
        internal fun sha256Hex(value: String): String =
            MessageDigest
                .getInstance("SHA-256")
                .digest(value.toByteArray(Charsets.UTF_8))
                .joinToString("") { "%02x".format(it) }
    }
}
