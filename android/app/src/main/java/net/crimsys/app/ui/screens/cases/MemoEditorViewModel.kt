package net.crimsys.app.ui.screens.cases

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.mohamedrejeb.richeditor.model.RichTextState
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import net.crimsys.app.core.AppError
import net.crimsys.app.core.Result
import net.crimsys.app.domain.repository.CaseRepository

/**
 * Memo editor state holder. The [RichTextState] lives in the ViewModel so a
 * configuration change (rotation, foldable posture) keeps the in-progress
 * text; Room remains the source of truth once saved.
 */
@HiltViewModel
class MemoEditorViewModel @Inject constructor(
    private val repository: CaseRepository,
) : ViewModel() {

    private val _caseId = MutableStateFlow<String?>(null)
    val caseId: StateFlow<String?> = _caseId.asStateFlow()

    private val _richText = MutableStateFlow(RichTextState())
    val richText: StateFlow<RichTextState> = _richText.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _events = MutableSharedFlow<Event>(
        replay = 0,
        extraBufferCapacity = 8,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    val events = _events.asSharedFlow()

    /** Loads the case row and hydrates the editor once. */
    fun load(id: String) {
        if (_caseId.value == id) return
        _caseId.value = id
        viewModelScope.launch {
            val case = repository.getCaseById(id)
            _richText.value.setHtml(case?.memoHtml.orEmpty())
            _isLoading.value = false
            if (case == null) {
                _events.tryEmit(Event.LoadFailed)
            }
        }
    }

    /** Current selection/formatting flags for the toolbar. */
    val isBold: Boolean
        get() = _richText.value.currentSpanStyle.fontWeight == androidx.compose.ui.text.font.FontWeight.Bold

    val isItalic: Boolean
        get() = _richText.value.currentSpanStyle.fontWeight == androidx.compose.ui.text.font.FontWeight.Italic

    fun toggleBold() = _richText.value.toggleSpanStyle(
        androidx.compose.ui.text.SpanStyle(fontWeight = androidx.compose.ui.text.font.FontWeight.Bold),
    )

    fun toggleItalic() = _richText.value.toggleSpanStyle(
        androidx.compose.ui.text.SpanStyle(fontWeight = androidx.compose.ui.text.font.FontWeight.Italic),
    )

    fun toggleUnorderedList() = _richText.value.toggleUnorderedList()

    fun save() {
        val id = _caseId.value ?: run {
            _events.tryEmit(Event.NoCase)
            return
        }
        viewModelScope.launch {
            when (val result = repository.saveMemo(id, _richText.value.toHtml())) {
                is Result.Success -> _events.tryEmit(Event.Saved)
                is Result.Error -> _events.tryEmit(Event.SaveFailed(result.error))
            }
        }
    }

    sealed interface Event {
        data object Saved : Event
        data object LoadFailed : Event
        data object NoCase : Event
        data class SaveFailed(val error: AppError) : Event
    }
}
