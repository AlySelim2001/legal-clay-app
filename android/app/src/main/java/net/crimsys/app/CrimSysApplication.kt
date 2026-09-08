package net.crimsys.app

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import dagger.hilt.android.HiltAndroidApp

/**
 * CRIM-SYS 2026 application class.
 *
 * Forces Arabic-first locale + RTL as the app default. Per-app language
 * (Android 13+ system settings) still overrides this.
 */
@HiltAndroidApp
class CrimSysApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        // Arabic-first: default locale for all AppCompat activities.
        AppCompatDelegate.setApplicationLocales(
            LocaleListCompat.forLanguageTags("ar"),
        )
    }
}
