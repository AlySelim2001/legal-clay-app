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

/**
 * Firestore transport for [SyncCommand]s.
 *
 * Document path: `haris/{commandType}/items/{command.uuid}` — the command's
 * enqueue-time UUID is the remote key, so two devices can never collide and
 * overwrite each other (same rule as the legacy `crimsys/...` queue).
 *
 * Integrity gate (contract of [SyncCommandExecutor]): the payload digest is
 * re-computed and compared BEFORE any remote write. A corrupted queue row
 * fails fast with [IllegalArgumentException] — the caller dead-letters it —
 * and a tampered or truncated payload can never reach the backend silently.
 *
 * Authentication (R1, unchanged): every write runs inside
 * [AuthRepository.withSession]; Firestore rules validate
 * `request.auth.uid`. Offline / unavailable auth degrades to `false` and the
 * queue retries in a later window.
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

    override suspend fun execute(command: SyncCommand): Boolean {
        // 1) Integrity gate — never ship a payload that no longer hashes to
        //    the digest recorded at enqueue time.
        val payloadDigest =
            Sha256.digest(ByteArrayInputStream(command.payloadJson.toByteArray(Charsets.UTF_8)))
        if (!command.payloadSha256.equals(payloadDigest, ignoreCase = true)) {
            // Permanent, per-command failure → caller dead-letters the row.
            throw IllegalArgumentException("payload digest mismatch for command ${command.uuid}")
        }

        // 2) Transport — authenticated, best-effort, retryable.
        val db = firestore ?: return false
        return try {
            val accepted = authRepository.withSession { uid ->
                db.collection(COLLECTION_ROOT)
                    .document(command.type)
                    .collection("items")
                    .document(command.uuid)
                    .set(
                        mapOf(
                            "uuid" to command.uuid,
                            "type" to command.type,
                            "payload" to command.payloadJson,
                            "payloadSha256" to command.payloadSha256,
                            "createdAt" to command.createdAtEpochMs,
                            "ownerUid" to uid,
                        ),
                    )
                    .await()
                true
            }
            // withSession returned null → no session this window.
            accepted == true
        } catch (ce: CancellationException) {
            throw ce // MUST propagate — never record cancellation as failure.
        } catch (t: Throwable) {
            // Deliberately no payload content in logs — legal data must not hit Logcat.
            Log.w(TAG, "Sync command rejected (type=${command.type}) — will retry", t)
            false
        }
    }

    private companion object {
        const val TAG = "SyncCommandExecutor"
        const val COLLECTION_ROOT = "haris"
    }
}
