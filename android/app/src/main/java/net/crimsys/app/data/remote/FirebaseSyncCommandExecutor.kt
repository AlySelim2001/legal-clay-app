package net.crimsys.app.data.remote

import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.time.Duration.Companion.seconds
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await
import net.crimsys.app.data.auth.AuthRepository
import net.crimsys.app.domain.sync.SyncCommand
import net.crimsys.app.domain.sync.SyncCommandExecutor
import net.crimsys.app.domain.sync.SyncResult

/**
 * Firestore transport for [SyncCommand]s.
 *
 * Idempotency (the domain contract): **commandId is the remote idempotency
 * key** — repeating the exact command targets the same Firestore document
 * instead of creating another one, so an ambiguous network failure can never
 * produce a second logical mutation.
 *
 * Result mapping — every failure is a typed [SyncResult], never an exception:
 *
 * | Condition                                   | Result                        |
 * |---------------------------------------------|-------------------------------|
 * | Firestore unavailable (no google-services)  | Retryable, 60s hint           |
 * | No auth session this window                 | Retryable, 5s hint            |
 * | UNAUTHENTICATED                             | Retryable, 5s hint            |
 * | PERMISSION_DENIED / INVALID_ARGUMENT /      |                               |
 * | FAILED_PRECONDITION / NOT_FOUND             | PermanentFailure              |
 * | ABORTED / DEADLINE_EXCEEDED /               |                               |
 * | RESOURCE_EXHAUSTED / UNAVAILABLE / other    | Retryable                     |
 *
 * Authentication (R1): every write runs inside [AuthRepository.withSession].
 * A null session means the write never ran — the command is reported
 * Retryable (never Accepted) and rides the queue to the next window.
 *
 * Logs carry no legal payload — exception details only, never message bodies.
 */
@Singleton
class FirebaseSyncCommandExecutor @Inject constructor(
    private val authRepository: AuthRepository,
) : SyncCommandExecutor {

    private val firestore: FirebaseFirestore? by lazy {
        runCatching {
            FirebaseFirestore.getInstance()
        }.onFailure {
            Log.w(
                TAG,
                "Firestore unavailable; remaining offline-first.",
            )
        }.getOrNull()
    }

    override suspend fun execute(
        command: SyncCommand,
    ): SyncResult {

        val db =
            firestore
                ?: return SyncResult.Retryable(
                    reason = "FIRESTORE_UNAVAILABLE",
                    retryAfter = 60.seconds,
                )

        return try {

            val written =
                authRepository.withSession { uid ->

                    val document =
                        db.collection(ROOT)
                            .document(
                                command.commandId.toString(),
                            )

                    /*
                     * commandId is the remote idempotency key.
                     *
                     * Repeating the exact command targets the same
                     * Firestore document instead of creating another one.
                     */
                    document.set(
                        mapOf(
                            "commandId" to
                                command.commandId.toString(),

                            "schemaVersion" to
                                command.schemaVersion,

                            "aggregateId" to
                                command.aggregateId.toString(),

                            "type" to
                                command.type.name,

                            "payloadJson" to
                                command.payloadJson,

                            "createdAtEpochMillis" to
                                command.createdAt.toEpochMilli(),

                            "ownerUid" to uid,
                        ),
                    ).await()

                    command.commandId.toString()
                }

            if (written == null) {
                // R1 contract of AuthRepository.withSession: null means no
                // session could be established and the write NEVER RAN.
                // Reporting Accepted here would let the drain delete a
                // command that never reached the backend — data loss. Retry
                // shortly instead (mirrors the UNAUTHENTICATED mapping).
                SyncResult.Retryable(
                    reason = "AUTHENTICATION_REQUIRED",
                    retryAfter = 5.seconds,
                )
            } else {
                SyncResult.Accepted(
                    remoteId = written,
                )
            }

        } catch (ce: CancellationException) {

            throw ce

        } catch (
            e: FirebaseFirestoreException,
        ) {

            when (e.code) {

                FirebaseFirestoreException.Code.UNAUTHENTICATED ->
                    SyncResult.Retryable(
                        "AUTHENTICATION_REQUIRED",
                        5.seconds,
                    )

                FirebaseFirestoreException.Code.PERMISSION_DENIED ->
                    SyncResult.PermanentFailure(
                        "PERMISSION_DENIED",
                    )

                FirebaseFirestoreException.Code.INVALID_ARGUMENT,
                FirebaseFirestoreException.Code.FAILED_PRECONDITION,
                FirebaseFirestoreException.Code.NOT_FOUND ->
                    SyncResult.PermanentFailure(
                        "REMOTE_${e.code.name}",
                    )

                FirebaseFirestoreException.Code.ABORTED,
                FirebaseFirestoreException.Code.DEADLINE_EXCEEDED,
                FirebaseFirestoreException.Code.RESOURCE_EXHAUSTED,
                FirebaseFirestoreException.Code.UNAVAILABLE ->
                    SyncResult.Retryable(
                        "REMOTE_${e.code.name}",
                    )

                else ->
                    SyncResult.Retryable(
                        "REMOTE_${e.code.name}",
                    )
            }

        } catch (t: Throwable) {

            Log.w(
                TAG,
                "Remote command failed without logging legal payload.",
                t,
            )

            SyncResult.Retryable(
                "UNEXPECTED_REMOTE_FAILURE",
            )
        }
    }

    private companion object {
        const val TAG = "FirebaseSyncCommand"
        const val ROOT = "haris_sync_commands"
    }
}
