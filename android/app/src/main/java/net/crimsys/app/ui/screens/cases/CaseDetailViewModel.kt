package net.crimsys.app.ui.screens.cases

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.ExperimentalCoroutinesApi
import net.crimsys.app.data.local.CaseEntity
import net.crimsys.app.data.local.HearingEntity
import net.crimsys.app.domain.repository.CaseRepository

/**
 * Case file state: the case row plus its scheduled sessions. The case is
 * loaded once per id; hearings reactively update through Room.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class CaseDetailViewModel @Inject constructor(
    private val repository: CaseRepository,
) : ViewModel() {

    private val _caseId = MutableStateFlow("")
    val caseId: StateFlow<String> = _caseId.asStateFlow()

    val case: StateFlow<CaseEntity?> = _caseId
        .flatMapLatest { id ->
            if (id.isBlank()) {
                flowOf(null)
            } else {
                // Re-emit on updates by observing the list and picking our row.
                repository.getCases().map { cases -> cases.firstOrNull { it.id == id } }
            }
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = null,
        )

    val hearings: StateFlow<List<HearingEntity>> = _caseId
        .flatMapLatest { id ->
            if (id.isBlank()) {
                flowOf(emptyList())
            } else {
                repository.getUpcomingHearings(fromEpochDay = 0)
                    .map { all -> all.filter { it.caseId == id } }
            }
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = emptyList(),
        )

    fun load(id: String) {
        if (_caseId.value != id) _caseId.value = id
    }
}
