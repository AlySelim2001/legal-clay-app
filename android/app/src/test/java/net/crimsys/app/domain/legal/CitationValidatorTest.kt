package net.crimsys.app.domain.legal

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import net.crimsys.app.core.Result
import net.crimsys.app.data.local.LegalSourceEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CitationValidatorTest {

    /** In-memory registry — the validator is pure domain and needs nothing else. */
    private class FakeRegistry(
        private val sources: List<LegalSourceEntity>,
    ) : LegalRegistryRepository {
        override fun observeSources(): Flow<List<LegalSourceEntity>> = flowOf(sources)
        override suspend fun findSourceByKey(sourceKey: String): LegalSourceEntity? =
            sources.firstOrNull { it.sourceKey == sourceKey.trim() }

        override suspend fun upsertSources(sources: List<LegalSourceEntity>): Result<Unit> =
            Result.Success(Unit)

        override suspend fun seedDefaultsIfEmpty(defaults: List<LegalSourceEntity>): Result<Int> =
            Result.Success(0)
    }

    private val registry = FakeRegistry(
        listOf(
            LegalSourceEntity(
                sourceKey = "law-150-2020",
                title = "القانون رقم 150 لسنة 2020",
                publisher = "الجريدة الرسمية",
                effectiveAtEpochMs = 1_600_000_000_000L,
            ),
        ),
    )
    private val validator = RegistryBackedCitationValidator(registry)

    private fun validCitation() = LegalCitation(
        sourceKey = "law-150-2020",
        title = "القانون رقم 150 لسنة 2020",
        publisher = "الجريدة الرسمية",
        reference = "مادة ٤٠",
        retrievedAtEpochMs = 1_700_000_000_000L,
    )

    @Test
    fun `fully verified citation passes`() = runTest {
        val verdict = validator.validate(validCitation())
        assertTrue(verdict.issues.toString(), verdict.isValid)
    }

    @Test
    fun `blank mandatory fields are reported`() = runTest {
        val verdict =
            validator.validate(validCitation().copy(reference = "  ", publisher = "", title = ""))
        assertTrue(CitationIssue.EMPTY_REFERENCE in verdict.issues)
        assertTrue(CitationIssue.EMPTY_PUBLISHER in verdict.issues)
        assertTrue(CitationIssue.EMPTY_TITLE in verdict.issues)
        assertFalse(verdict.isValid)
    }

    @Test
    fun `unregistered source key fails`() = runTest {
        val verdict = validator.validate(validCitation().copy(sourceKey = "law-999-9999"))
        assertEquals(listOf(CitationIssue.UNKNOWN_SOURCE), verdict.issues)
    }

    @Test
    fun `publisher mismatch fails`() = runTest {
        val verdict = validator.validate(validCitation().copy(publisher = "منتدى غير رسمي"))
        assertEquals(listOf(CitationIssue.PUBLISHER_MISMATCH), verdict.issues)
    }

    @Test
    fun `retrieval before entry into force fails`() = runTest {
        val verdict =
            validator.validate(validCitation().copy(retrievedAtEpochMs = 1_500_000_000_000L))
        assertEquals(listOf(CitationIssue.EFFECTIVE_AFTER_RETRIEVAL), verdict.issues)
    }

    @Test
    fun `implausible retrieval time short-circuits registry checks`() = runTest {
        val verdict = validator.validate(validCitation().copy(retrievedAtEpochMs = 0))
        assertEquals(listOf(CitationIssue.INVALID_RETRIEVAL_TIME), verdict.issues)
    }
}
