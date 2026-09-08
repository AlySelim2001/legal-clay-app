package net.crimsys.app.domain.repository

import kotlinx.coroutines.flow.Flow
import net.crimsys.app.core.Result
import net.crimsys.app.data.local.CaseEntity
import net.crimsys.app.data.local.HearingEntity
import net.crimsys.app.domain.model.CaseDraft

/** Single source of truth reads + offline-queued writes for cases. */
interface CaseRepository {
    /** Reactive case list straight from Room — never read from the network. */
    fun getCases(): Flow<List<CaseEntity>>

    /** One case by id, or null when missing. */
    suspend fun getCaseById(id: String): CaseEntity?

    /** Upcoming hearings across all cases (dashboard + calendar feed). */
    fun getUpcomingHearings(fromEpochDay: Long): Flow<List<HearingEntity>>

    /**
     * Validates + persists locally immediately, then pushes immediately when
     * online or enqueues into the offline action queue when not.
     */
    suspend fun createCase(draft: CaseDraft): Result<Unit>

    /** Persists memo HTML and marks the row unsynced; syncs per createCase rules. */
    suspend fun saveMemo(caseId: String, memoHtml: String): Result<Unit>
}
