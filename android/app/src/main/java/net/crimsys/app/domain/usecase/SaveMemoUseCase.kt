package net.crimsys.app.domain.usecase

import javax.inject.Inject
import net.crimsys.app.core.Result
import net.crimsys.app.domain.repository.CaseRepository

/** Persists a legal memo (rich text HTML) against a case. */
class SaveMemoUseCase @Inject constructor(
    private val repository: CaseRepository,
) {
    suspend operator fun invoke(caseId: String, memoHtml: String): Result<Unit> =
        repository.saveMemo(caseId, memoHtml)
}
