package net.crimsys.app

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dagger.hilt.android.AndroidEntryPoint
import net.crimsys.app.core.LockState
import net.crimsys.app.ui.CrimSysApp
import net.crimsys.app.ui.screens.lock.LockScreen
import net.crimsys.app.ui.screens.lock.LockViewModel
import net.crimsys.app.ui.theme.CrimSysTheme

/**
 * Single-activity entry point. All screens are Compose destinations inside
 * [CrimSysApp]'s NavHost. The activity extends AppCompatActivity so that
 * AppCompatDelegate per-app locale switching (Arabic-first) works back to
 * older API levels.
 *
 * R1 remediation:
 *  - [LockScreen] gates [CrimSysApp]: while locked, no case-data composable
 *    exists in the hierarchy at all.
 *  - [WindowManager.LayoutParams.FLAG_SECURE] blanks recents/app-switcher
 *    thumbnails so case details cannot be screenshotted or read from the
 *    task switcher.
 *  - Stopping the activity (app backgrounded) re-arms the lock.
 */
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // OWASP M1: block screenshots and recents thumbnails of legal data.
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE,
        )

        setContent {
            val darkTheme = isSystemInDarkTheme()
            CrimSysTheme(darkTheme = darkTheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    // The app is RTL-first: pin the layout direction unless the
                    // resolved locale is LTR (e.g. user switched to English).
                    // P1: read the EFFECTIVE per-app locales —
                    // AppCompatDelegate.getApplicationLocales() returns the user's
                    // in-app choice (set in Settings) or the application default,
                    // while LocaleListCompat.getDefault() returns the OS locale list,
                    // which ignores the in-app override entirely and could render a
                    // chosen-English session with an RTL-pinned layout (or vice versa).
                    val resolvedLocale = AppCompatDelegate.getApplicationLocales()[0]
                        ?: resources.configuration.locales[0]
                    val isRtl =
                        resolvedLocale.language == "ar" ||
                            LocalLayoutDirection.current == LayoutDirection.Rtl
                    CompositionLocalProvider(
                        LocalLayoutDirection provides if (isRtl) LayoutDirection.Rtl else LayoutDirection.Ltr,
                    ) {
                        val lockViewModel: LockViewModel = hiltViewModel()
                        val lockState by lockViewModel.lockState.collectAsStateWithLifecycle()

                        // Re-arm the lock every time the activity stops
                        // (home, overview, screen off) — no combination of
                        // navigation or process state leaves it unlocked.
                        LifecycleEventEffect(Lifecycle.Event.ON_STOP) {
                            lockViewModel.onAppBackgrounded()
                        }

                        if (lockState == LockState.Unlocked) {
                            CrimSysApp()
                        } else {
                            LockScreen(
                                viewModel = lockViewModel,
                                onUnlocked = { /* state flip recomposes to CrimSysApp */ },
                            )
                        }
                    }
                }
            }
        }
    }
}
