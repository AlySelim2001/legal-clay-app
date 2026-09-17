package net.crimsys.app.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import java.time.LocalDate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import net.crimsys.app.data.local.CaseDao
import net.crimsys.app.data.local.HearingDao
import net.crimsys.app.data.local.LegalDocumentDao
import net.crimsys.app.data.local.OfflineActionDao
import net.crimsys.app.data.sync.NetworkMonitor

data class DashboardUiState(val cases: Int = 0, val upcomingHearings: Int = 0, val pendingSync: Int = 0, val deadLetters: Int = 0, val verifiedDocuments: Int = 0, val isOnline: Boolean = false)

@HiltViewModel
class DashboardViewModel @Inject constructor(caseDao: CaseDao, hearingDao: HearingDao, offlineDao: OfflineActionDao, network: NetworkMonitor, legalDao: LegalDocumentDao) : ViewModel() {
    private val verified = MutableStateFlow(0)
    init { viewModelScope.launch { verified.value = legalDao.countVerified() } }
    val uiState: StateFlow<DashboardUiState> = combine(
        caseDao.observeCases(), hearingDao.observeUpcoming(LocalDate.now().toEpochDay()), offlineDao.observePendingCount(), offlineDao.observeDeadLetterCount(), network.isOnline, verified,
    ) { cases, hearings, pending, dead, online, catalog -> DashboardUiState(cases.size, hearings.size, pending, dead, catalog, online) }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), DashboardUiState())
}
