package net.crimsys.app.domain.legal

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test

class CitationValidatorTest {

    private val clock =
        Clock.fixed(
            Instant.parse(
                "2026-09-13T00:00:00Z",
            ),
            ZoneOffset.UTC,
        )

    @Test
    fun `unverified citation is replaced`() =
        runBlocking {

            val validator =
                CitationValidator(
                    registry =
                        FakeRegistry(emptyList()),
                    clock = clock,
                )

            val result =
                validator.validateAndSanitize(
                    "تنص المادة 999 من قانون العقوبات على ذلك.",
                )

            assertEquals(
                "تنص ${CitationValidator.SAFETY_REFUSAL} على ذلك.",
                result,
            )
        }

    @Test
    fun `verified citation survives`() =
        runBlocking {

            val source =
                LegalCitation(
                    lawNumber = "58",
                    lawName = "قانون العقوبات",
                    article = "341",
                    paragraph = null,
                    effectiveFrom =
                        LocalDate.of(
                            1937,
                            5,
                            31,
                        ),
                    effectiveTo = null,
                    sourceSha256 =
                        "a".repeat(64),
                    officialSourceUrl =
                        "https://example.gov.eg/law",
                    gazetteIssue = "58",
                )

            val validator =
                CitationValidator(
                    FakeRegistry(
                        listOf(source),
                    ),
                    clock,
                )

            val input =
                "وفقًا للمادة 341 من قانون العقوبات."

            assertEquals(
                input,
                validator.validateAndSanitize(
                    input,
                ),
            )
        }

    @Test
    fun `arabic indic digits are normalized`() {

        val validator =
            CitationValidator(
                FakeRegistry(emptyList()),
                clock,
            )

        val parsed =
            validator.parse(
                "المادة ٣٤١ من قانون العقوبات",
            )

        assertEquals(1, parsed.size)

        assertEquals(
            "341",
            parsed.single().article,
        )

        assertEquals(
            "قانون العقوبات",
            parsed.single().lawName,
        )
    }

    @Test
    fun `inactive source is rejected`() =
        runBlocking {

            val source =
                LegalCitation(
                    lawNumber = "1",
                    lawName = "قانون العقوبات",
                    article = "341",
                    paragraph = null,
                    effectiveFrom =
                        LocalDate.of(
                            2030,
                            1,
                            1,
                        ),
                    effectiveTo = null,
                    sourceSha256 =
                        "a".repeat(64),
                    officialSourceUrl =
                        "https://example.gov.eg/law",
                    gazetteIssue = null,
                )

            val validator =
                CitationValidator(
                    FakeRegistry(
                        listOf(source),
                    ),
                    clock,
                )

            assertEquals(
                CitationValidator.SAFETY_REFUSAL,
                validator.validateAndSanitize(
                    "المادة 341 من قانون العقوبات",
                    LocalDate.of(
                        2026,
                        9,
                        13,
                    ),
                ),
            )
        }

    private class FakeRegistry(
        private val sources:
            List<LegalCitation>,
    ) : LegalRegistryRepository {

        override suspend fun findExact(
            lawName: String,
            article: String,
            paragraph: String?,
            lawNumber: String?,
        ): List<LegalCitation> =
            sources.filter {
                it.lawName == lawName &&
                    it.article == article &&
                    it.paragraph == paragraph
            }

        override suspend fun isEffective(
            citation: LegalCitation,
            eventDate: LocalDate,
        ): Boolean =
            !eventDate.isBefore(
                citation.effectiveFrom,
            ) &&
                (
                    citation.effectiveTo == null ||
                        !eventDate.isAfter(
                            citation.effectiveTo,
                        )
                    )
    }
}
