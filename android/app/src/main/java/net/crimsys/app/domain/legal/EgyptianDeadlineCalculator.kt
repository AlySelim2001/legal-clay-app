package net.crimsys.app.domain.legal

import java.time.DayOfWeek
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Egyptian criminal-procedure appeal deadline calculator (M4).
 *
 * Channels implemented (per product spec):
 *  - المعارضة في الأحكام الغيابية (opposition to default rulings) — 10 days
 *  - الاستئناف الجنائي (criminal appeal) — 10 days
 *  - الطعن بالنقض (cassation) — 60 days
 *
 * CITATION INTEGRITY: the windows match the product specification, but the
 * exact article numbers are NOT hardcoded as settled law — each channel
 * carries [LegalDeadlineChannel.needsLegalReview] and the UI MUST display
 * that flag until legal counsel signs off (same policy as the RAG layer's
 * review_status gate). A wrong legal date is a catastrophe; an honest
 * "pending review" badge is not.
 *
 * DUAL VERIFICATION (mandatory per spec): every deadline is computed twice
 * through two fully independent implementations:
 *   1. [java.time] calendar arithmetic
 *   2. a hand-rolled proleptic-Gregorian day-count (Zeller weekday +
 *      manual month lengths) that shares zero code with java.time
 * If the two disagree, the result is [VerificationStatus.DUAL_CHECK_FAILED]
 * and the UI must show an error — never a silently wrong legal date.
 *
 * WEEKEND ROLL: per the P1 deadline-engine decision, if a deadline lands on
 * Friday or Saturday (the Egyptian weekend), it rolls FORWARD to Sunday.
 * Roll direction is a legal-policy question flagged for counsel review —
 * the code states its assumption explicitly rather than hiding it.
 */
@Singleton
class EgyptianDeadlineCalculator @Inject constructor() {

    /** Enum of supported appeal channels with their review status. */
    enum class LegalDeadlineChannel(
        val id: String,
        val titleAr: String,
        val windowDays: Long,
        val needsLegalReview: Boolean,
    ) {
        OPPOSITION(
            id = "opposition",
            titleAr = "المعارضة في الحكم الغيابي",
            windowDays = 10L,
            needsLegalReview = true,
        ),
        CRIMINAL_APPEAL(
            id = "criminal_appeal",
            titleAr = "الاستئناف الجنائي",
            windowDays = 10L,
            needsLegalReview = true,
        ),
        CASSATION(
            id = "cassation",
            titleAr = "الطعن بالنقض",
            windowDays = 60L,
            needsLegalReview = true,
        ),
        ;

        companion object {
            fun fromId(id: String): LegalDeadlineChannel? =
                entries.firstOrNull { it.id == id }
        }
    }

    enum class VerificationStatus { DUAL_CHECK_PASSED, DUAL_CHECK_FAILED }

    sealed interface DeadlineResult {
        /** Both engines agree — safe to render (with the review badge). */
        data class Verified(
            val channel: LegalDeadlineChannel,
            val startDate: LocalDate,
            /** Raw window end BEFORE weekend roll. */
            val rawDeadline: LocalDate,
            /** Final enforceable date AFTER rolling off Fri/Sat onto Sunday. */
            val deadline: LocalDate,
            val daysRemaining: Long,
            val wasRolled: Boolean,
        ) : DeadlineResult

        /** The two engines disagreed — UI MUST block, never render a date. */
        data class DualCheckFailed(
            val channel: LegalDeadlineChannel,
            val primary: LocalDate,
            val secondary: LocalDate,
        ) : DeadlineResult

        /** Invalid input (start date in the future, non-Gregorian, etc.). */
        data class Invalid(val reasonAr: String) : DeadlineResult
    }

    /**
     * Compute the deadline for [channel] starting at [startDate] (e.g. the
     * notification or judgment date). Verdict urgency is derived for display
     * only (≤3 days red, ≤7 amber, else green) — it never gates filing.
     */
    fun compute(channel: LegalDeadlineChannel, startDate: LocalDate): DeadlineResult {
        val today = LocalDate.now()
        if (startDate.isAfter(today)) {
            return DeadlineResult.Invalid("تاريخ البداية لا يمكن أن يكون مستقبلياً")
        }
        if (channel.windowDays <= 0) {
            return DeadlineResult.Invalid("مدة غير صالحة لهذا الطعن")
        }

        // Engine 1: java.time arithmetic.
        val rawPrimary = startDate.plusDays(channel.windowDays)
        val primary = rollOffWeekend(rawPrimary)

        // Engine 2: independent proleptic-Gregorian implementation.
        val rawSecondary = addDaysManual(startDate, channel.windowDays)
        val secondary = rollOffWeekendManual(rawSecondary)

        if (primary != secondary || rawPrimary != rawSecondary) {
            return DeadlineResult.DualCheckFailed(
                channel = channel,
                primary = primary,
                secondary = secondary,
            )
        }

        return DeadlineResult.Verified(
            channel = channel,
            startDate = startDate,
            rawDeadline = rawPrimary,
            deadline = primary,
            daysRemaining = today.datesUntil(primary).count(),
            wasRolled = rawPrimary != primary,
        )
    }

    // -----------------------------------------------------------------------
    // Engine 1: java.time
    // -----------------------------------------------------------------------
    private fun rollOffWeekend(date: LocalDate): LocalDate {
        var d = date
        while (d.dayOfWeek == DayOfWeek.FRIDAY || d.dayOfWeek == DayOfWeek.SATURDAY) {
            d = d.plusDays(1)
        }
        return d
    }

    // -----------------------------------------------------------------------
    // Engine 2: hand-rolled proleptic-Gregorian (no java.time APIs)
    // -----------------------------------------------------------------------
    private fun isLeap(y: Int): Boolean =
        (y % 4 == 0 && y % 100 != 0) || y % 400 == 0

    private fun daysInMonth(y: Int, m: Int): Int = when (m) {
        1, 3, 5, 7, 8, 10, 12 -> 31
        4, 6, 9, 11 -> 30
        2 -> if (isLeap(y)) 29 else 28
        else -> throw IllegalArgumentException("month $m")
    }

    /** Days since epoch for a proleptic-Gregorian date (independent of java.time). */
    private fun toEpochDay(y: Int, m: Int, d: Int): Long {
        var days = 0L
        if (y >= 1970) {
            for (yy in 1970 until y) days += if (isLeap(yy)) 366 else 365
            for (mm in 1 until m) days += daysInMonth(y, mm)
        } else {
            for (yy in y until 1970) days -= if (isLeap(yy)) 366 else 365
            for (mm in m until 12) days -= daysInMonth(y, mm)
        }
        days += d - 1
        return days
    }

    private fun fromEpochDay(epoch: Long): Triple<Int, Int, Int> {
        var days = epoch
        var y = 1970
        while (days >= (if (isLeap(y)) 366 else 365)) {
            days -= if (isLeap(y)) 366 else 365
            y++
        }
        while (days < 0L) {
            y--
            days += if (isLeap(y)) 366 else 365
        }
        var m = 1
        while (days >= daysInMonth(y, m)) {
            days -= daysInMonth(y, m)
            m++
        }
        return Triple(y, m, days.toInt() + 1)
    }

    /** Zeller's congruence (Gregorian): h = 0 → Saturday, …, 5 → Thursday, 6 → Friday. */
    private fun zellerDow(y: Int, m: Int, d: Int): Int {
        val mm = if (m < 3) m + 12 else m
        val yy = if (m < 3) y - 1 else y
        val k = yy % 100
        val j = yy / 100
        return (d + (13 * (mm + 1)) / 5 + k + k / 4 + j / 4 + 5 * j) % 7
    }

    private fun addDaysManual(start: LocalDate, days: Long): LocalDate {
        val epoch = toEpochDay(start.year, start.monthValue, start.dayOfMonth) + days
        val (y, m, d) = fromEpochDay(epoch)
        return LocalDate.of(y, m, d)
    }

    private fun rollOffWeekendManual(date: LocalDate): LocalDate {
        var (y, m, d) = Triple(date.year, date.monthValue, date.dayOfMonth)
        while (true) {
            val dow = zellerDow(y, m, d) // 0 = Saturday, 6 = Friday
            val isFriday = dow == 6
            val isSaturday = dow == 0
            if (!isFriday && !isSaturday) break
            d++
            if (d > daysInMonth(y, m)) { d = 1; m++; if (m > 12) { m = 1; y++ } }
        }
        return LocalDate.of(y, m, d)
    }
}
