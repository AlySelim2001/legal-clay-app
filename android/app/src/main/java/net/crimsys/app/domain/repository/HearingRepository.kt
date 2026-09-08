package net.crimsys.app.domain.repository

import kotlinx.coroutines.flow.Flow
import net.crimsys.app.core.Result
import net.crimsys.app.data.local.HearingEntity
import java.time.LocalDate

/** Reads for hearings (جلسات) backing the dashboard feed and the calendar. */
interface HearingRepository {

    /** Hearings on one specific day (calendar day tap). */
    fun getHearingsForDay(day: LocalDate): Flow<List<HearingEntity>>

    /** Days that carry at least one hearing on/after [from] — drives calendar dots. */
    fun getHearingDays(from: LocalDate): Flow<Set<Long>>

    /** Upcoming hearings ordered by day/time — dashboard agenda feed. */
    fun getUpcomingHearings(from: LocalDate): Flow<List<HearingEntity>>

    /**
     * Persists a hearing locally, enqueues a sync action, and pushes immediately
     * when online — identical write path to [CaseRepository.createCase].
     */
    suspend fun scheduleHearing(hearing: HearingEntity): Result<Unit>
}
