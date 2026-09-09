package net.crimsys.app.ui.screens.about

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import net.crimsys.app.BuildConfig
import net.crimsys.app.core.AppError
import net.crimsys.app.core.Result
import net.crimsys.app.core.UpdateChecker
import net.crimsys.app.core.UpdateInfo

/** UI state of the in-app update check (About screen). */
sealed interface UpdateUiState {
    data object Idle : UpdateUiState
    data object Checking : UpdateUiState
    /** `update == null` means the app is already the latest published release. */
    data class Done(val update: UpdateInfo?) : UpdateUiState
    data class Failed(val error: AppError) : UpdateUiState
}

/**
 * Backs the About screen: renders the legal disclaimer sections and performs
 * the optional GitHub Releases update check. Network work stays inside the
 * checker (IO dispatcher); this VM only maps [Result] into [UpdateUiState].
 */
@HiltViewModel
class AboutViewModel @Inject constructor() : ViewModel() {

    val currentVersion: String = BuildConfig.VERSION_NAME

    private val _updateState = MutableStateFlow<UpdateUiState>(UpdateUiState.Idle)
    val updateState: StateFlow<UpdateUiState> = _updateState.asStateFlow()

    fun checkForUpdates() {
        if (_updateState.value is UpdateUiState.Checking) return
        _updateState.value = UpdateUiState.Checking
        viewModelScope.launch {
            when (val r = UpdateChecker.check(currentVersion)) {
                is Result.Success -> _updateState.value = UpdateUiState.Done(r.data)
                is Result.Error -> _updateState.value = UpdateUiState.Failed(r.error)
            }
        }
    }
}
