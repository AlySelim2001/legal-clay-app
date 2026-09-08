package net.crimsys.app.domain.usecase

import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import net.crimsys.app.data.local.CaseEntity
import net.crimsys.app.data.local.HearingEntity
import net.crimsys.app.domain.repository.CaseRepository

/** Exposes the reactive case list from the local database. */
class GetCasesUseCase @Inject constructor(
    private val repository: CaseRepository,
) {
    operator fun invoke(): Flow<List<CaseEntity>> = repository.getCases()
}

/** Exposes upcoming hearings from today onward. */
class GetUpcomingHearingsUseCase @Inject constructor(
    private val repository: CaseRepository,
) {
    operator fun invoke(fromEpochDay: Long): Flow<List<HearingEntity>> =
        repository.getUpcomingHearings(fromEpochDay)
}
