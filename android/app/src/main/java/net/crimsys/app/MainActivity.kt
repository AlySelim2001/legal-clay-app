package net.crimsys.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import dagger.hilt.android.AndroidEntryPoint
import net.crimsys.app.ui.CrimSysApp
import net.crimsys.app.ui.theme.CrimSysTheme

/**
 * Single-activity entry point. All screens are Compose destinations inside
 * [CrimSysApp]'s NavHost. The activity extends AppCompatActivity so that
 * AppCompatDelegate per-app locale switching (Arabic-first) works back to
 * older API levels.
 */
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val darkTheme = isSystemInDarkTheme()
            CrimSysTheme(darkTheme = darkTheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    // The app is RTL-first: pin the layout direction unless the
                    // resolved locale is LTR (e.g. user switched to English).
                    val isRtl =
                        androidx.core.os.LocaleListCompat
                            .getDefault()[0]?.language == "ar" ||
                            LocalLayoutDirection.current == LayoutDirection.Rtl
                    CompositionLocalProvider(
                        LocalLayoutDirection provides if (isRtl) LayoutDirection.Rtl else LayoutDirection.Ltr,
                    ) {
                        CrimSysApp()
                    }
                }
            }
        }
    }
}
