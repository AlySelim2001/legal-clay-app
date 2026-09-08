package net.crimsys.app.domain.usecase

import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow
import net.crimsys.app.core.Result
import net.crimsys.app.data.local.HearingEntity
import net.crimsys.app.domain.repository.HearingRepository

/** Reactive hearing feed for one calendar day. */
class GetHearingsForDayUseCase @Inject constructor(
    private val repository: HearingRepository,
) {
    operator fun invoke(day: LocalDate): Flow<List<HearingEntity>> =
        repository.getHearingsForDay(day)
}

/** Days carrying hearings on/after [from] — drives the calendar dot indicators. */
class GetHearingDaysUseCase @Inject constructor(
    private val repository: HearingRepository,
) {
    operator fun invoke(from: LocalDate): Flow<Set<Long>> =
        repository.getHearingDays(from)
}

/**
 * Business gate for scheduling a session: a hearing must belong to a case and
 * carry a non-blank court name — mirrors the intake validation discipline of
 * [CreateCaseUseCase].
 */
class ScheduleHearingUseCase @Inject constructor(
    private val repository: HearingRepository,
) {
    suspend operator fun invoke(hearing: HearingEntity): Result<Unit> {
        if (hearing.caseId.isBlank()) {
            return Result.Error(net.crimsys.app.core.AppError.Validation("يجب ربط الجلسة بقضية"))
        }
        if (hearing.courtName.isBlank()) {
            return Result.Error(net.crimsys.app.core.AppError.Validation("اسم المحكمة مطلوب"))
        }
        return repository.scheduleHearing(hearing)
    }
}
