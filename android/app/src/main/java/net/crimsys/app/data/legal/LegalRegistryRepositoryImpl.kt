package net.crimsys.app.data.legal

import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import net.crimsys.app.data.local.LegalSourceDao
import net.crimsys.app.data.local.LegalSourceEntity
import net.crimsys.app.domain.legal.LegalCitation
import net.crimsys.app.domain.legal.LegalRegistryRepository

/**
 * Room-backed legal registry implementing the lean lookup contract.
 *
 * Registry rule (Evidence-First): the stored set IS the citable set. Rows
 * are written only through the review/seed path with `verified = true`
 * ([LegalSourceDao.upsertAll] is the single write gate); an unverified
 * artifact simply is not registered, so it surfaces as no match — the
 * validator never has to guess about review state.
 */
@Singleton
class LegalRegistryRepositoryImpl @Inject constructor(
    private val dao: LegalSourceDao,
) : LegalRegistryRepository {

    override suspend fun findExact(
        lawName: String,
        article: String,
        paragraph: String?,
        lawNumber: String?,
    ): List<LegalCitation> =
        withContext(Dispatchers.IO) {
            dao.findExact(
                lawName = lawName.trim(),
                article = article.trim(),
                paragraph = paragraph?.trim(),
                lawNumber = lawNumber?.trim(),
            ).map { it.toCitation() }
        }

    override suspend fun isEffective(citation: LegalCitation, eventDate: LocalDate): Boolean {
        val from = citation.effectiveFrom
        val to = citation.effectiveTo
        return !eventDate.isBefore(from) && (to == null || !eventDate.isAfter(to))
    }

    private fun LegalSourceEntity.toCitation(): LegalCitation = LegalCitation(
        lawNumber = lawNumber,
        lawName = lawName,
        article = article,
        paragraph = paragraph,
        effectiveFrom = LocalDate.parse(effectiveFromIso),
        effectiveTo = effectiveToIso?.let(LocalDate::parse),
        sourceSha256 = sourceSha256,
        officialSourceUrl = officialSourceUrl,
        gazetteIssue = gazetteIssue,
    )
}
