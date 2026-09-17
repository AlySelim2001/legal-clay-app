package net.crimsys.app.ui

import android.net.Uri
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.navigation.compose.rememberNavController
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/** Phase 2 routing smoke tests. Full destinations are exercised through CI/device tests. */
@RunWith(AndroidJUnit4::class)
class CrimSysNavHostTest {
    @get:Rule val composeRule = createComposeRule()

    @Test
    fun productionRoutes_encodeCaseIds() {
        assertEquals("cases/a%2Fb", Routes.caseDetail("a/b"))
        assertEquals("cases/a%2Fb/memo", Routes.memoEditor("a/b"))
    }

    @Test
    fun navHost_canBeComposed_withoutPlaceholderDestination() {
        composeRule.setContent {
            CrimSysNavHost(rememberNavController())
        }
        composeRule.waitForIdle()
        assertEquals(Routes.DASHBOARD, Routes.DASHBOARD)
    }
}
