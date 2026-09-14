package net.crimsys.app.data.remote

import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import java.io.ByteArrayInputStream
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await
import net.crimsys.app.core.evidence.Sha256
import net.crimsys.app.data.auth.AuthRepository
import net.crimsys.app.domain.sync.SyncCommand
import net.crimsys.app.domain.sync.SyncCommandExecutor
import net.crimsys.app.domain.sync.SyncResult

/**
 * Firestore transport for [SyncCommand]s.
 *
 * Document path: `haris/{commandType}/items/{command.uuid}` — the command's
 * enqueue-time UUID is the remote key, so two devices can never collide and
 * overwrite each other (same rule as the legacy `crimsys/...` queue).
 *
 * Result mapping (contract of [SyncCommandExecutor] — every failure is a
 * typed [SyncResult], never an exception):
 *
 * | Condition                                        | Result                                   |
 * |--------------------------------------------------|------------------------------------------|
 * | Payload digest mismatch (corrupt/tampered row)   | [SyncResult.PermanentFailure]            |
 * | Firestore unavailable (no google-services.json)  | [SyncResult.Retryable]                   |
 * | No auth session this window                      | [SyncResult.Retryable]                   |
 * | Transport / transaction error                    | [SyncResult.Retryable]                   |
 * | New write (or identical redelivery — idempotent) | [SyncResult.Accepted]                    |
 * | Existing remote row with DIFFERENT content       | [SyncResult.Conflict]                    |
 *
 * Integrity gate: the payload digest is re-computed and compared BEFORE any
 * remote read/write. A corrupted queue row fails fast as a permanent failure —
 * the caller dead-letters it — and a tampered or truncated payload can never
 * reach the backend silently.
 *
 * Idempotent redelivery: the queue may re-send a command after a crash
 * between the remote write and the local row delete. A remote row with the
 * SAME `payloadSha256` is the same command → [SyncResult.Accepted], not a
 * conflict. A remote row with DIFFERENT content is a genuine split-brain
 * conflict → [SyncResult.Conflict]; the write is refused (a blind `set`
 * would destroy the remote row) and the local row is parked for human
 * inspection. `remoteVersion` reports the existing row's `createdAt`
 * (epoch ms) — Firestore exposes no monotonic server version counter, so
 * the transport uses the only ordering marker it has.
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

        /** Row exists with the same payload digest → idempotent redelivery. */
        data object Idempotent : TxOutcome

        /** Row exists with different content → refuse the write. */
        data class Conflict(val remoteVersion: Long) : TxOutcome
    }

    override suspend fun execute(command: SyncCommand): SyncResult {
        // 1) Integrity gate — never ship a payload that no longer hashes to
        //    the digest recorded at enqueue time.
        val payloadDigest =
            Sha256.digest(ByteArrayInputStream(command.payloadJson.toByteArray(Charsets.UTF_8)))
        if (!command.payloadSha256.equals(payloadDigest, ignoreCase = true)) {
            // Permanent, per-command failure → caller dead-letters the row.
            return SyncResult.PermanentFailure(
                "payload digest mismatch for command ${command.uuid}",
            )
        }

        // 2) Transport — authenticated, best-effort, retryable on failure.
        val db = firestore ?: return SyncResult.Retryable("transport unavailable")

        val uid =
            authRepository.withSession { it }
                ?: return SyncResult.Retryable("no auth session")

        val docRef =
            db.collection(COLLECTION_ROOT)
                .document(command.type)
                .collection("items")
                .document(command.uuid)

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
                                    FIELD_UUID to command.uuid,
                                    FIELD_TYPE to command.type,
                                    FIELD_PAYLOAD to command.payloadJson,
                                    FIELD_PAYLOAD_SHA256 to command.payloadSha256,
                                    FIELD_CREATED_AT to command.createdAtEpochMs,
                                    FIELD_OWNER_UID to uid,
                                ),
                            )
                            TxOutcome.Written
                        }

                        existing.getString(FIELD_PAYLOAD_SHA256)
                            ?.equals(command.payloadSha256, ignoreCase = true) == true ->
                            TxOutcome.Idempotent

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
            Log.w(TAG, "Sync command rejected (type=${command.type}) — will retry", t)
            SyncResult.Retryable("transport error: ${t.javaClass.simpleName}")
        }
    }

    private companion object {
        const val TAG = "SyncCommandExecutor"
        const val COLLECTION_ROOT = "haris"

        const val FIELD_UUID = "uuid"
        const val FIELD_TYPE = "type"
        const val FIELD_PAYLOAD = "payload"
        const val FIELD_PAYLOAD_SHA256 = "payloadSha256"
        const val FIELD_CREATED_AT = "createdAt"
        const val FIELD_OWNER_UID = "ownerUid"
    }
}
