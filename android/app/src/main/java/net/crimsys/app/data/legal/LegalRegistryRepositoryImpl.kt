package net.crimsys.app.data.legal

import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton
import net.crimsys.app.data.local.LegalSourceDao
import net.crimsys.app.data.local.LegalSourceEntity
import net.crimsys.app.domain.legal.LegalCitation
import net.crimsys.app.domain.legal.LegalRegistryRepository

@Singleton
class LegalRegistryRepositoryImpl @Inject constructor(
    private val dao: LegalSourceDao,
) : LegalRegistryRepository {

    override suspend fun findExact(
        lawName: String,
        article: String,
        paragraph: String?,
        lawNumber: String?,
    ): List<LegalCitation> {

        val rows =
            when {
                lawNumber != null && paragraph == null ->
                    dao.findByLawNumberAndArticle(
                        lawNumber = lawNumber,
                        lawName = lawName,
                        article = article,
                    )

                paragraph != null ->
                    dao.findParagraphSources(
                        lawName = lawName,
                        article = article,
                        paragraph = paragraph,
                    )

                else ->
                    dao.findArticleSources(
                        lawName = lawName,
                        article = article,
                    )
            }

        return rows.map { it.toDomain() }
    }

    override suspend fun isEffective(
        citation: LegalCitation,
        eventDate: LocalDate,
    ): Boolean {
        return !eventDate.isBefore(citation.effectiveFrom) &&
            (
                citation.effectiveTo == null ||
                    !eventDate.isAfter(citation.effectiveTo)
                )
    }

    private fun LegalSourceEntity.toDomain(): LegalCitation =
        LegalCitation(
            lawNumber = lawNumber,
            lawName = lawName,
            article = article,
            paragraph = paragraph,
            effectiveFrom = LocalDate.ofEpochDay(
                effectiveFromEpochDay,
            ),
            effectiveTo = effectiveToEpochDay?.let(
                LocalDate::ofEpochDay,
            ),
            sourceSha256 = sourceSha256,
            officialSourceUrl = officialSourceUrl,
            gazetteIssue = gazetteIssue,
        )
}
