package net.crimsys.app.ui.screens.cases

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import net.crimsys.app.R
import net.crimsys.app.data.local.CaseEntity
import net.crimsys.app.data.local.HearingEntity
import net.crimsys.app.ui.components.ClayCard
import net.crimsys.app.ui.components.clayInset
import net.crimsys.app.ui.theme.ClayPrimary
import net.crimsys.app.ui.theme.UrgencyNormal

/**
 * Detailed case file: identity block, metadata, legal memo preview and the
 * scheduled sessions feed. RTL-safe: all spacing uses start/end-agnostic
 * Row/Column ordering which mirrors automatically under RTL.
 */
@Composable
fun CaseDetailScreen(
    caseId: String,
    onBack: () -> Unit,
    onOpenMemo: (String) -> Unit,
    viewModel: CaseDetailViewModel = hiltViewModel(),
) {
    LaunchedEffect(caseId) { viewModel.load(caseId) }

    val case by viewModel.case.collectAsState()
    val hearings by viewModel.hearings.collectAsState()

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
    ) {
        // ── Header ──────────────────────────────────────────────────────────
        Row(
            Modifier
                .fillMaxWidth()
                .padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onBack) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.menu_open_drawer),
                )
            }
            Text(
                text = case?.caseNumber ?: stringResource(R.string.nav_case_detail),
                style = MaterialTheme.typography.headlineSmall,
                modifier = Modifier.weight(1f),
            )
        }

        if (case == null) {
            Text(
                text = stringResource(R.string.error_unknown),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            return@Column
        }

        val c = case!!

        IdentityCard(c)

        Spacer(Modifier.height(14.dp))

        // ── Legal memo ──────────────────────────────────────────────────────
        ClayCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(18.dp)) {
                Text(
                    stringResource(R.string.case_detail_memo_section),
                    style = MaterialTheme.typography.titleMedium,
                )
                Spacer(Modifier.height(8.dp))
                if (c.memoHtml.isBlank()) {
                    Text(
                        stringResource(R.string.case_detail_no_memo),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    Text(
                        // Plain-text preview; the rich editor renders full HTML.
                        text = stripHtml(c.memoHtml),
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 4,
                    )
                }
                Spacer(Modifier.height(10.dp))
                OutlinedButton(onClick = { onOpenMemo(c.id) }) {
                    Icon(Icons.Filled.Edit, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text(
                        stringResource(
                            if (c.memoHtml.isBlank()) R.string.case_detail_edit_memo else R.string.open_memo,
                        ),
                    )
                }
            }
        }

        Spacer(Modifier.height(14.dp))

        // ── Sessions ────────────────────────────────────────────────────────
        Text(
            stringResource(R.string.case_detail_hearings_section),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(vertical = 6.dp),
        )
        if (hearings.isEmpty()) {
            Text(
                stringResource(R.string.case_detail_no_hearings),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                hearings.forEach { hearing -> HearingRow(hearing) }
            }
        }

        Spacer(Modifier.height(28.dp))
    }
}

@Composable
private fun IdentityCard(c: CaseEntity) {
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
                        Icons.Filled.Gavel,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimary,
                    )
                }
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(c.caseNumber, style = MaterialTheme.typography.titleLarge)
                    Text(
                        text = if (c.isSynced) {
                            stringResource(R.string.sync_synced)
                        } else {
                            stringResource(R.string.sync_pending, 1)
                        },
                        style = MaterialTheme.typography.labelMedium,
                        color = if (c.isSynced) UrgencyNormal else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            Spacer(Modifier.height(14.dp))

            MetaRow(
                label = stringResource(R.string.case_detail_court_label),
                value = c.courtName,
                icon = { Icon(Icons.Filled.AccountBalance, contentDescription = null) },
            )
            Spacer(Modifier.height(8.dp))
            MetaRow(
                label = stringResource(R.string.case_detail_type_label),
                value = c.caseType,
                icon = null,
            )
            Spacer(Modifier.height(8.dp))
            MetaRow(
                label = stringResource(R.string.case_detail_created_label),
                value = formatDate(c.createdAt),
                icon = null,
            )
        }
    }
}

@Composable
private fun MetaRow(
    label: String,
    value: String,
    icon: (@Composable () -> Unit)?,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clayInset(RoundedCornerShape(14.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        icon?.invoke()
        if (icon != null) Spacer(Modifier.width(10.dp))
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.width(10.dp))
        Text(
            value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun HearingRow(hearing: HearingEntity) {
    ClayCard(Modifier.fillMaxWidth(), elevation = 6.dp) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(38.dp)
                    .background(ClayPrimary.copy(alpha = 0.15f), RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.AccountBalance,
                    contentDescription = null,
                    tint = ClayPrimary,
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(hearing.courtName, style = MaterialTheme.typography.titleSmall)
                Text(
                    hearing.timeLabel,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

private fun stripHtml(html: String): String =
    html
        .replace(Regex("<[^>]*>"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()

private val dateFormatter = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)

private fun formatDate(epochMillis: Long): String =
    Instant.ofEpochMilli(epochMillis)
        .atZone(ZoneId.systemDefault())
        .toLocalDate()
        .format(dateFormatter)
