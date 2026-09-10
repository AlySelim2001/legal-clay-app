package net.crimsys.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.CloudSync
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Gavel
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.ReportProblem
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.DockedSearchBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.material3.DrawerValue
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import kotlinx.coroutines.launch
import net.crimsys.app.R
import net.crimsys.app.ui.components.clayInset
import net.crimsys.app.ui.components.claySurface
import net.crimsys.app.ui.theme.ClayPrimary
import net.crimsys.app.ui.theme.UrgencyCritical

/** One entry in the RTL navigation drawer. */
private data class DrawerEntry(
    val route: String,
    val labelRes: Int,
    val icon: ImageVector,
)

private val mainEntries =
    listOf(
        DrawerEntry(Routes.DASHBOARD, R.string.nav_dashboard, Icons.Filled.Gavel),
        DrawerEntry(Routes.CASES, R.string.nav_cases, Icons.Filled.Folder),
        DrawerEntry(Routes.CLIENTS, R.string.nav_clients, Icons.Filled.Groups),
        DrawerEntry(Routes.CALENDAR, R.string.nav_calendar, Icons.Filled.CloudSync), // placeholder icon
        DrawerEntry(Routes.DEADLINES, R.string.nav_deadlines, Icons.Filled.Notifications),
        DrawerEntry(Routes.DEFENSES, R.string.nav_defenses, Icons.Filled.Gavel),
        DrawerEntry(Routes.ARCHIVE, R.string.nav_archive, Icons.Filled.Folder),
        DrawerEntry(Routes.LEGAL_FRAMEWORK, R.string.nav_legal_framework, Icons.Filled.Search),
        DrawerEntry(Routes.LEGAL_INTELLIGENCE, R.string.nav_legal_intelligence, Icons.Filled.CloudSync),
    )

private val adminEntries =
    listOf(
        DrawerEntry(Routes.ADMIN_TEAM, R.string.nav_admin_team, Icons.Filled.Groups),
        DrawerEntry(Routes.SETTINGS, R.string.nav_settings, Icons.Filled.Settings),
        DrawerEntry(Routes.ABOUT, R.string.nav_about, Icons.Filled.Info),
    )

/** Central route table (single-activity Compose navigation). */
object Routes {
    const val DASHBOARD = "dashboard"
    const val CASES = "cases"
    const val CASE_DETAIL = "cases/{caseId}"
    const val CLIENTS = "clients"
    const val CLIENT_DETAIL = "clients/{clientId}"
    const val CALENDAR = "calendar"
    const val DEADLINES = "deadlines"
    const val DEFENSES = "defenses"
    const val ARCHIVE = "archive"
    const val LEGAL_FRAMEWORK = "legal-framework"
    const val LEGAL_INTELLIGENCE = "legal-intelligence"
    const val ADMIN_TEAM = "admin/team"
    const val SETTINGS = "settings"
    const val ABOUT = "about"
    const val MEMO_EDITOR = "cases/{caseId}/memo"

    fun caseDetail(caseId: String) = "cases/$caseId"
    fun clientDetail(clientId: String) = "clients/$clientId"
    fun memoEditor(caseId: String) = "cases/$caseId/memo"
}

/**
 * App scaffold: top bar + right-side RTL drawer + NavHost.
 *
 * The drawer anchors to the *end* edge — in an RTL layout [ModalNavigationDrawer]
 * renders it on the left physically, which is what Arabic users expect (the
 * drawer mirrors the LTR "left drawer" convention).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CrimSysApp(syncViewModel: SyncStatusViewModel = hiltViewModel()) {
    val navController = rememberNavController()
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val layoutDirection = LocalLayoutDirection.current

    val isOnline by syncViewModel.isOnline.collectAsState()
    val isSyncing by syncViewModel.isSyncing.collectAsState()
    val pending by syncViewModel.pendingActions.collectAsState()
    val deadLettered by syncViewModel.deadLettered.collectAsState()

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    val openDrawer: () -> Unit = {
        scope.launch { drawerState.open() }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        // End edge in RTL = left side of the screen (mirror of LTR).
        gesturesEnabled = true,
        drawerContent = {
            ModalDrawerSheet(
                drawerShape = RoundedCornerShape(topEnd = 28.dp, bottomEnd = 28.dp),
                windowInsets = androidx.compose.foundation.layout.WindowInsets(0),
            ) {
                DrawerContent(
                    currentRoute = currentRoute,
                    onNavigate = { route ->
                        scope.launch { drawerState.close() }
                        navController.navigate(route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
        },
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.background),
        ) {
            CrimSysTopBar(
                titleRes = titleForRoute(currentRoute),
                isOnline = isOnline,
                isSyncing = isSyncing,
                pendingCount = pending,
                deadLetteredCount = deadLettered,
                onMenuClick = openDrawer,
            )

            Box(Modifier.fillMaxSize()) {
                CrimSysNavHost(navController)
            }
        }
    }
}

@Composable
private fun titleForRoute(route: String?): Int =
    when (route) {
        Routes.DASHBOARD -> R.string.nav_dashboard
        Routes.CASES -> R.string.nav_cases
        Routes.CLIENTS -> R.string.nav_clients
        Routes.CALENDAR -> R.string.nav_calendar
        Routes.DEADLINES -> R.string.nav_deadlines
        Routes.DEFENSES -> R.string.nav_defenses
        Routes.ARCHIVE -> R.string.nav_archive
        Routes.LEGAL_FRAMEWORK -> R.string.nav_legal_framework
        Routes.LEGAL_INTELLIGENCE -> R.string.nav_legal_intelligence
        Routes.ADMIN_TEAM -> R.string.nav_admin_team
        Routes.SETTINGS -> R.string.nav_settings
        Routes.ABOUT -> R.string.nav_about
        else -> R.string.app_name
    }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CrimSysTopBar(
    titleRes: Int,
    isOnline: Boolean,
    isSyncing: Boolean,
    pendingCount: Int,
    deadLetteredCount: Int,
    onMenuClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        IconButton(onClick = onMenuClick) {
            Icon(Icons.Filled.Menu, contentDescription = stringResource(R.string.menu_open_drawer))
        }

        Text(
            text = stringResource(titleRes),
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.weight(1f),
        )

        // P1 — Dead Letter Queue warning: persistent, critical-tinted chip.
        // Takes visual precedence over the passive sync-state icons because a
        // dead-lettered mutation will NOT retry on its own.
        if (deadLetteredCount > 0) {
            Row(
                modifier =
                    Modifier
                        .clayInset(RoundedCornerShape(12.dp))
                        .background(UrgencyCritical.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Filled.ReportProblem,
                    contentDescription = null,
                    tint = UrgencyCritical,
                    modifier = Modifier.size(16.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = stringResource(R.string.sync_dead_letter, deadLetteredCount),
                    style = MaterialTheme.typography.labelMedium,
                    color = UrgencyCritical,
                )
            }
            Spacer(Modifier.width(10.dp))
        }

        // Sync status icon: cloud with check / cross / progress ring.
        when {
            isSyncing -> {
                Icon(
                    Icons.Filled.CloudSync,
                    contentDescription = stringResource(R.string.syncing),
                    tint = ClayPrimary,
                )
            }
            isOnline && pendingCount == 0 -> {
                Icon(
                    Icons.Filled.CloudDone,
                    contentDescription = stringResource(R.string.sync_synced),
                    tint = MaterialTheme.colorScheme.secondary,
                )
            }
            isOnline -> {
                Icon(
                    Icons.Filled.CloudSync,
                    contentDescription = stringResource(R.string.sync_pending, pendingCount),
                    tint = MaterialTheme.colorScheme.secondary,
                )
            }
            else -> {
                Icon(
                    Icons.Filled.CloudOff,
                    contentDescription = stringResource(R.string.sync_offline),
                    tint = MaterialTheme.colorScheme.outline,
                )
            }
        }

        IconButton(onClick = { /* TODO: notifications center */ }) {
            Icon(Icons.Filled.Notifications, contentDescription = stringResource(R.string.action_notifications))
        }

        IconButton(onClick = { /* TODO: profile menu */ }) {
            Icon(Icons.Filled.AccountCircle, contentDescription = stringResource(R.string.action_profile))
        }
    }

    if (isSyncing || (!isOnline && pendingCount > 0)) {
        LinearProgressIndicator(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
            color = ClayPrimary,
            trackColor = MaterialTheme.colorScheme.surfaceVariant,
        )
    }
}

@Composable
private fun DrawerContent(
    currentRoute: String?,
    onNavigate: (String) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxHeight()
                .fillMaxWidth(0.82f)
                .background(MaterialTheme.colorScheme.surface)
                .statusBarsPadding()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
    ) {
        // Brand block
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(44.dp)
                    .background(ClayPrimary, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Gavel, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary)
            }
            Spacer(Modifier.width(12.dp))
            Column {
                Text("CRIM-SYS 2026", style = MaterialTheme.typography.titleMedium)
                Text(
                    "منظومة إدارة القضايا",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Spacer(Modifier.height(20.dp))

        mainEntries.forEach { entry ->
            NavigationDrawerItem(
                label = { Text(stringResource(entry.labelRes)) },
                icon = { Icon(entry.icon, contentDescription = null) },
                selected = currentRoute == entry.route,
                onClick = { onNavigate(entry.route) },
                shape = MaterialTheme.shapes.medium,
            )
        }

        Spacer(Modifier.height(12.dp))
        Text(
            stringResource(R.string.section_admin),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = 16.dp, bottom = 6.dp),
        )
        adminEntries.forEach { entry ->
            NavigationDrawerItem(
                label = { Text(stringResource(entry.labelRes)) },
                icon = { Icon(entry.icon, contentDescription = null) },
                selected = currentRoute == entry.route,
                onClick = { onNavigate(entry.route) },
                shape = MaterialTheme.shapes.medium,
            )
        }

        Spacer(Modifier.weight(1f))
        NavigationDrawerItem(
            label = { Text(stringResource(R.string.nav_login)) },
            icon = { Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = null) },
            selected = false,
            onClick = { onNavigate(Routes.SETTINGS) },
            shape = MaterialTheme.shapes.medium,
        )
    }
}
