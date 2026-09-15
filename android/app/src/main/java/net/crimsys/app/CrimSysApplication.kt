package net.crimsys.app

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import net.crimsys.app.data.sync.SyncManager

@HiltAndroidApp
class CrimSysApplication :
    Application(),
    Configuration.Provider {

    @Inject
    lateinit var syncManager: SyncManager

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    private val appScope =
        CoroutineScope(
            SupervisorJob() +
                Dispatchers.IO,
        )

    override fun onCreate() {
        super.onCreate()

        AppCompatDelegate
            .setApplicationLocales(
                LocaleListCompat.forLanguageTags("ar"),
            )

        syncManager.start(appScope)
    }

    override val workManagerConfiguration: Configuration
        get() =
            Configuration.Builder()
                .setWorkerFactory(
                    workerFactory,
                )
                .build()
}
