package net.crimsys.app.core

import android.os.Build
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow

/** How the app should authenticate the lawyer before showing case data. */
sealed interface LockState {
    /** Auth passed this session — case data may render. */
    data object Unlocked : LockState

    /** Waiting for biometrics/credentials; UI must show the lock overlay. */
    data object Locked : LockState

    /** Prompt is on screen — ignore further requests until it resolves. */
    data object InProgress : LockState

    /**
     * No authenticator is enrolled (fresh device). [SetupLock.launchSettings]
     * walks the lawyer into system Settings; case data stays hidden.
     */
    data object NoAuthenticator : LockState

    /** Biometric/credential flow failed or the device is in lockout. */
    data object Failed : LockState
}

/**
 * R1 remediation: local app-lock (OWASP M1/M2).
 *
 * Policy: prefer Class 3 (BIOMETRIC_STRONG); degrade to Class 2 with
 * device-credential allowed; credential-only on API 30+; if nothing is
 * enrolled, [LockState.NoAuthenticator] keeps case data hidden until the
 * lawyer enrolls via [SetupLock.launchSettings].
 *
 * Design notes:
 *  - [FragmentActivity] is accepted only as a method parameter — never stored
 *    — so no Activity reference survives the prompt lifecycle (no leak).
 *  - State is exposed via [StateFlow] and one-shot signals via [Channel],
 *    which Compose/ViewModels can collect without lifecycle callbacks.
 *  - Constructed lazily by Hilt on first injection; nothing runs at
 *    Application.onCreate (cold-start budget per the startup plan).
 */
@Singleton
class BiometricAuthManager @Inject constructor() {

    private val _lockState = MutableStateFlow<LockState>(LockState.Locked)
    val lockState: StateFlow<LockState> = _lockState.asStateFlow()

    /** One-shot text codes for UI messaging (lockout, retry, per-attempt fail). */
    private val _events = Channel<String>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    private var unlockedThisSession = false

    /** True when the current state permits rendering case data. */
    fun isUnlocked(): Boolean = _lockState.value == LockState.Unlocked

    /**
     * Re-locks the app. Call from a Compose lifecycle observer on `ON_STOP`
     * so returning to the app always lands on the lock screen.
     */
    fun relock() {
        unlockedThisSession = false
        _lockState.value = LockState.Locked
    }

    /**
     * Evaluates device capability and launches the appropriate prompt.
     * Idempotent: no-ops while unlocked or while a prompt is already up.
     *
     * @param title/subtitle localized strings for the system prompt
     *        (passed in so this class never touches resources directly).
     */
    fun authenticate(
        activity: FragmentActivity,
        title: String,
        subtitle: String,
        negativeButtonText: String,
    ) {
        if (unlockedThisSession) return
        if (_lockState.value == LockState.InProgress) return

        val bm = BiometricManager.from(activity)
        val canStrong = bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
        val canWeak = bm.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK)

        when {
            canStrong == BiometricManager.BIOMETRIC_SUCCESS ->
                showPrompt(
                    activity,
                    allowed = BiometricManager.Authenticators.BIOMETRIC_STRONG,
                    title = title,
                    subtitle = subtitle,
                    negativeText = negativeButtonText,
                )

            canStrong == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED &&
                canWeak == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ->
                // Nothing enrolled — keep data hidden until enrollment.
                _lockState.value = LockState.NoAuthenticator

            canStrong == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED &&
                canWeak == BiometricManager.BIOMETRIC_SUCCESS ->
                showPrompt(
                    activity,
                    allowed = BiometricManager.Authenticators.BIOMETRIC_WEAK,
                    title = title,
                    subtitle = subtitle,
                    negativeText = negativeButtonText,
                )

            Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
                bm.canAuthenticate(BiometricManager.Authenticators.DEVICE_CREDENTIAL) ==
                BiometricManager.BIOMETRIC_SUCCESS ->
                // API 30+: credential-only is safe (no negative-button conflict).
                showPrompt(
                    activity,
                    allowed = BiometricManager.Authenticators.DEVICE_CREDENTIAL,
                    title = title,
                    subtitle = subtitle,
                )

            else ->
                // Hardware present but temporarily unavailable (e.g. lockout).
                _lockState.value = LockState.Failed
        }
    }

    private fun showPrompt(
        activity: FragmentActivity,
        allowed: Int,
        title: String,
        subtitle: String,
        negativeText: String,
    ) {
        _lockState.value = LockState.InProgress
        val executor = ContextCompat.getMainExecutor(activity)

        val info = buildPromptInfo(title, subtitle, allowed, negativeText)
        val prompt =
            BiometricPrompt(
                activity,
                executor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        unlockedThisSession = true
                        _lockState.value = LockState.Unlocked
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        when (errorCode) {
                            BiometricPrompt.ERROR_USER_CANCELED,
                            BiometricPrompt.ERROR_NEGATIVE_BUTTON,
                            ->
                                // Deliberate cancel — stay locked, allow retry.
                                _lockState.value = LockState.Locked

                            BiometricPrompt.ERROR_NO_BIOMETRICS ->
                                _lockState.value = LockState.NoAuthenticator

                            BiometricPrompt.ERROR_LOCKOUT,
                            BiometricPrompt.ERROR_LOCKOUT_PERMANENT,
                            -> {
                                _lockState.value = LockState.Failed
                                _events.trySend(EVENT_LOCKOUT)
                            }

                            else -> {
                                _lockState.value = LockState.Locked
                                _events.trySend(EVENT_ERROR)
                            }
                        }
                    }

                    override fun onAuthenticationFailed() {
                        // Single attempt failed; the prompt stays up for retry.
                        _events.trySend(EVENT_ATTEMPT_FAILED)
                    }
                },
            )
        prompt.authenticate(info)
    }

    /**
     * Builds the system prompt for the resolved authenticator class.
     * `setAllowedAuthenticators` with a device-credential bit forbids a
     * negative button (the system provides its own), so it is set only for
     * the biometric-only branches.
     */
    private fun buildPromptInfo(
        title: String,
        subtitle: String,
        allowed: Int,
        negativeText: String,
    ): BiometricPrompt.PromptInfo {
        val builder =
            BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setConfirmationRequired(false)
        val credentialBit = BiometricManager.Authenticators.DEVICE_CREDENTIAL
        if (allowed and credentialBit != 0) {
            builder.setAllowedAuthenticators(allowed)
        } else {
            builder.setAllowedAuthenticators(allowed)
                .setNegativeButtonText(negativeText)
        }
        return builder.build()
    }

    private companion object {
        const val EVENT_LOCKOUT = "biometric_lockout"
        const val EVENT_ERROR = "biometric_error"
        const val EVENT_ATTEMPT_FAILED = "biometric_failed"
    }
}

/** Routes the lawyer to system security settings when nothing is enrolled. */
object SetupLock {
    /**
     * Opens the system screen for enrolling biometrics or a screen lock:
     * [android.provider.Settings.ACTION_BIOMETRIC_ENROLL] on API 28+,
     * otherwise generic security settings.
     */
    fun launchSettings(activity: FragmentActivity) {
        val intent =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                android.content.Intent(android.provider.Settings.ACTION_BIOMETRIC_ENROLL)
            } else {
                android.content.Intent(android.provider.Settings.ACTION_SECURITY_SETTINGS)
            }
        activity.startActivity(intent)
    }
}
