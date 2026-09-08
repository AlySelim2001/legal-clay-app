package net.crimsys.app.domain.usecase

import javax.inject.Inject
import net.crimsys.app.core.AppError
import net.crimsys.app.core.Result
import net.crimsys.app.domain.model.CaseDraft
import net.crimsys.app.domain.repository.CaseRepository

/**
 * Business rule gate for case intake: case number and court name are
 * mandatory in Egyptian criminal procedure practice.
 */
class CreateCaseUseCase @Inject constructor(
    private val repository: CaseRepository,
) {
    suspend operator fun invoke(draft: CaseDraft): Result<Unit> {
        val caseNumber = draft.caseNumber.trim()
        val courtName = draft.courtName.trim()

        if (caseNumber.isEmpty()) {
            return Result.Error(AppError.Validation("رقم القضية مطلوب"))
        }
        if (courtName.isEmpty()) {
            return Result.Error(AppError.Validation("اسم المحكمة مطلوب"))
        }

        return repository.createCase(
            draft.copy(caseNumber = caseNumber, courtName = courtName),
        )
    }
}
