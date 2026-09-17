package net.crimsys.app.ui.screens.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import net.crimsys.app.R
import net.crimsys.app.ui.components.ClayCard
import net.crimsys.app.ui.components.state.EmptyState
import net.crimsys.app.ui.components.state.OfflineState
import net.crimsys.app.ui.components.state.SyncPendingState

@Composable
fun DashboardScreen(viewModel: DashboardViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text(stringResource(R.string.dashboard_title), style = MaterialTheme.typography.headlineSmall) }
        if (!state.isOnline) item { OfflineState() }
        if (state.pendingSync > 0) item { SyncPendingState(state.pendingSync) }
        if (state.cases == 0) item { EmptyState(stringResource(R.string.dashboard_empty), stringResource(R.string.case_add_title)) }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MetricCard(stringResource(R.string.dashboard_open_cases), state.cases.toString(), Modifier.weight(1f))
                MetricCard(stringResource(R.string.dashboard_upcoming), state.upcomingHearings.toString(), Modifier.weight(1f))
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MetricCard(stringResource(R.string.dashboard_deadlines), state.upcomingHearings.toString(), Modifier.weight(1f))
                MetricCard(stringResource(R.string.dashboard_catalog), state.verifiedDocuments.toString(), Modifier.weight(1f))
            }
        }
        if (state.deadLetters > 0) item { Text(stringResource(R.string.dashboard_dead_letters, state.deadLetters), color = MaterialTheme.colorScheme.error) }
    }
}

@Composable
private fun MetricCard(label: String, value: String, modifier: Modifier) {
    ClayCard(modifier) { Column(Modifier.padding(16.dp)) { Text(value, style = MaterialTheme.typography.headlineMedium); Text(label, style = MaterialTheme.typography.bodySmall) } }
}
