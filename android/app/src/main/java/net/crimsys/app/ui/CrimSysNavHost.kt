package net.crimsys.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import net.crimsys.app.ui.components.state.ErrorState
import net.crimsys.app.ui.screens.about.AboutScreen
import net.crimsys.app.ui.screens.calendar.HearingsCalendarScreen
import net.crimsys.app.ui.screens.cases.CaseDetailScreen
import net.crimsys.app.ui.screens.cases.CaseListScreen
import net.crimsys.app.ui.screens.cases.MemoEditorScreen
import net.crimsys.app.ui.screens.dashboard.DashboardScreen
import net.crimsys.app.ui.screens.legal.LegalSearchScreen

fun NavHostController.navigateWithDefaultOptions(route: String) {
    navigate(route) {
        launchSingleTop = true
        restoreState = true
    }
}

@Composable
fun CrimSysNavHost(navController: NavHostController, modifier: Modifier = Modifier) {
    NavHost(navController, startDestination = Routes.DASHBOARD, modifier = modifier) {
        composable(Routes.DASHBOARD) { DashboardScreen() }
        composable(Routes.CASES) { CaseListScreen(onCaseClick = { navController.navigate(Routes.caseDetail(it)) }) }
        composable(Routes.CASE_DETAIL, arguments = listOf(navArgument("caseId") { type = NavType.StringType })) { entry ->
            val caseId = entry.arguments?.getString("caseId")
            if (caseId.isNullOrBlank()) ErrorState(message = "معرّف القضية غير صالح", onRetry = { navController.popBackStack() })
            else CaseDetailScreen(caseId = caseId, onBack = { navController.popBackStack() }, onOpenMemo = { navController.navigate(Routes.memoEditor(caseId)) })
        }
        composable(Routes.MEMO_EDITOR, arguments = listOf(navArgument("caseId") { type = NavType.StringType })) { entry ->
            val caseId = entry.arguments?.getString("caseId")
            if (caseId.isNullOrBlank()) ErrorState(message = "معرّف القضية غير صالح", onRetry = { navController.popBackStack() })
            else MemoEditorScreen(caseId = caseId, onBack = { navController.popBackStack() })
        }
        composable(Routes.CALENDAR) { HearingsCalendarScreen() }
        composable(Routes.LEGAL_FRAMEWORK) { LegalSearchScreen() }
        composable(Routes.ABOUT) { AboutScreen() }
    }
}
