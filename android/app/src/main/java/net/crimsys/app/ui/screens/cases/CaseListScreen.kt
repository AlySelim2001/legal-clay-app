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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import net.crimsys.app.R
import net.crimsys.app.core.AppError
import net.crimsys.app.data.local.CaseEntity
import net.crimsys.app.ui.components.ClayCard
import net.crimsys.app.ui.components.clayInset
import net.crimsys.app.ui.theme.ClayPrimary
import net.crimsys.app.ui.theme.UrgencyCritical
import net.crimsys.app.ui.theme.UrgencyHigh
import net.crimsys.app.ui.theme.UrgencyNormal

@Composable
fun CaseListScreen(
    onCaseClick: (String) -> Unit,
    viewModel: CaseListViewModel = hiltViewModel(),
) {
    val cases by viewModel.cases.collectAsState()
    val isOnline by viewModel.isOnline.collectAsState()
    val pendingCount by viewModel.pendingCount.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val draft by viewModel.draft.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    val context = LocalContext.current

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            val message = when (event) {
                is CaseListViewModel.Event.SaveFailed ->
                    when (val error = event.error) {
                        is AppError.Validation -> error.message
                        else -> context.getString(R.string.error_unknown)
                    }
                CaseListViewModel.Event.CaseSaved ->
                    context.getString(R.string.case_saved_locally)
            }
            snackbarHostState.showSnackbar(message)
        }
    }

    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
        ) {
            SyncBanner(isOnline, pendingCount, isSyncing)
            HeaderRow(onAddClick = viewModel::openCreateDialog)
            if (cases.isEmpty()) {
                EmptyState()
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    items(cases, key = { it.id }) { case ->
                        CaseCard(case = case, onClick = { onCaseClick(case.id) })
                    }
                    item { Spacer(Modifier.height(24.dp)) }
                }
            }
        }
        SnackbarHost(snackbarHostState, Modifier.align(Alignment.BottomCenter))
    }

    draft?.let { d ->
        AddCaseDialog(
            draft = d,
            onDismiss = viewModel::dismissCreateDialog,
            onSubmit = viewModel::submitDraft,
            onCaseNumberChange = { v -> viewModel.updateDraft { it.copy(caseNumber = v) } },
            onCourtNameChange = { v -> viewModel.updateDraft { it.copy(courtName = v) } },
            onCaseTypeChange = { v -> viewModel.updateDraft { it.copy(caseType = v) } },
        )
    }
}

@Composable
private fun HeaderRow(onAddClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            stringResource(R.string.cases_title),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.weight(1f),
        )
        Button(onClick = onAddClick) {
            Icon(Icons.Filled.Add, contentDescription = null)
            Spacer(Modifier.width(6.dp))
            Text(stringResource(R.string.case_add_title))
        }
    }
}

@Composable
private fun SyncBanner(
    isOnline: Boolean,
    pendingCount: Int,
    isSyncing: Boolean,
) {
    val (text, tint) =
        when {
            isSyncing -> stringResource(R.string.syncing) to ClayPrimary
            !isOnline && pendingCount > 0 ->
                stringResource(R.string.sync_offline) to UrgencyCritical
            !isOnline ->
                stringResource(R.string.sync_offline) to MaterialTheme.colorScheme.outline
            pendingCount > 0 ->
                stringResource(R.string.sync_pending, pendingCount) to UrgencyHigh
            else -> stringResource(R.string.sync_synced) to UrgencyNormal
        }

    Row(
        Modifier
            .fillMaxWidth()
            .padding(top = 8.dp)
            .clayInset(RoundedCornerShape(18.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(8.dp)
                .background(tint, RoundedCornerShape(50)),
        )
        Spacer(Modifier.width(10.dp))
        Text(text, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun CaseCard(case: CaseEntity, onClick: () -> Unit) {
    ClayCard(modifier = Modifier.fillMaxWidth(), onClick = onClick) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(42.dp)
                        .background(ClayPrimary, RoundedCornerShape(14.dp)),
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
                    Text(case.caseNumber, style = MaterialTheme.typography.titleMedium)
                    Text(
                        case.courtName,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Box(
                    Modifier
                        .size(10.dp)
                        .background(
                            if (case.isSynced) UrgencyNormal else UrgencyHigh,
                            RoundedCornerShape(50),
                        ),
                )
            }
            Spacer(Modifier.height(10.dp))
            Text(
                text = case.caseType,
                style = MaterialTheme.typography.labelMedium,
                color = ClayPrimary,
                modifier =
                    Modifier
                        .clayInset(RoundedCornerShape(10.dp))
                        .padding(horizontal = 10.dp, vertical = 4.dp),
            )
        }
    }
}

@Composable
private fun EmptyState() {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            stringResource(R.string.cases_empty),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun AddCaseDialog(
    draft: CaseDraftUi,
    onDismiss: () -> Unit,
    onSubmit: () -> Unit,
    onCaseNumberChange: (String) -> Unit,
    onCourtNameChange: (String) -> Unit,
    onCaseTypeChange: (String) -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.case_add_title)) },
        text = {
            Column {
                OutlinedTextField(
                    value = draft.caseNumber,
                    onValueChange = onCaseNumberChange,
                    label = { Text(stringResource(R.string.case_number)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = draft.courtName,
                    onValueChange = onCourtNameChange,
                    label = { Text(stringResource(R.string.court_name)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = draft.caseType,
                    onValueChange = onCaseTypeChange,
                    label = { Text(stringResource(R.string.case_type)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onSubmit) { Text(stringResource(R.string.save)) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.cancel)) }
        },
    )
}
