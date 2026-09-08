package net.crimsys.app

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import net.crimsys.app.data.sync.SyncManager

/**
 * CRIM-SYS 2026 application class.
 *
 * Forces Arabic-first locale + RTL as the app default. Per-app language
 * (Android 13+ system settings) still overrides this.
 *
 * Also boots the offline-first sync loop: [SyncManager] listens to
 * [net.crimsys.app.data.sync.NetworkMonitor] in an application-scoped
 * [CoroutineScope] and drains the Offline Action Queue whenever
 * connectivity returns — independent of any screen being open.
 */
@HiltAndroidApp
class CrimSysApplication : Application() {

    @Inject
    lateinit var syncManager: SyncManager

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        // Arabic-first: default locale for all AppCompat activities.
        AppCompatDelegate.setApplicationLocales(
            LocaleListCompat.forLanguageTags("ar"),
        )
        syncManager.start(appScope)
    }
}
