package net.crimsys.app.data.legal

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import net.crimsys.app.core.Result
import net.crimsys.app.core.WallClock
import net.crimsys.app.core.runCatchingResult
import net.crimsys.app.data.local.LegalSourceDao
import net.crimsys.app.data.local.LegalSourceEntity
import net.crimsys.app.domain.legal.LegalCitation
import net.crimsys.app.domain.legal.LegalRegistryRepository
import net.crimsys.app.domain.legal.RegistryEntry

/**
 * Room-backed legal registry. Persist-only by design: the decision that a
 * source IS authoritative (the `verified` flag) belongs to the review
 * workflow, never to this class.
 *
 * Identity model: the (lawName, article, paragraph) unique index is the
 * natural key. Upsert relies on `OnConflictStrategy.REPLACE` — a
 * re-registration of the same artifact replaces its row (with a new row id;
 * ids are transient handles for the review workflow, not references).
 */
@Singleton
class LegalRegistryRepositoryImpl @Inject constructor(
    private val dao: LegalSourceDao,
    private val clock: WallClock,
) : LegalRegistryRepository {

    override fun observeEntries(): Flow<List<RegistryEntry>> =
        dao.observeAll().map { rows -> rows.map { it.toEntry() } }

    override suspend fun findCandidates(lawName: String, article: String): List<RegistryEntry> =
        withContext(Dispatchers.IO) {
            dao.findCandidates(lawName.trim(), article.trim()).map { it.toEntry() }
        }

    override suspend fun upsertEntries(entries: List<RegistryEntry>): Result<List<Long>> =
        withContext(Dispatchers.IO) {
            runCatchingResult {
                if (entries.isEmpty()) {
                    emptyList()
                } else {
                    val now = clock.nowMillis()
                    dao.upsertAll(entries.map { it.toEntity(now) })
                }
            }
        }

    override suspend fun seedDefaultsIfEmpty(entries: List<RegistryEntry>): Result<Int> =
        withContext(Dispatchers.IO) {
            runCatchingResult {
                if (dao.count() > 0) {
                    0
                } else {
                    val now = clock.nowMillis()
                    dao.upsertAll(entries.map { it.toEntity(now) }).size
                }
            }
        }

    private fun LegalSourceEntity.toEntry(): RegistryEntry = RegistryEntry(
        citation = LegalCitation(
            lawNumber = lawNumber,
            lawName = lawName,
            article = article,
            paragraph = paragraph,
            effectiveFrom = java.time.LocalDate.parse(effectiveFromIso),
            effectiveTo = effectiveToIso?.let(java.time.LocalDate::parse),
            sourceSha256 = sourceSha256,
            officialSourceUrl = officialSourceUrl,
            gazetteIssue = gazetteIssue,
        ),
        verified = verified,
        id = id,
    )

    private fun RegistryEntry.toEntity(now: Long): LegalSourceEntity = LegalSourceEntity(
        id = 0, // autoincrement; REPLACE resolves identity via the unique index
        lawNumber = citation.lawNumber.trim(),
        lawName = citation.lawName.trim(),
        article = citation.article.trim(),
        paragraph = citation.paragraph?.trim(),
        effectiveFromIso = citation.effectiveFrom.toString(),
        effectiveToIso = citation.effectiveTo?.toString(),
        sourceSha256 = citation.sourceSha256.lowercase(),
        officialSourceUrl = citation.officialSourceUrl.trim(),
        gazetteIssue = citation.gazetteIssue?.trim(),
        verified = verified,
        createdAt = now,
        updatedAt = now,
    )
}
