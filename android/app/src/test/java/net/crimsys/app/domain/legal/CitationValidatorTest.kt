package net.crimsys.app.domain.legal

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CitationValidatorTest {

    /**
     * In-memory registry — exact-match semantics mirror the Room DAO:
     * lawName/article/paragraph equality with null-safe paragraph matching
     * and an optional lawNumber filter.
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

    /** Fixed clock: every default eventDate in these tests is 2026-09-01. */
    private val clock: Clock =
        Clock.fixed(Instant.parse("2026-09-01T00:00:00Z"), ZoneOffset.UTC)
    private val eventDate = LocalDate.of(2026, 9, 1)

    private val validSha =
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

    private fun citation(
        lawName: String = "قانون العقوبات",
        article: String = "40",
        paragraph: String? = null,
        sha: String = validSha,
        url: String = "https://www.egypt.gov.eg/law.pdf",
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

    private fun validatorOf(vararg rows: LegalCitation): CitationValidator =
        CitationValidator(FakeRegistry(rows.toList()), clock)

    // ------------------------------------------------------------------
    // parse()
    // ------------------------------------------------------------------

    @Test
    fun `parse extracts paragraph-first citations and suppresses the nested article match`() {
        val parsed = validatorOf().parse("الفقرة 2 من المادة 212 من قانون الإثبات")
        assertEquals(1, parsed.size)
        assertEquals("212", parsed[0].article)
        assertEquals("2", parsed[0].paragraph)
        assertEquals("قانون الإثبات", parsed[0].lawName)
        assertTrue(parsed[0].endIndex > parsed[0].startIndex)
    }

    @Test
    fun `parse normalizes Arabic-Indic digits`() {
        val parsed = validatorOf().parse("المادة ٤٠ من قانون العقوبات")
        assertEquals(1, parsed.size)
        assertEquals("40", parsed[0].article)
    }

    @Test
    fun `parse keeps a bare article with an empty law name`() {
        val parsed = validatorOf().parse("المادة 40")
        assertEquals(1, parsed.size)
        assertEquals("", parsed[0].lawName)
        assertNullable(parsed[0].paragraph)
    }

    @Test
    fun `parse returns citations ordered by position and ignores non-citation text`() {
        val text = "المادة 40 من قانون العقوبات. ورد أيضا المادة 212 من قانون الإثبات."
        val parsed = validatorOf().parse(text)
        assertEquals(2, parsed.size)
        assertTrue(parsed[0].startIndex < parsed[1].startIndex)
        assertTrue(validatorOf().parse("نص عام بلا إحالات قانونية").isEmpty())
    }

    private fun assertNullable(value: String?) {
        org.junit.Assert.assertNull(value)
    }

    // ------------------------------------------------------------------
    // verify()
    // ------------------------------------------------------------------

    @Test
    fun `verified single match with intact provenance passes`() = runTest {
        val raw = "المادة 40 من قانون العقوبات"
        val result = validatorOf(citation()).verify(raw, eventDate)
        assertTrue(result is VerificationResult.Verified)
        assertEquals(validSha, (result as VerificationResult.Verified).citation.sourceSha256)
    }

    @Test
    fun `bare article without a law name rejects as unsupported format`() = runTest {
        val result = validatorOf(citation()).verify("المادة 40", eventDate)
        assertEquals(
            RejectionReason.UNSUPPORTED_CITATION_FORMAT,
            (result as VerificationResult.Rejected).reason,
        )
    }

    @Test
    fun `unparseable text rejects with a full-span placeholder citation`() = runTest {
        val raw = "نص عام بلا إحالات"
        val result = validatorOf().verify(raw, eventDate)
        result as VerificationResult.Rejected
        assertEquals(RejectionReason.UNSUPPORTED_CITATION_FORMAT, result.reason)
        assertEquals(0, result.citation.startIndex)
        assertEquals(raw.length, result.citation.endIndex)
        assertEquals(raw, result.citation.rawText)
    }

    @Test
    fun `no matching row rejects with NO_SOURCE_MATCH`() = runTest {
        val raw = "المادة 999 من قانون العقوبات"
        val result = validatorOf(citation()).verify(raw, eventDate)
        assertEquals(RejectionReason.NO_SOURCE_MATCH, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `two rows effective on the event date reject as ambiguous`() = runTest {
        val raw = "المادة 40 من قانون العقوبات"
        val result = validatorOf(citation(), citation(sha = "a".repeat(64))).verify(raw, eventDate)
        assertEquals(RejectionReason.AMBIGUOUS_SOURCE_MATCH, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `corrupt sha256 rejects with SOURCE_HASH_INVALID`() = runTest {
        val result =
            validatorOf(citation(sha = "deadbeef")).verify("المادة 40 من قانون العقوبات", eventDate)
        assertEquals(RejectionReason.SOURCE_HASH_INVALID, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `non-https url rejects with SOURCE_URL_INVALID`() = runTest {
        val result =
            validatorOf(citation(url = "http://www.egypt.gov.eg/law.pdf"))
                .verify("المادة 40 من قانون العقوبات", eventDate)
        assertEquals(RejectionReason.SOURCE_URL_INVALID, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `event date outside the window rejects as not effective - boundaries inclusive`() = runTest {
        val raw = "المادة 40 من قانون العقوبات"
        val v = validatorOf(citation(effectiveFrom = LocalDate.of(2026, 9, 2)))

        val before = v.verify(raw, LocalDate.of(2026, 9, 1))
        assertEquals(RejectionReason.NOT_EFFECTIVE_ON_EVENT_DATE, (before as VerificationResult.Rejected).reason)

        val firstDay = v.verify(raw, LocalDate.of(2026, 9, 2))
        assertTrue(firstDay is VerificationResult.Verified)
    }

    @Test
    fun `effectiveTo boundary is inclusive`() = runTest {
        val v = validatorOf(citation(effectiveTo = LocalDate.of(2026, 9, 1)))
        val result = v.verify("المادة 40 من قانون العقوبات", LocalDate.of(2026, 9, 1))
        assertTrue(result is VerificationResult.Verified)
    }

    @Test
    fun `default event date comes from the injected clock`() = runTest {
        // No explicit date: the validator must resolve 2026-09-01 from the
        // fixed clock. A row starting tomorrow must NOT be effective yet.
        val future = validatorOf(citation(effectiveFrom = LocalDate.of(2026, 9, 2)))
        val rejected = future.verify("المادة 40 من قانون العقوبات")
        assertEquals(RejectionReason.NOT_EFFECTIVE_ON_EVENT_DATE, (rejected as VerificationResult.Rejected).reason)

        val current = validatorOf(citation(effectiveFrom = LocalDate.of(2026, 1, 1)))
        assertTrue(current.verify("المادة 40 من قانون العقوبات") is VerificationResult.Verified)
    }

    // ------------------------------------------------------------------
    // Temporal version resolution (amendments coexist in the registry)
    // ------------------------------------------------------------------

    @Test
    fun `disjoint temporal versions resolve to the version in force`() = runTest {
        val oldVersion = citation(
            effectiveFrom = LocalDate.of(2021, 4, 1),
            effectiveTo = LocalDate.of(2024, 12, 31),
        )
        val newVersion = citation(
            effectiveFrom = LocalDate.of(2025, 1, 1),
            effectiveTo = null,
            sha = "a".repeat(64),
        )
        val result =
            validatorOf(oldVersion, newVersion).verify("المادة 40 من قانون العقوبات", eventDate)
        assertTrue(result is VerificationResult.Verified)
        assertEquals("a".repeat(64), (result as VerificationResult.Verified).citation.sourceSha256)
    }

    @Test
    fun `overlapping windows on the event date are ambiguous`() = runTest {
        val v1 = citation(effectiveFrom = LocalDate.of(2021, 4, 1), effectiveTo = null)
        val v2 = citation(effectiveFrom = LocalDate.of(2023, 1, 1), effectiveTo = null)
        val result =
            validatorOf(v1, v2).verify("المادة 40 من قانون العقوبات", eventDate)
        assertEquals(RejectionReason.AMBIGUOUS_SOURCE_MATCH, (result as VerificationResult.Rejected).reason)
    }

    @Test
    fun `gap between repeal and succession rejects as not effective`() = runTest {
        val oldVersion = citation(
            effectiveFrom = LocalDate.of(2021, 4, 1),
            effectiveTo = LocalDate.of(2024, 12, 31),
        )
        val futureVersion = citation(
            effectiveFrom = LocalDate.of(2026, 12, 31),
            effectiveTo = null,
        )
        val result =
            validatorOf(oldVersion, futureVersion).verify("المادة 40 من قانون العقوبات", eventDate)
        assertEquals(RejectionReason.NOT_EFFECTIVE_ON_EVENT_DATE, (result as VerificationResult.Rejected).reason)
    }

    // ------------------------------------------------------------------
    // validateAndSanitize()
    // ------------------------------------------------------------------

    @Test
    fun `blank or citation-free text passes through unchanged`() = runTest {
        val v = validatorOf()
        assertEquals("", v.validateAndSanitize("", eventDate))
        assertEquals("   ", v.validateAndSanitize("   ", eventDate))
        val plain = "نص بدون أي إحالة"
        assertEquals(plain, v.validateAndSanitize(plain, eventDate))
    }

    @Test
    fun `rejected span is replaced with the safety refusal`() = runTest {
        val raw = "المذكرة تستند إلى المادة 40 من قانون العقوبات، مع احترام الدفاع."
        val sanitized = validatorOf().validateAndSanitize(raw, eventDate)
        assertTrue(sanitized.contains(CitationValidator.SAFETY_REFUSAL))
        assertFalse(sanitized.contains("المادة 40"))
        assertTrue(sanitized.endsWith("، مع احترام الدفاع."))
    }

    @Test
    fun `verified citation survives sanitization`() = runTest {
        val raw = "المذكرة تستند إلى المادة 40 من قانون العقوبات، مع احترام الدفاع."
        val sanitized = validatorOf(citation()).validateAndSanitize(raw, eventDate)
        assertEquals(raw, sanitized)
    }

    @Test
    fun `multiple rejected spans are all replaced without shifting earlier ranges`() = runTest {
        val raw = "المادة 111 من قانون العقوبات. نص وسط. المادة 222 من قانون العقوبات."
        val sanitized = validatorOf().validateAndSanitize(raw, eventDate)
        val refusals = sanitized.split(CitationValidator.SAFETY_REFUSAL).size - 1
        assertEquals(2, refusals)
        assertFalse(sanitized.contains("المادة"))
        assertTrue(sanitized.contains("نص وسط."))
    }

    @Test
    fun `mixed verified and rejected citations are handled per span`() = runTest {
        val raw = "المادة 40 من قانون العقوبات. ثم المادة 999 من قانون العقوبات."
        val sanitized = validatorOf(citation()).validateAndSanitize(raw, eventDate)
        val refusals = sanitized.split(CitationValidator.SAFETY_REFUSAL).size - 1
        assertEquals(1, refusals)
        assertTrue(sanitized.contains("المادة 40"))
        assertFalse(sanitized.contains("المادة 999"))
    }
}
