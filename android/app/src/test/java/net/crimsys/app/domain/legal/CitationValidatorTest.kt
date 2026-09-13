package net.crimsys.app.domain.legal

import java.time.LocalDate
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CitationValidatorTest {

    /**
     * In-memory registry — the validator is pure domain and needs nothing
     * else. Exact-match semantics mirror the DAO: lawName/article/paragraph
     * equality with null-safe paragraph matching.
     */
    private class FakeRegistry(
        private val rows: List<LegalCitation>,
    ) : LegalRegistryRepository {
        override suspend fun findExact(
            lawName: String,
            article: String,
            paragraph: String?,
            lawNumber: String?,
        ): List<LegalCitation> = rows.filter {
            it.lawName == lawName.trim() &&
                it.article == article.trim() &&
                it.paragraph == paragraph?.trim() &&
                (lawNumber == null || it.lawNumber == lawNumber)
        }

        override suspend fun isEffective(citation: LegalCitation, eventDate: LocalDate): Boolean =
            !eventDate.isBefore(citation.effectiveFrom) &&
                (citation.effectiveTo == null || !eventDate.isAfter(citation.effectiveTo))
    }

    private val validSha =
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    private val eventDate = LocalDate.of(2026, 9, 1)

    private fun citation(
        lawName: String = "قانون الإجراءات الجنائية رقم 150 لسنة 2020",
        article: String = "40",
        paragraph: String? = null,
        sha: String = validSha,
        url: String = "https://www.egypt.gov.eg/law-150-2020",
        effectiveFrom: LocalDate = LocalDate.of(2021, 4, 1),
        effectiveTo: LocalDate? = null,
    ) = LegalCitation(
        lawNumber = "150 لسنة 2020",
        lawName = lawName,
        article = article,
        paragraph = paragraph,
        effectiveFrom = effectiveFrom,
        effectiveTo = effectiveTo,
        sourceSha256 = sha,
        officialSourceUrl = url,
        gazetteIssue = "الجريدة الرسمية - عدد 27",
    )

    private fun parsedCitation(
        lawName: String = "قانون الإجراءات الجنائية رقم 150 لسنة 2020",
        article: String = "40",
        paragraph: String? = null,
    ) = ParsedLegalCitation(
        rawText = "قانون $lawName المادة $article",
        lawName = lawName,
        article = article,
        paragraph = paragraph,
        startIndex = 0,
        endIndex = 10,
    )

    private fun validatorOf(vararg rows: LegalCitation): RegistryBackedCitationValidator =
        RegistryBackedCitationValidator(FakeRegistry(rows.toList()))

    @Test
    fun `exact single match with intact provenance passes`() = runTest {
        val result = validatorOf(citation()).verify(parsedCitation(), eventDate)
        assertTrue(result is VerificationResult.Verified)
        assertEquals(validSha, (result as VerificationResult.Verified).citation.sourceSha256)
    }

    @Test
    fun `paragraph-level citation matches only its own row`() = runTest {
        val articleRow = citation()
        val paragraphRow = citation(paragraph = "3")
        val v = validatorOf(articleRow, paragraphRow)

        // A citation naming paragraph 3 resolves to exactly one row...
        val withParagraph = v.verify(parsedCitation(paragraph = "3"), eventDate)
        assertTrue(withParagraph is VerificationResult.Verified)

        // ...and an article-level citation is NOT satisfied by the paragraph
        // row (null-safe exact match keeps the two distinct).
        val noParagraph = v.verify(parsedCitation(), eventDate)
        assertTrue(noParagraph is VerificationResult.Verified)
        assertEquals(null, (noParagraph as VerificationResult.Verified).citation.paragraph)
    }

    @Test
    fun `no matching row rejects with NO_SOURCE_MATCH`() = runTest {
        val result = validatorOf(citation()).verify(parsedCitation(article = "999"), eventDate)
        assertEquals(RejectionReason.NO_SOURCE_MATCH, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `duplicate registered rows reject with AMBIGUOUS_SOURCE_MATCH`() = runTest {
        val result = validatorOf(citation(), citation()).verify(parsedCitation(), eventDate)
        assertEquals(RejectionReason.AMBIGUOUS_SOURCE_MATCH, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `corrupt sha256 rejects with SOURCE_HASH_INVALID`() = runTest {
        val result = validatorOf(citation(sha = "deadbeef")).verify(parsedCitation(), eventDate)
        assertEquals(RejectionReason.SOURCE_HASH_INVALID, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `uppercase sha256 is accepted`() = runTest {
        val result = validatorOf(citation(sha = validSha.uppercase())).verify(parsedCitation(), eventDate)
        assertTrue(result is VerificationResult.Verified)
    }

    @Test
    fun `non-http url rejects with SOURCE_URL_INVALID`() = runTest {
        val result = validatorOf(citation(url = "ftp://example.com/law.pdf")).verify(parsedCitation(), eventDate)
        assertEquals(RejectionReason.SOURCE_URL_INVALID, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `event date before effectiveFrom rejects`() = runTest {
        val result = validatorOf(citation()).verify(parsedCitation(), LocalDate.of(2021, 1, 1))
        assertEquals(RejectionReason.NOT_EFFECTIVE_ON_EVENT_DATE, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `event date after effectiveTo rejects`() = runTest {
        val result =
            validatorOf(citation(effectiveTo = LocalDate.of(2025, 12, 31)))
                .verify(parsedCitation(), LocalDate.of(2026, 1, 1))
        assertEquals(RejectionReason.NOT_EFFECTIVE_ON_EVENT_DATE, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `effectiveTo boundary is inclusive`() = runTest {
        val result =
            validatorOf(citation(effectiveTo = LocalDate.of(2026, 9, 1)))
                .verify(parsedCitation(), LocalDate.of(2026, 9, 1))
        assertTrue(result is VerificationResult.Verified)
    }

    @Test
    fun `missing law name or article rejects as unsupported format`() = runTest {
        val result = validatorOf(citation()).verify(parsedCitation(lawName = ""), eventDate)
        assertEquals(RejectionReason.UNSUPPORTED_CITATION_FORMAT, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `isEffective delegates the temporal gate`() = runTest {
        val repo = FakeRegistry(emptyList())
        assertTrue(repo.isEffective(citation(), LocalDate.of(2021, 4, 1)))
        assertFalse(repo.isEffective(citation(), LocalDate.of(2021, 3, 31)))
    }

    // -------------------------------------------------------------
    // Temporal version resolution (the registry stores amendments as
    // coexisting rows; the validator picks the version in force).
    // -------------------------------------------------------------

    @Test
    fun `disjoint temporal versions resolve to the version in force`() = runTest {
        // Original text 2021-04-01 → 2024-12-31, replaced 2025-01-01.
        val oldVersion = citation(
            effectiveFrom = LocalDate.of(2021, 4, 1),
            effectiveTo = LocalDate.of(2024, 12, 31),
        )
        val newVersion = citation(
            effectiveFrom = LocalDate.of(2025, 1, 1),
            effectiveTo = null,
            sha = "a".repeat(64),
        )
        val result = validatorOf(oldVersion, newVersion).verify(parsedCitation(), eventDate)
        assertTrue(result is VerificationResult.Verified)
        // The replacement — not the repealed text — must be the citation returned.
        assertEquals("a".repeat(64), (result as VerificationResult.Verified).citation.sourceSha256)
    }

    @Test
    fun `overlapping windows on the event date are ambiguous`() = runTest {
        val v1 = citation(effectiveFrom = LocalDate.of(2021, 4, 1), effectiveTo = null)
        val v2 = citation(effectiveFrom = LocalDate.of(2023, 1, 1), effectiveTo = null)
        val result = validatorOf(v1, v2).verify(parsedCitation(), eventDate)
        assertEquals(RejectionReason.AMBIGUOUS_SOURCE_MATCH, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `gap between versions on the event date rejects as not effective`() = runTest {
        val oldVersion = citation(
            effectiveFrom = LocalDate.of(2021, 4, 1),
            effectiveTo = LocalDate.of(2024, 12, 31),
        )
        val futureVersion = citation(
            effectiveFrom = LocalDate.of(2026, 12, 31),
            effectiveTo = null,
        )
        // eventDate 2026-09-01 falls in the gap between repeal and succession.
        val result = validatorOf(oldVersion, futureVersion).verify(parsedCitation(), eventDate)
        assertEquals(RejectionReason.NOT_EFFECTIVE_ON_EVENT_DATE, (result as VerificationResult.Rejected).reason)
    }
}
