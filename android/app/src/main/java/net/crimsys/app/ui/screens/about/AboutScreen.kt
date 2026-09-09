package net.crimsys.app.ui.screens.about

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import net.crimsys.app.R
import net.crimsys.app.ui.components.ClayCard
import net.crimsys.app.ui.components.clayInset
import net.crimsys.app.ui.theme.ClayPrimary
import net.crimsys.app.ui.theme.UrgencyNormal

/**
 * "حول التطبيق" screen: app identity, the in-app update check against GitHub
 * Releases, and the full legal disclaimer from DISCLAIMER.md rendered in-app —
 * the launch-strategy requirement that the disclaimer ship inside the app, not
 * only in the repository.
 *
 * RTL-safe: start/end-agnostic Row/Column ordering mirrors automatically.
 */
@Composable
fun AboutScreen(viewModel: AboutViewModel = hiltViewModel()) {
    val context = LocalContext.current
    val state by viewModel.updateState.collectAsState()

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
    ) {
        // ── Identity card ───────────────────────────────────────────────────
        ClayCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(46.dp)
                            .background(ClayPrimary, RoundedCornerShape(16.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.Info,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onPrimary,
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            stringResource(R.string.app_name),
                            style = MaterialTheme.typography.titleLarge,
                        )
                        Text(
                            text = stringResource(R.string.about_version, viewModel.currentVersion),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(14.dp))

        // ── Update check card ───────────────────────────────────────────────
        ClayCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.SystemUpdate,
                        contentDescription = null,
                        tint = ClayPrimary,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        stringResource(R.string.about_updates_title),
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.weight(1f),
                    )
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    stringResource(R.string.about_updates_hint),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(12.dp))

                when (val s = state) {
                    UpdateUiState.Checking -> {
                        LinearProgressIndicator(
                            Modifier.fillMaxWidth(),
                            color = ClayPrimary,
                        )
                    }
                    is UpdateUiState.Done -> {
                        val update = s.update
                        if (update == null) {
                            Text(
                                stringResource(R.string.about_update_latest),
                                style = MaterialTheme.typography.bodyMedium,
                                color = UrgencyNormal,
                            )
                        } else {
                            Text(
                                text = stringResource(R.string.about_update_available, update.tagName),
                                style = MaterialTheme.typography.bodyMedium,
                                color = ClayPrimary,
                            )
                            Spacer(Modifier.height(10.dp))
                            Button(onClick = { openReleasePage(context, update.htmlUrl) }) {
                                Text(stringResource(R.string.about_update_download))
                                Spacer(Modifier.width(6.dp))
                                Icon(Icons.Filled.OpenInNew, contentDescription = null)
                            }
                            Spacer(Modifier.height(6.dp))
                            Text(
                                stringResource(R.string.about_update_install_hint),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    is UpdateUiState.Failed -> {
                        Text(
                            stringResource(R.string.about_update_failed),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                    UpdateUiState.Idle -> Unit
                }

                Spacer(Modifier.height(12.dp))
                OutlinedButton(onClick = { viewModel.checkForUpdates() }) {
                    Text(stringResource(R.string.about_update_check))
                }
            }
        }

        Spacer(Modifier.height(14.dp))

        // ── Disclaimer card ─────────────────────────────────────────────────
        ClayCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Filled.VerifiedUser,
                        contentDescription = null,
                        tint = ClayPrimary,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        stringResource(R.string.about_disclaimer_title),
                        style = MaterialTheme.typography.titleMedium,
                    )
                }
                Spacer(Modifier.height(10.dp))
                DisclaimerSection(stringResource(R.string.about_disclaimer_intro))
                DisclaimerSection(stringResource(R.string.about_disclaimer_liability))
                DisclaimerSection(stringResource(R.string.about_disclaimer_verification))
                HorizontalDivider(Modifier.padding(vertical = 8.dp))
                DisclaimerSection(stringResource(R.string.about_disclaimer_privacy_title))
                DisclaimerSection(stringResource(R.string.about_disclaimer_privacy_body))
                DisclaimerSection(stringResource(R.string.about_disclaimer_updates))
            }
        }

        Spacer(Modifier.height(14.dp))

        // ── Links card ──────────────────────────────────────────────────────
        ClayCard(Modifier.fillMaxWidth(), elevation = 6.dp) {
            Column(Modifier.padding(18.dp)) {
                LinkRow(stringResource(R.string.about_links_repository))
                Spacer(Modifier.height(8.dp))
                LinkRow(stringResource(R.string.about_links_disclaimer))
                Spacer(Modifier.height(8.dp))
                LinkRow(stringResource(R.string.about_links_contact))
            }
        }

        Spacer(Modifier.height(28.dp))
    }
}

@Composable
private fun DisclaimerSection(text: String) {
    Text(
        text = text,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(bottom = 10.dp),
    )
}

@Composable
private fun LinkRow(text: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .clayInset(RoundedCornerShape(14.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}

/**
 * Open a release URL in the user's browser via ACTION_VIEW. The GitHub release
 * page is where the signed APK is attached. ActivityNotFoundException is
 * caught defensively (a device without any browser is a corner case that
 * must never crash the app).
 */
private fun openReleasePage(context: Context, url: String) {
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    } catch (e: ActivityNotFoundException) {
        // No browser installed — nothing sensible to do; the user can still
        // reach the release page from any other device via the README link.
    }
}
