package net.crimsys.app.ui.screens.legal

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import net.crimsys.app.data.legal.LegalRepository
import net.crimsys.app.domain.legal.LegalDocument

@HiltViewModel
class LegalSearchViewModel @Inject constructor(
    private val repository: LegalRepository,
) : ViewModel() {
    private val query = MutableStateFlow("")
    private val selectedDocumentId = MutableStateFlow<String?>(null)

    private val results: StateFlow<List<LegalDocument>> = query
        .debounce(250)
        .distinctUntilChanged()
        .flatMapLatest(repository::observeSearch)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val uiState: StateFlow<LegalSearchUiState> = combine(
        query,
        results,
        selectedDocumentId,
    ) { currentQuery, documents, selectedId ->
        LegalSearchUiState(
            query = currentQuery,
            results = documents,
            selectedDocument = documents.firstOrNull { it.id == selectedId },
        )
    }.stateIn(
        viewModelScope,
        SharingStarted.WhileSubscribed(5_000),
        LegalSearchUiState(),
    )

    fun onQueryChanged(value: String) {
        query.value = value.take(MAX_QUERY_LENGTH)
        selectedDocumentId.value = null
    }

    fun selectDocument(documentId: String) {
        selectedDocumentId.value = documentId
    }

    fun clearSelection() {
        selectedDocumentId.value = null
    }

    data class LegalSearchUiState(
        val query: String = "",
        val results: List<LegalDocument> = emptyList(),
        val selectedDocument: LegalDocument? = null,
    )

    private companion object {
        const val MAX_QUERY_LENGTH = 200
    }
}
