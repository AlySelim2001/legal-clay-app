package net.crimsys.app.ui.screens.cases

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import net.crimsys.app.core.AppError
import net.crimsys.app.core.Result
import net.crimsys.app.data.local.CaseEntity
import net.crimsys.app.data.local.OfflineActionDao
import net.crimsys.app.data.sync.NetworkMonitor
import net.crimsys.app.data.sync.SyncManager
import net.crimsys.app.domain.model.CaseDraft
import net.crimsys.app.domain.usecase.CreateCaseUseCase
import net.crimsys.app.domain.usecase.GetCasesUseCase

/**
 * Cases feature state holder. All UI state lives in [StateFlow]s; one-shot
 * side effects (snackbar messages) flow through [events] as [SharedFlow].
 */
@HiltViewModel
class CaseListViewModel @Inject constructor(
    getCases: GetCasesUseCase,
    private val createCase: CreateCaseUseCase,
    offlineActionDao: OfflineActionDao,
    networkMonitor: NetworkMonitor,
    syncManager: SyncManager,
) : ViewModel() {

    val cases: StateFlow<List<CaseEntity>> = getCases().stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = emptyList(),
    )

    val isOnline: StateFlow<Boolean> = networkMonitor.isOnline.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = networkMonitor.isOnline.value,
    )

    val pendingCount: StateFlow<Int> = offlineActionDao.observePendingCount().stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = 0,
    )

    val isSyncing: StateFlow<Boolean> = syncManager.isSyncing.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = false,
    )

    private val _events = MutableSharedFlow<Event>(
        replay = 0,
        extraBufferCapacity = 8,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    val events = _events.asSharedFlow()

    /** Draft being composed in the add-case dialog, or null when hidden. */
    private val _draft = MutableStateFlow<CaseDraftUi?>(null)
    val draft: StateFlow<CaseDraftUi?> = _draft

    fun openCreateDialog() {
        _draft.value = CaseDraftUi()
    }

    fun dismissCreateDialog() {
        _draft.value = null
    }

    fun updateDraft(transform: (CaseDraftUi) -> CaseDraftUi) {
        _draft.value = _draft.value?.let(transform)
    }

    fun submitDraft() {
        val current = _draft.value ?: return
        viewModelScope.launch {
            when (val result = createCase(current.toDomain())) {
                is Result.Success -> {
                    _draft.value = null
                    _events.tryEmit(Event.CaseSaved)
                }
                is Result.Error -> _events.tryEmit(Event.SaveFailed(result.error))
            }
        }
    }

    sealed interface Event {
        data object CaseSaved : Event
        data class SaveFailed(val error: AppError) : Event
    }
}

/** Editable dialog state (kept out of the domain model on purpose). */
data class CaseDraftUi(
    val caseNumber: String = "",
    val courtName: String = "",
    val caseType: String = "جناية",
    val memoHtml: String = "",
) {
    fun toDomain(): CaseDraft = CaseDraft(
        caseNumber = caseNumber,
        courtName = courtName,
        caseType = caseType,
        memoHtml = memoHtml,
    )
}
