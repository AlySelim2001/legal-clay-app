package net.crimsys.app.data.remote

import android.content.Context
import com.google.firebase.firestore.FirebaseFirestore
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.tasks.await
import net.crimsys.app.data.local.OfflineActionEntity

/** Contract for pushing queued offline mutations to the backend. */
interface RemoteDataSource {
    /** Returns true if the action was accepted by the backend. */
    suspend fun push(action: OfflineActionEntity): Boolean
}

/**
 * Firestore implementation. One document per action:
 * `crimsys/{actionType}/items/{actionId}` with the JSON payload embedded.
 *
 * The Firebase SDK requires `google-services.json` at runtime; when it is
 * missing, `FirebaseFirestore.getInstance()` throws — which we convert into
 * `push = false` so the queue survives and retries on the next connectivity
 * window instead of crashing the app.
 */
@Singleton
class FirebaseAuthRemoteDataSource @Inject constructor(
    @Suppress("unused") private val context: Context,
) : RemoteDataSource {

    private val firestore: FirebaseFirestore? by lazy {
        runCatching { FirebaseFirestore.getInstance() }.getOrNull()
    }

    override suspend fun push(action: OfflineActionEntity): Boolean {
        val db = firestore ?: return false
        return runCatching {
            db.collection(COLLECTION_ROOT)
                .document(action.type)
                .collection("items")
                .document(action.id.toString())
                .set(
                    mapOf(
                        "type" to action.type,
                        "payload" to action.payloadJson,
                        "clientCreatedAt" to action.createdAt,
                    ),
                )
                .await()
            true
        }.getOrDefault(false)
    }

    private companion object {
        const val COLLECTION_ROOT = "crimsys"
    }
}
