package net.crimsys.app.domain.legal

import java.time.LocalDate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import net.crimsys.app.core.Result
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CitationValidatorTest {

    /** In-memory registry — the validator is pure domain and needs nothing else. */
    private class FakeRegistry(
        private val entries: List<RegistryEntry>,
    ) : LegalRegistryRepository {
        override fun observeEntries(): Flow<List<RegistryEntry>> = flowOf(entries)
        override suspend fun findCandidates(lawName: String, article: String): List<RegistryEntry> =
            entries.filter {
                it.citation.lawName.trim() == lawName.trim() &&
                    it.citation.article.trim() == article.trim()
            }

        override suspend fun upsertEntries(entries: List<RegistryEntry>): Result<List<Long>> =
            Result.Success(entries.map { it.id })

        override suspend fun seedDefaultsIfEmpty(entries: List<RegistryEntry>): Result<Int> =
            Result.Success(0)
    }

    private val validSha =
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    private val eventDate = LocalDate.of(2026, 9, 1)

    private fun verifiedEntry(
        lawName: String = "قانون الإجراءات الجنائية رقم 150 لسنة 2020",
        article: String = "40",
    ) = RegistryEntry(
        citation = LegalCitation(
            lawNumber = "150 لسنة 2020",
            lawName = lawName,
            article = article,
            paragraph = null,
            effectiveFrom = LocalDate.of(2021, 4, 1),
            effectiveTo = null,
            sourceSha256 = validSha,
            officialSourceUrl = "https://www.egypt.gov.eg/law-150-2020",
            gazetteIssue = "الجريدة الرسمية - عدد 27",
        ),
        verified = true,
        id = 1L,
    )

    private fun parsedCitation(
        lawName: String = "قانون الإجراءات الجنائية رقم 150 لسنة 2020",
        article: String = "40",
    ) = ParsedLegalCitation(
        rawText = "قانون $lawName المادة $article",
        lawName = lawName,
        article = article,
        paragraph = null,
        startIndex = 0,
        endIndex = 10,
    )

    private fun validatorOf(vararg entries: RegistryEntry): RegistryBackedCitationValidator =
        RegistryBackedCitationValidator(FakeRegistry(entries.toList()))

    @Test
    fun `verified entry with intact provenance passes`() = runTest {
        val result = validatorOf(verifiedEntry()).verify(parsedCitation(), eventDate)
        assertTrue(result is VerificationResult.Verified)
        assertEquals(validSha, (result as VerificationResult.Verified).citation.sourceSha256)
    }

    @Test
    fun `no matching row rejects with NO_SOURCE_MATCH`() = runTest {
        val result = validatorOf(verifiedEntry()).verify(parsedCitation(article = "999"), eventDate)
        assertEquals(RejectionReason.NO_SOURCE_MATCH, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `two matching rows reject with AMBIGUOUS_SOURCE_MATCH`() = runTest {
        val result =
            validatorOf(verifiedEntry(), verifiedEntry(id = 2L)).verify(parsedCitation(), eventDate)
        assertEquals(RejectionReason.AMBIGUOUS_SOURCE_MATCH, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `unverified source rejects before integrity checks`() = runTest {
        val entry = verifiedEntry().copy(verified = false)
        val result = validatorOf(entry).verify(parsedCitation(), eventDate)
        assertEquals(RejectionReason.SOURCE_NOT_VERIFIED, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `corrupt sha256 rejects with SOURCE_HASH_INVALID`() = runTest {
        val entry = verifiedEntry().copy(
            citation = verifiedEntry().citation.copy(sourceSha256 = "deadbeef"),
        )
        val result = validatorOf(entry).verify(parsedCitation(), eventDate)
        assertEquals(RejectionReason.SOURCE_HASH_INVALID, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `non-http url rejects with SOURCE_URL_INVALID`() = runTest {
        val entry = verifiedEntry().copy(
            citation = verifiedEntry().citation.copy(officialSourceUrl = "ftp://example.com/law.pdf"),
        )
        val result = validatorOf(entry).verify(parsedCitation(), eventDate)
        assertEquals(RejectionReason.SOURCE_URL_INVALID, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `event date before effectiveFrom rejects`() = runTest {
        val result =
            validatorOf(verifiedEntry()).verify(parsedCitation(), LocalDate.of(2021, 1, 1))
        assertEquals(RejectionReason.NOT_EFFECTIVE_ON_EVENT_DATE, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `event date after effectiveTo rejects`() = runTest {
        val entry = verifiedEntry().copy(
            citation = verifiedEntry().citation.copy(effectiveTo = LocalDate.of(2025, 12, 31)),
        )
        val result = validatorOf(entry).verify(parsedCitation(), LocalDate.of(2026, 1, 1))
        assertEquals(RejectionReason.NOT_EFFECTIVE_ON_EVENT_DATE, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `effectiveTo boundary is inclusive`() = runTest {
        val entry = verifiedEntry().copy(
            citation = verifiedEntry().citation.copy(effectiveTo = LocalDate.of(2026, 9, 1)),
        )
        val result = validatorOf(entry).verify(parsedCitation(), LocalDate.of(2026, 9, 1))
        assertTrue(result is VerificationResult.Verified)
    }

    @Test
    fun `missing law name or article rejects as unsupported format`() = runTest {
        val noLaw = parsedCitation().copy(lawName = "")
        val result = validatorOf(verifiedEntry()).verify(noLaw, eventDate)
        assertEquals(RejectionReason.UNSUPPORTED_CITATION_FORMAT, (result as VerificationResult.Rejected).reason)
    }
}
