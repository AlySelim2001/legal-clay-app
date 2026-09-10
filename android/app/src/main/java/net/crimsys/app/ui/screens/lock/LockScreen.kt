package net.crimsys.app.ui.screens.lock

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import net.crimsys.app.R
import net.crimsys.app.core.LockState
import net.crimsys.app.core.SetupLock
import net.crimsys.app.ui.components.ClayCard

/**
 * Full-screen app lock (R1). Rendered INSTEAD of [net.crimsys.app.ui.CrimSysApp]
 * while locked — case data is never composed behind it, so nothing is
 * visible via screen scraping, recents thumbnails are controlled by
 * FLAG_SECURE (MainActivity), and TalkBack never reaches case rows.
 *
 * Flow:
 *  1. Locked → the biometric/credential prompt auto-launches once per state.
 *  2. NoAuthenticator → explains why and routes to system Settings.
 *  3. Failed (lockout) → manual retry button only.
 *  4. Unlocked → [onUnlocked] swaps in the real app content.
 *
 * RTL: direction-neutral layout (symmetric padding, centered text) — correct
 * under Arabic composition without any directional modifiers.
 */
@Composable
fun LockScreen(
    viewModel: LockViewModel,
    onUnlocked: () -> Unit,
) {
    val state by viewModel.lockState.collectAsStateWithLifecycle()
    val activity = LocalContext.current as? FragmentActivity

    // Auto-prompt exactly once per lock screen instance. After a deliberate
    // cancel the manual unlock button takes over — relaunching the prompt
    // automatically would trap the user in a cancel/prompt loop.
    var autoPromptArmed by rememberSaveable { mutableStateOf(true) }
    LaunchedEffect(state) {
        if (activity != null && state == LockState.Locked && autoPromptArmed) {
            autoPromptArmed = false
            viewModel.authenticate(activity)
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .systemBarsPadding()
                .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        ClayCard(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Icon(
                    imageVector = Icons.Filled.Lock,
                    contentDescription = stringResource(R.string.lock_icon_cd),
                    modifier = Modifier.size(56.dp),
                    tint = MaterialTheme.colorScheme.primary,
                )

                when (state) {
                    LockState.Unlocked -> LaunchedEffect(Unit) { onUnlocked() }

                    LockState.Locked, LockState.InProgress -> {
                        Text(
                            text = stringResource(R.string.lock_title),
                            style = MaterialTheme.typography.headlineSmall,
                            textAlign = TextAlign.Center,
                        )
                        Text(
                            text = stringResource(R.string.lock_subtitle),
                            style = MaterialTheme.typography.bodyMedium,
                            textAlign = TextAlign.Center,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        if (state == LockState.Locked && !autoPromptArmed) {
                            val ctx = activity
                            Button(
                                onClick = { if (ctx != null) viewModel.unlock(ctx) },
                            ) {
                                Text(stringResource(R.string.lock_unlock))
                            }
                        }
                    }

                    LockState.NoAuthenticator -> {
                        Text(
                            text = stringResource(R.string.lock_title),
                            style = MaterialTheme.typography.headlineSmall,
                            textAlign = TextAlign.Center,
                        )
                        Text(
                            text = stringResource(R.string.lock_no_authenticator),
                            style = MaterialTheme.typography.bodyMedium,
                            textAlign = TextAlign.Center,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        val ctx = activity
                        Button(
                            onClick = { if (ctx != null) SetupLock.launchSettings(ctx) },
                        ) {
                            Text(stringResource(R.string.lock_enroll_action))
                        }
                    }

                    LockState.Failed -> {
                        Text(
                            text = stringResource(R.string.lock_title),
                            style = MaterialTheme.typography.headlineSmall,
                            textAlign = TextAlign.Center,
                        )
                        Text(
                            text = stringResource(R.string.lock_failed),
                            style = MaterialTheme.typography.bodyMedium,
                            textAlign = TextAlign.Center,
                            color = MaterialTheme.colorScheme.error,
                        )
                        val ctx = activity
                        OutlinedButton(
                            onClick = { if (ctx != null) viewModel.relockAndRetry(ctx) },
                        ) {
                            Text(stringResource(R.string.lock_retry))
                        }
                    }
                }
                Spacer(Modifier.height(4.dp))
            }
        }
    }
}
