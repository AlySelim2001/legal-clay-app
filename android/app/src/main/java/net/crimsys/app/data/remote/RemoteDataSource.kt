package net.crimsys.app.data.remote

import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await
import net.crimsys.app.data.auth.AuthRepository
import net.crimsys.app.data.local.OfflineActionEntity

/** Contract for pushing queued offline mutations to the backend. */
interface RemoteDataSource {
    /** Returns true if the action was accepted by the backend. */
    suspend fun push(action: OfflineActionEntity): Boolean
}

/**
 * Firestore implementation.
 *
 * Document path (R2): `crimsys/{actionType}/items/{actionUuid}` —
 * [OfflineActionEntity.actionUuid] is a device-independent UUID minted at
 * enqueue time, so two devices can never collide on the same document and
 * overwrite each other's case data the way the old autoincrement id did.
 *
 * Authentication (R1): every push runs inside [AuthRepository.withSession],
 * which guarantees a signed-in Firebase session. Combined with
 * `firestore.rules` (`allow write: if request.auth != null` and same-owner
 * validation), a leaked or redistributed `google-services.json` no longer
 * grants anonymous write access to the practice's queue.
 *
 * Failure handling: Firestore or init failures convert into `push = false`
 * so the queue survives and retries on the next connectivity window.
 * `CancellationException` is re-thrown untouched (R3) — cancelling the sync
 * must never be recorded as a rejected push.
 */
@Singleton
class FirebaseAuthRemoteDataSource @Inject constructor(
    private val authRepository: AuthRepository,
) : RemoteDataSource {

    // Initialized lazily on first use; the Firebase SDK throws when
    // google-services.json is absent (optional-sync degrade path).
    private val firestore: FirebaseFirestore? by lazy {
        try {
            FirebaseFirestore.getInstance()
        } catch (t: Throwable) {
            if (t is CancellationException) throw t
            Log.w(TAG, "Firestore unavailable — sync degrades to offline-only", t)
            null
        }
    }

    override suspend fun push(action: OfflineActionEntity): Boolean {
        val db = firestore ?: return false
        return try {
            authRepository.withSession { uid ->
                db.collection(COLLECTION_ROOT)
                    .document(action.type)
                    .collection("items")
                    .document(action.actionUuid)
                    .set(
                        mapOf(
                            "type" to action.type,
                            "payload" to action.payloadJson,
                            "clientCreatedAt" to action.createdAt,
                            "ownerUid" to uid,
                        ),
                    )
                    .await()
            }
            true
        } catch (ce: CancellationException) {
            throw ce // MUST propagate — never record cancellation as failure.
        } catch (t: Throwable) {
            // Deliberately no case payload in logs — legal data must not hit Logcat.
            Log.w(TAG, "Push rejected (type=${action.type}) — will retry", t)
            false
        }
    }

    private companion object {
        const val TAG = "RemoteDataSource"
        const val COLLECTION_ROOT = "crimsys"
    }
}
