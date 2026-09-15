package net.crimsys.app

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import net.crimsys.app.data.sync.SyncManager
import net.crimsys.app.data.sync.SyncWorkScheduler
import javax.inject.Inject

/**
 * CRIM-SYS 2026 application class.
 *
 * Forces Arabic-first locale + RTL as the app default. Per-app language
 * (Android 13+ system settings) still overrides this.
 *
 * Also boots the offline-first sync machinery:
 *  - [SyncManager] listens to [net.crimsys.app.data.sync.NetworkMonitor] in
 *    an application-scoped [CoroutineScope] and drains the legacy Offline
 *    Action Queue whenever connectivity returns.
 *  - The Haris sync-command queue (case creation, memo updates, hearing
 *    records, evidence registration) is drained by [SyncWorker] — a KEEP
 *    request is scheduled at boot via [SyncWorkScheduler] so a process
 *    restart with a non-empty queue cannot strand commands (the CONNECTED
 *    constraint parks the request until a network exists). Repositories
 *    schedule the same entry point after every queued write; KEEP makes
 *    both paths converge on one drain.
 */
@HiltAndroidApp
class CrimSysApplication : Application(), Configuration.Provider {

    @Inject
    lateinit var syncManager: SyncManager

    @Inject
    lateinit var syncWorkScheduler: SyncWorkScheduler

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .build()

    override fun onCreate() {
        super.onCreate()
        // Arabic-first: default locale for all AppCompat activities.
        AppCompatDelegate.setApplicationLocales(
            LocaleListCompat.forLanguageTags("ar"),
        )
        syncManager.start(appScope)
        // Boot-time drain for the Haris command queue (KEEP: converge on the
        // single unique work chain; on-write callers share this scheduler).
        syncWorkScheduler.enqueue()
    }
}
