package net.crimsys.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import net.crimsys.app.data.local.OfflineActionDao
import net.crimsys.app.data.sync.NetworkMonitor
import net.crimsys.app.data.sync.SyncManager

/**
 * Chrome-level state for the app bar: connectivity, sync progress and the
 * offline queue depth. All three are cold-started once and shared across
 * configuration changes via [stateIn].
 */
@HiltViewModel
class SyncStatusViewModel
    @Inject
    constructor(
        networkMonitor: NetworkMonitor,
        syncManager: SyncManager,
        offlineActionDao: OfflineActionDao,
    ) : ViewModel() {
        val isOnline: StateFlow<Boolean> =
            networkMonitor.isOnline.stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(5_000),
                initialValue = networkMonitor.isOnline.value,
            )

        val isSyncing: StateFlow<Boolean> =
            syncManager.isSyncing.stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(5_000),
                initialValue = false,
            )

        val pendingActions: StateFlow<Int> =
            offlineActionDao.observePendingCount().stateIn(
                scope = viewModelScope,
                started = SharingStarted.WhileSubscribed(5_000),
                initialValue = 0,
            )
    }
