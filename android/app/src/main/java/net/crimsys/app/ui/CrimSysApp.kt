package net.crimsys.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.Text
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.launch
import net.crimsys.app.R

/** Production-visible destinations. Routes not listed here are intentionally not exposed. */
object Routes {
    const val DASHBOARD = "dashboard"
    const val CASES = "cases"
    const val CASE_DETAIL = "cases/{caseId}"
    const val MEMO_EDITOR = "cases/{caseId}/memo"
    const val CALENDAR = "calendar"
    const val LEGAL_FRAMEWORK = "legal-framework"
    const val ABOUT = "about"

    fun caseDetail(caseId: String): String = "cases/${android.net.Uri.encode(caseId)}"
    fun memoEditor(caseId: String): String = "cases/${android.net.Uri.encode(caseId)}/memo"
}

private data class DrawerEntry(
    val route: String,
    @androidx.annotation.StringRes val label: Int,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
)

private val productionEntries = listOf(
    DrawerEntry(Routes.DASHBOARD, R.string.nav_dashboard, Icons.Filled.Gavel),
    DrawerEntry(Routes.CASES, R.string.nav_cases, Icons.Filled.Folder),
    DrawerEntry(Routes.CALENDAR, R.string.nav_calendar, Icons.Filled.CalendarMonth),
    DrawerEntry(Routes.LEGAL_FRAMEWORK, R.string.nav_legal_framework, Icons.Filled.Search),
    DrawerEntry(Routes.ABOUT, R.string.nav_about, Icons.Filled.Info),
)

@Composable
fun CrimSysApp(syncViewModel: SyncStatusViewModel = hiltViewModel()) {
    val navController = rememberNavController()
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val entry by navController.currentBackStackEntryAsState()
    val currentRoute = entry?.destination?.route
    val isOnline by syncViewModel.isOnline.collectAsStateWithLifecycle()
    val pending by syncViewModel.pendingActions.collectAsStateWithLifecycle()
    val dead by syncViewModel.deadLettered.collectAsStateWithLifecycle()

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                Column(Modifier.statusBarsPadding()) {
                    Text(
                        stringResource(R.string.app_name),
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.padding(20.dp),
                    )
                    productionEntries.forEach { item ->
                        NavigationDrawerItem(
                            label = { Text(stringResource(item.label)) },
                            icon = { Icon(item.icon, contentDescription = null) },
                            selected = currentRoute == item.route,
                            onClick = {
                                scope.launch { drawerState.close() }
                                navController.navigateWithDefaultOptions(item.route)
                            },
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 2.dp),
                        )
                    }
                }
            }
        },
    ) {
        Column(Modifier.fillMaxSize()) {
            Row(Modifier.statusBarsPadding()) {
                IconButton(onClick = { scope.launch { drawerState.open() } }) {
                    Icon(Icons.Filled.Menu, contentDescription = stringResource(R.string.menu_open_drawer))
                }
                Text(
                    stringResource(titleForRoute(currentRoute)),
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.weight(1f).padding(top = 12.dp),
                )
                Text(
                    syncStatusLabel(isOnline, pending, dead),
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(12.dp),
                )
            }
            CrimSysNavHost(navController)
        }
    }
}

@Composable
private fun syncStatusLabel(online: Boolean, pending: Int, dead: Int): String = when {
    dead > 0 -> stringResource(R.string.sync_dead_letter, dead)
    !online && pending > 0 -> stringResource(R.string.sync_offline)
    pending > 0 -> stringResource(R.string.sync_pending, pending)
    else -> stringResource(R.string.sync_synced)
}

private fun titleForRoute(route: String?): Int = when (route) {
    Routes.CASES, Routes.CASE_DETAIL, Routes.MEMO_EDITOR -> R.string.nav_cases
    Routes.CALENDAR -> R.string.nav_calendar
    Routes.LEGAL_FRAMEWORK -> R.string.nav_legal_framework
    Routes.ABOUT -> R.string.nav_about
    else -> R.string.nav_dashboard
}
