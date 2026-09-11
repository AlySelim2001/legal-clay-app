package net.crimsys.app.domain.legal

import java.time.LocalDate
import net.crimsys.app.domain.legal.EgyptianDeadlineCalculator.DeadlineResult
import net.crimsys.app.domain.legal.EgyptianDeadlineCalculator.LegalDeadlineChannel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for the M4 dual-verification deadline calculator.
 *
 * The `now`-dependent field ([DeadlineResult.Verified.daysRemaining]) is
 * deliberately not asserted — everything else (raw deadline, weekend roll,
 * verification status) is deterministic for fixed start dates.
 *
 * The Engine-2 arithmetic itself is additionally cross-verified against a
 * `java.time`-independent reference over 1990–2060 (see repo docs); these
 * tests pin the observable contract.
 */
class EgyptianDeadlineCalculatorTest {

    private val calc = EgyptianDeadlineCalculator()

    // ------------------------------------------------------------------
    // Channel metadata — citation integrity policy
    // ------------------------------------------------------------------
    @Test
    fun `all channels are flagged as needing legal review`() {
        // A wrong legal date is a catastrophe; the badge must ship ON until
        // counsel signs off. If this test fails, counsel signed off — update
        // the flag AND the cited articles together.
        LegalDeadlineChannel.entries.forEach { channel ->
            assertTrue(channel.needsLegalReview)
        }
    }

    @Test
    fun `channel lookup by id round-trips`() {
        LegalDeadlineChannel.entries.forEach { channel ->
            assertEquals(channel, LegalDeadlineChannel.fromId(channel.id))
        }
        assertNull(LegalDeadlineChannel.fromId("nope"))
    }

    // ------------------------------------------------------------------
    // Weekend roll (Fri/Sat → Sunday), verified against reference dates
    // ------------------------------------------------------------------
    @Test
    fun `opposition window landing on Friday rolls to Sunday`() {
        // 2026-09-01 + 10d = 2026-09-11 (Friday) → rolls to 2026-09-13.
        val r = calc.compute(LegalDeadlineChannel.OPPOSITION, LocalDate.of(2026, 9, 1))
        assertTrue(r is DeadlineResult.Verified)
        r as DeadlineResult.Verified
        assertEquals(LocalDate.of(2026, 9, 11), r.rawDeadline)
        assertEquals(LocalDate.of(2026, 9, 13), r.deadline)
        assertTrue(r.wasRolled)
    }

    @Test
    fun `cassation window landing on a weekday is not rolled`() {
        // 2026-09-03 + 60d = 2026-11-02 (Monday) → unchanged.
        val r = calc.compute(LegalDeadlineChannel.CASSATION, LocalDate.of(2026, 9, 3))
        assertTrue(r is DeadlineResult.Verified)
        r as DeadlineResult.Verified
        assertEquals(LocalDate.of(2026, 11, 2), r.deadline)
        assertFalse(r.wasRolled)
    }

    @Test
    fun `roll across a month boundary lands on the first of next month`() {
        // 2026-10-21 + 10d = 2026-10-31 (Saturday) → rolls to 2026-11-01.
        val r = calc.compute(LegalDeadlineChannel.OPPOSITION, LocalDate.of(2026, 10, 21))
        assertTrue(r is DeadlineResult.Verified)
        r as DeadlineResult.Verified
        assertEquals(LocalDate.of(2026, 10, 31), r.rawDeadline)
        assertEquals(LocalDate.of(2026, 11, 1), r.deadline)
        assertTrue(r.wasRolled)
    }

    @Test
    fun `deadline on Saturday rolls exactly one day`() {
        // 2026-10-28 + 10d = 2026-11-07 (Saturday) → rolls to 2026-11-08.
        val r = calc.compute(LegalDeadlineChannel.OPPOSITION, LocalDate.of(2026, 10, 28))
        assertTrue(r is DeadlineResult.Verified)
        r as DeadlineResult.Verified
        assertEquals(LocalDate.of(2026, 11, 8), r.deadline)
        assertTrue(r.wasRolled)
    }

    // ------------------------------------------------------------------
    // Leap-year arithmetic through both engines
    // ------------------------------------------------------------------
    @Test
    fun `window ending on a leap day is computed consistently`() {
        // 2028-02-19 + 10d = 2028-02-29 (Tuesday) → no roll needed.
        val r = calc.compute(LegalDeadlineChannel.OPPOSITION, LocalDate.of(2028, 2, 19))
        assertTrue(r is DeadlineResult.Verified)
        r as DeadlineResult.Verified
        assertEquals(LocalDate.of(2028, 2, 29), r.deadline)
        assertFalse(r.wasRolled)
    }

    // ------------------------------------------------------------------
    // Input validation
    // ------------------------------------------------------------------
    @Test
    fun `future start date is rejected`() {
        val r = calc.compute(LegalDeadlineChannel.CASSATION, LocalDate.now().plusDays(1))
        assertTrue(r is DeadlineResult.Invalid)
    }

    // ------------------------------------------------------------------
    // Dual verification contract
    // ------------------------------------------------------------------
    @Test
    fun `both engines agree on a sweep of start dates`() {
        // Every result must be Verified — a sweep across month and leap
        // boundaries exercises both independent implementations.
        val starts = listOf(
            LocalDate.of(2025, 12, 20), LocalDate.of(2026, 2, 20),
            LocalDate.of(2026, 9, 1), LocalDate.of(2027, 12, 25),
            LocalDate.of(2028, 2, 19), LocalDate.of(2028, 12, 30),
        )
        starts.forEach { start ->
            LegalDeadlineChannel.entries.forEach { channel ->
                val r = calc.compute(channel, start)
                assertTrue("engine disagreement at $start/$channel", r is DeadlineResult.Verified)
            }
        }
    }
}
