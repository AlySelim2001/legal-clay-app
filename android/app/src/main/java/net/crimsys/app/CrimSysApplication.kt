package net.crimsys.app

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import androidx.work.ExistingWorkPolicy
import androidx.work.WorkManager
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import net.crimsys.app.data.sync.SyncManager
import net.crimsys.app.data.sync.SyncWorker

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
 *  - The Haris sync-command queue (evidence chain events, legal
 *    attestations, pending queries) is drained by [SyncWorker]: a KEEP
 *    request is scheduled at boot so a process restart with a non-empty
 *    queue cannot strand commands (the CONNECTED constraint parks the
 *    request until a network exists).
 *
 * Implements [Configuration.Provider] with the Hilt worker factory so
 * @HiltWorker injection works with on-demand WorkManager initialization
 * (the default initializer is removed in the manifest).
 */
@HiltAndroidApp
class CrimSysApplication : Application(), Configuration.Provider {

    @Inject
    lateinit var syncManager: SyncManager

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
        // Boot-time drain for the Haris command queue. KEEP: never stack a
        // duplicate chain — repositories enqueue their own expedited
        // APPEND_OR_REPLACE requests on every queued write.
        SyncWorker.schedule(WorkManager.getInstance(this), ExistingWorkPolicy.KEEP)
    }
}
