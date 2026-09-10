package net.crimsys.app.data.auth

import android.util.Log
import com.google.firebase.auth.EmailAuthProvider
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.tasks.await

/** Auth outcome surfaced to callers; no credentials ever enter this type. */
sealed interface AuthStatus {
    /** A valid Firebase session exists and [uid] is stable for the device. */
    data class SignedIn(val uid: String) : AuthStatus

    /** Network/Auth backend failure — sync must NOT push without a uid. */
    data object Unavailable : AuthStatus
}

/**
 * Guarantees a signed-in Firebase session for the sync layer (R1).
 *
 * Firestore security rules validate `request.auth.uid` on every operation,
 * so nothing may be pushed until a real session exists. The repository
 * transparently signs in the install (anonymous upgraded to email/password
 * when the practice provisions the account) and caches nothing sensitive:
 * Firebase Auth's own token store handles refresh.
 */
interface AuthRepository {
    /** Current status, refreshed on first call per process. */
    suspend fun currentStatus(): AuthStatus

    /**
     * Runs [block] with a guaranteed signed-in [AuthStatus.SignedIn.uid].
     * Returns null if a session could not be established (offline at cold
     * start with expired refresh token, backend unavailable) — callers must
     * treat that as "retry later", never push unauthenticated.
     */
    suspend fun <T> withSession(block: suspend (uid: String) -> T): T?
}

/**
 * Firebase Auth implementation. Uses anonymous sign-in for zero-friction
 * provisioning; [linkEmailPassword] upgrades the same uid to a permanent
 * account when the practice registers the lawyer's email.
 */
@Singleton
class FirebaseAuthRepository @Inject constructor(
    private val authHolder: FirebaseAuthHolder,
) : AuthRepository {

    /** Never call outside [withSession]/[currentStatus] — see lazy init note. */
    private val auth: FirebaseAuth? by lazy {
        try {
            FirebaseAuth.getInstance()
        } catch (t: Throwable) {
            if (t is CancellationException) throw t
            Log.w(TAG, "Firebase Auth unavailable — sync stays offline", t)
            null
        }
    }

    override suspend fun currentStatus(): AuthStatus {
        val auth = auth ?: return AuthStatus.Unavailable
        return try {
            val user = auth.currentUser ?: signInAnonymouslyOrNull(auth)
            if (user != null) AuthStatus.SignedIn(user.uid) else AuthStatus.Unavailable
        } catch (ce: CancellationException) {
            throw ce
        } catch (t: Throwable) {
            Log.w(TAG, "Auth status check failed", t)
            AuthStatus.Unavailable
        }
    }

    override suspend fun <T> withSession(block: suspend (uid: String) -> T): T? {
        val status = currentStatus()
        if (status !is AuthStatus.SignedIn) return null
        return block(status.uid)
    }

    /**
     * Upgrades the current anonymous account to a permanent email/password
     * account (preserving the uid). No-op when already upgraded.
     *
     * @return true when the account is (now) a permanent email account.
     */
    suspend fun linkEmailPassword(email: String, password: String): Boolean {
        val auth = auth ?: return false
        return try {
            val user = auth.currentUser
                ?: signInAnonymouslyOrNull(auth)
                ?: return false
            if (!user.isAnonymous) return true
            val credential = EmailAuthProvider.getCredential(email, password)
            user.linkWithCredential(credential).await().user != null
        } catch (ce: CancellationException) {
            throw ce
        } catch (t: Throwable) {
            Log.w(TAG, "Account link failed", t)
            false
        }
    }

    private suspend fun signInAnonymouslyOrNull(auth: FirebaseAuth): FirebaseUser? {
        val result = auth.signInAnonymously().await()
        return result.user
    }

    private companion object {
        const val TAG = "AuthRepository"
    }
}
