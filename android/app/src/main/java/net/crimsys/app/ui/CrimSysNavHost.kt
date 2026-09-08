package net.crimsys.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import net.crimsys.app.R
import net.crimsys.app.ui.screens.calendar.HearingsCalendarScreen
import net.crimsys.app.ui.screens.cases.CaseDetailScreen
import net.crimsys.app.ui.screens.cases.CaseListScreen
import net.crimsys.app.ui.screens.cases.MemoEditorScreen

/** Standard bottom/back-stack-safe navigate used by drawer + card taps. */
fun NavHostController.navigateWithDefaultOptions(route: String) {
    navigate(route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

@Composable
fun CrimSysNavHost(navController: NavHostController, modifier: Modifier = Modifier) {
    NavHost(
        navController = navController,
        startDestination = Routes.DASHBOARD,
        modifier = modifier,
    ) {
        composable(Routes.DASHBOARD) {
            PlaceholderScreen(titleRes = R.string.nav_dashboard)
        }

        composable(Routes.CASES) {
            CaseListScreen(
                onCaseClick = { caseId ->
                    navController.navigate(Routes.caseDetail(caseId))
                },
            )
        }

        composable(
            route = Routes.CASE_DETAIL,
            arguments = listOf(navArgument("caseId") { type = NavType.StringType }),
        ) { entry ->
            val caseId = entry.arguments?.getString("caseId").orEmpty()
            CaseDetailScreen(
                caseId = caseId,
                onBack = { navController.popBackStack() },
                onOpenMemo = { navController.navigate(Routes.memoEditor(caseId)) },
            )
        }

        composable(
            route = Routes.MEMO_EDITOR,
            arguments = listOf(navArgument("caseId") { type = NavType.StringType }),
        ) { entry ->
            val caseId = entry.arguments?.getString("caseId").orEmpty()
            MemoEditorScreen(
                caseId = caseId,
                onBack = { navController.popBackStack() },
            )
        }

        composable(Routes.CLIENTS) { PlaceholderScreen(titleRes = R.string.nav_clients) }

        composable(
            route = Routes.CLIENT_DETAIL,
            arguments = listOf(navArgument("clientId") { type = NavType.StringType }),
        ) { PlaceholderScreen(titleRes = R.string.nav_client_detail) }

        composable(Routes.CALENDAR) { HearingsCalendarScreen() }

        composable(Routes.DEADLINES) { PlaceholderScreen(titleRes = R.string.nav_deadlines) }
        composable(Routes.DEFENSES) { PlaceholderScreen(titleRes = R.string.nav_defenses) }
        composable(Routes.ARCHIVE) { PlaceholderScreen(titleRes = R.string.nav_archive) }
        composable(Routes.LEGAL_FRAMEWORK) { PlaceholderScreen(titleRes = R.string.nav_legal_framework) }
        composable(Routes.LEGAL_INTELLIGENCE) { PlaceholderScreen(titleRes = R.string.nav_legal_intelligence) }
        composable(Routes.ADMIN_TEAM) { PlaceholderScreen(titleRes = R.string.nav_admin_team) }
        composable(Routes.SETTINGS) { PlaceholderScreen(titleRes = R.string.nav_settings) }
    }
}
