package net.crimsys.app.data.sync

import android.util.Log
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import net.crimsys.app.data.local.CaseDao
import net.crimsys.app.data.local.OfflineActionDao
import net.crimsys.app.data.remote.RemoteDataSource

/**
 * Owns the Offline Action Queue.
 *
 * Strategy:
 * 1. Collect [NetworkMonitor.observe] forever (in the app-process scope owned
 *    by whoever calls [start] — Hilt-injected application scope or a
 *    ViewModel that survives the screen).
 * 2. On every `true` (or as `collectLatest` — the latest `true` wins and any
 *    in-flight drain is cancelled and restarted), drain the queue FIFO.
 * 3. Per action: attempt remote push. Success → delete the action and flip
 *    the local `isSynced` flag for CREATE_CASE payloads. Failure → increment
 *    the retry counter and STOP the drain (preserving strict order; a later
 *    mutation must never overtake a failed earlier one).
 *
 * Ordering guarantee: OfflineActionEntity ids are auto-incrementing, so
 * `ORDER BY id ASC` is exactly insertion order.
 */
@Singleton
class SyncManager @Inject constructor(
    private val networkMonitor: NetworkMonitor,
    private val offlineActionDao: OfflineActionDao,
    private val caseDao: CaseDao,
    private val remote: RemoteDataSource,
) {
    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private var drainJob: Job? = null

    /**
     * Starts listening for connectivity changes. Call once from
     * CrimSysApplication with an application-scoped [CoroutineScope].
     */
    fun start(scope: CoroutineScope) {
        if (drainJob?.isActive == true) return
        drainJob =
            scope.launch {
                networkMonitor.observe().collectLatest { online ->
                    if (online) {
                        drainQueue()
                    } else {
                        Log.d(TAG, "Offline — queue holds pending actions until reconnection")
                    }
                }
            }
    }

    /**
     * Executes every queued action in FIFO order. Runs inline when called from
     * [start] (already on the scope's dispatcher) or from a repository that
     * enqueued actions while online.
     */
    suspend fun drainQueue() {
        if (_isSyncing.value) return
        _isSyncing.value = true
        try {
            while (true) {
                val next = offlineActionDao.pendingInOrder().firstOrNull() ?: break

                val accepted = remote.push(next)
                if (!accepted) {
                    // Keep the action queued for the next window; ordering intact.
                    offlineActionDao.incrementRetry(next.id)
                    Log.w(TAG, "Push rejected (id=${next.id}, type=${next.type}) — will retry")
                    break
                }

                offlineActionDao.deleteById(next.id)
                markRelatedCaseSynced(next)
            }
        } finally {
            _isSyncing.value = false
        }
    }

    /**
     * For CREATE_CASE payloads, flips `isSynced` on the local row. Payload
     * format is a single JSON object: `{"caseId": "..."}`.
     */
    private suspend fun markRelatedCaseSynced(action: net.crimsys.app.data.local.OfflineActionEntity) {
        if (action.type != net.crimsys.app.data.local.OfflineActionType.CREATE_CASE) return
        runCatching {
            val caseId = caseIdRegex.find(action.payloadJson)?.groupValues?.getOrNull(1)
            caseId?.let { caseDao.setSynced(it, synced = true) }
        }.onFailure { Log.w(TAG, "Could not mark case synced for payload ${action.payloadJson}", it) }
    }

    private companion object {
        const val TAG = "SyncManager"
        val caseIdRegex = Regex("\"caseId\"\\s*:\\s*\"([^\"]+)\"")
    }
}
