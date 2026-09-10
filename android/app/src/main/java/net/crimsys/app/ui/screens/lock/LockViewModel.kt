package net.crimsys.app.ui.screens.lock

import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.shareIn
import android.content.Context
import net.crimsys.app.R
import net.crimsys.app.core.BiometricAuthManager
import net.crimsys.app.core.LockState

/**
 * Presentation shell over [BiometricAuthManager]. Owns localized prompt
 * strings (the manager never touches resources) and exposes state/events to
 * Compose. All work happens in the manager; the ViewModel holds no Activity
 * references, so configuration changes are safe.
 */
@HiltViewModel
class LockViewModel @Inject constructor(
    @ApplicationContext private val appContext: Context,
    private val authManager: BiometricAuthManager,
) : ViewModel() {

    val lockState: StateFlow<LockState> = authManager.lockState

    /** One-shot lock events (lockout, failed attempt) for optional snackbars. */
    val events: SharedFlow<String> =
        authManager.events.shareIn(viewModelScope, SharingStarted.WhileSubscribed(5_000))

    fun authenticate(activity: FragmentActivity) {
        authManager.authenticate(
            activity = activity,
            title = appContext.getString(R.string.lock_prompt_title),
            subtitle = appContext.getString(R.string.lock_prompt_subtitle),
            negativeButtonText = appContext.getString(R.string.cancel),
        )
    }

    /** Manual retry path after a lockout. */
    fun relockAndRetry(activity: FragmentActivity) {
        authManager.relock()
        authenticate(activity)
    }

    /** Manual unlock attempt from the lock screen (post-cancel path). */
    fun unlock(activity: FragmentActivity) {
        authenticate(activity)
    }

    /**
     * Called from a lifecycle observer when the activity stops (app sent to
     * background). Guarantees the lock re-arms regardless of screen state.
     */
    fun onAppBackgrounded() {
        authManager.relock()
    }
}
