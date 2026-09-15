package net.crimsys.app.data.remote

import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await
import net.crimsys.app.data.auth.AuthRepository
import net.crimsys.app.domain.sync.SyncCommand
import net.crimsys.app.domain.sync.SyncCommandExecutor
import net.crimsys.app.domain.sync.SyncResult

/**
 * Firestore transport for [SyncCommand]s.
 *
 * Document path: `haris/{commandType}/items/{command.commandId}` — the
 * command's enqueue-time UUID is the remote key, so two devices can never
 * collide and overwrite each other (same rule as the legacy `crimsys/...` queue).
 *
 * Result mapping (contract of [SyncCommandExecutor] — every failure is a
 * typed [SyncResult], never an exception):
 *
 * | Condition                                        | Result                                   |
 * |--------------------------------------------------|------------------------------------------|
 * | [SyncCommand.schemaVersion] above known versions | [SyncResult.PermanentFailure]            |
 * | Firestore unavailable (no google-services.json)  | [SyncResult.Retryable]                   |
 * | No auth session this window                      | [SyncResult.Retryable]                   |
 * | Transport / transaction error                    | [SyncResult.Retryable]                   |
 * | New write (or identical redelivery — idempotent) | [SyncResult.Accepted]                    |
 * | Existing remote row with DIFFERENT content       | [SyncResult.Conflict]                    |
 *
 * Schema gate: a command stamped with a [SyncCommand.schemaVersion] newer
 * than this transport understands is PERMANENTLY rejected before any remote
 * read/write — a newer app must never half-decode into an older backend.
 * The local schema version this transport speaks lives in
 * [SUPPORTED_SCHEMA_VERSION].
 *
 * Idempotent redelivery: the queue may re-send a command after a crash
 * between the remote write and the local row delete. A remote row with the
 * SAME command id and identical (type, aggregate, payload, createdAt) is the
 * same command → [SyncResult.Accepted], not a conflict. A remote row with
 * DIFFERENT content is a genuine split-brain conflict → [SyncResult.Conflict];
 * the write is refused (a blind `set` would destroy the remote row) and the
 * local row is parked for human inspection. `remoteVersion` reports the
 * existing row's `createdAt` (epoch ms) — Firestore exposes no monotonic
 * server version counter, so the transport uses the only ordering marker it has.
 *
 * Authentication (R1, unchanged): every write runs under a session from
 * [AuthRepository.withSession]; Firestore rules validate `request.auth.uid`.
 *
 * `retryAfter` is left null here — the Firestore SDK does not surface server
 * retry hints. The future Zero-Trust HTTP transport populates it from
 * `Retry-After` headers; the queue honors it either way.
 */
@Singleton
class FirebaseSyncCommandExecutor @Inject constructor(
    private val authRepository: AuthRepository,
) : SyncCommandExecutor {

    /**
     * Highest command envelope schema version this transport can decode.
     * Bump when the remote document shape gains fields the old transport
     * could not have written correctly.
     */
    private val supportedSchemaVersion: Int = SUPPORTED_SCHEMA_VERSION

    // Initialized lazily on first use; the Firebase SDK throws when
    // google-services.json is absent (optional-sync degrade path).
    private val firestore: FirebaseFirestore? by lazy {
        try {
            FirebaseFirestore.getInstance()
        } catch (t: Throwable) {
            if (t is CancellationException) throw t
            Log.w(TAG, "Firestore unavailable — command sync degrades to offline-only", t)
            null
        }
    }

    /** Transaction-internal outcome — mapped to [SyncResult] after `await()`. */
    private sealed interface TxOutcome {
        /** Row was absent → written. */
        data object Written : TxOutcome

        /** Row exists with identical content → idempotent redelivery. */
        data object Idempotent : TxOutcome

        /** Row exists with different content → refuse the write. */
        data class Conflict(val remoteVersion: Long) : TxOutcome
    }

    override suspend fun execute(command: SyncCommand): SyncResult {
        // 1) Schema gate — a newer envelope must never be half-decoded by an
        //    older backend. Permanent, per-command failure → caller dead-letters.
        if (command.schemaVersion > supportedSchemaVersion) {
            return SyncResult.PermanentFailure(
                "schemaVersion ${command.schemaVersion} unsupported (transport speaks <= $supportedSchemaVersion)",
            )
        }

        // 2) Transport — authenticated, best-effort, retryable on failure.
        val db = firestore ?: return SyncResult.Retryable("transport unavailable")

        val uid =
            authRepository.withSession { it }
                ?: return SyncResult.Retryable("no auth session")

        val docRef =
            db.collection(COLLECTION_ROOT)
                .document(command.type.name)
                .collection("items")
                .document(command.commandId.toString())

        return try {
            // Transactional conditional write: create-if-absent, dedup on
            // identical redelivery, and REFUSE to overwrite foreign content.
            val outcome =
                db.runTransaction<TxOutcome> { tx ->
                    val existing = tx.get(docRef)
                    when {
                        !existing.exists() -> {
                            tx.set(
                                docRef,
                                mapOf(
                                    FIELD_COMMAND_ID to command.commandId.toString(),
                                    FIELD_SCHEMA_VERSION to command.schemaVersion,
                                    FIELD_AGGREGATE_ID to command.aggregateId.toString(),
                                    FIELD_TYPE to command.type.name,
                                    FIELD_PAYLOAD to command.payloadJson,
                                    FIELD_CREATED_AT to command.createdAt.toEpochMilli(),
                                    FIELD_ATTEMPT_COUNT to command.attemptCount,
                                    FIELD_OWNER_UID to uid,
                                ),
                            )
                            TxOutcome.Written
                        }

                        isIdenticalRedelivery(existing, command) -> TxOutcome.Idempotent

                        else ->
                            TxOutcome.Conflict(
                                existing.getLong(FIELD_CREATED_AT) ?: 0L,
                            )
                    }
                }.await()

            when (outcome) {
                is TxOutcome.Written, is TxOutcome.Idempotent ->
                    SyncResult.Accepted(remoteId = docRef.path)

                is TxOutcome.Conflict ->
                    SyncResult.Conflict(remoteVersion = outcome.remoteVersion)
            }
        } catch (ce: CancellationException) {
            throw ce // MUST propagate — never record cancellation as failure.
        } catch (t: Throwable) {
            // Deliberately no payload content in logs — legal data must not hit
            // Logcat; only the exception class, never its message/stack payload.
            Log.w(TAG, "Sync command rejected (type=${command.type.name}) — will retry", t)
            SyncResult.Retryable("transport error: ${t.javaClass.simpleName}")
        }
    }

    /**
     * Redelivery is idempotent only when EVERY semantic field matches: same
     * command identity, same aggregate, same type, same payload, same enqueue
     * time. A row that differs in any of these is a real conflict, not a
     * retry of the same mutation.
     */
    private fun isIdenticalRedelivery(
        existing: com.google.firebase.firestore.DocumentSnapshot,
        command: SyncCommand,
    ): Boolean =
        existing.getString(FIELD_AGGREGATE_ID) == command.aggregateId.toString() &&
            existing.getString(FIELD_TYPE) == command.type.name &&
            existing.getString(FIELD_PAYLOAD) == command.payloadJson &&
            (existing.getLong(FIELD_CREATED_AT) ?: -1L) == command.createdAt.toEpochMilli() &&
            (existing.getLong(FIELD_SCHEMA_VERSION) ?: -1L) == command.schemaVersion.toLong()

    private companion object {
        const val TAG = "SyncCommandExecutor"
        const val COLLECTION_ROOT = "haris"

        /** Envelope schema version this transport decodes. */
        const val SUPPORTED_SCHEMA_VERSION = 1

        const val FIELD_COMMAND_ID = "commandId"
        const val FIELD_SCHEMA_VERSION = "schemaVersion"
        const val FIELD_AGGREGATE_ID = "aggregateId"
        const val FIELD_TYPE = "type"
        const val FIELD_PAYLOAD = "payload"
        const val FIELD_CREATED_AT = "createdAt"
        const val FIELD_ATTEMPT_COUNT = "attemptCount"
        const val FIELD_OWNER_UID = "ownerUid"
    }
}
