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
 * Room-backed legal registry implementing the lean lookup contract over a
 * TEMPORALLY VERSIONED store: one article may have many verified rows (amendments,
 * replacements), each with its own validity window and source-artifact digest.
 *
 * Contracts:
 *  - [findExact] returns ALL verified versions of the exact (law, article[,
 *    paragraph]) citation, newest window first — the caller (validator)
 *    resolves which version was in force on the event date.
 *  - [isEffective] is the inclusive window check against the EVENT date.
 *
 * Only rows with `verified = 1` are ever returned: the DAO enforces it, so
 * review state can never leak into verification.
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
            // Normalization is applied on WRITE (trim at the registration
            // path); the lookups trim defensively for parity.
            val name = lawName.trim()
            val art = article.trim()
            val rows = when {
                paragraph != null -> dao.findParagraphSources(name, art, paragraph.trim())
                lawNumber != null -> dao.findByLawNumberAndArticle(lawNumber.trim(), name, art)
                else -> dao.findArticleSources(name, art)
            }
            rows.map { it.toCitation() }
        }

    override suspend fun isEffective(citation: LegalCitation, eventDate: LocalDate): Boolean {
        val to = citation.effectiveTo
        return !eventDate.isBefore(citation.effectiveFrom) &&
            (to == null || !eventDate.isAfter(to))
    }

    private fun LegalSourceEntity.toCitation(): LegalCitation = LegalCitation(
        lawNumber = lawNumber,
        lawName = lawName,
        article = article,
        paragraph = paragraph,
        effectiveFrom = LocalDate.ofEpochDay(effectiveFromEpochDay),
        effectiveTo = effectiveToEpochDay?.let(LocalDate::ofEpochDay),
        sourceSha256 = sourceSha256,
        officialSourceUrl = officialSourceUrl,
        gazetteIssue = gazetteIssue,
    )
}
