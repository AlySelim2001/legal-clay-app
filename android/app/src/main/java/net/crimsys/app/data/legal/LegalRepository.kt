package net.crimsys.app.data.legal

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import net.crimsys.app.data.local.LegalDocumentDao
import net.crimsys.app.data.local.LegalDocumentEntity
import net.crimsys.app.domain.legal.LegalDocument

/**
 * Offline-first legal catalog repository. Room binds every query argument;
 * callers never concatenate user input into SQL.
 */
@Singleton
class LegalRepository @Inject constructor(
    private val dao: LegalDocumentDao,
) {
    fun observeSearch(query: String, limit: Int = DEFAULT_RESULT_LIMIT): Flow<List<LegalDocument>> =
        dao.observeSearch(query.trim(), limit.coerceIn(1, MAX_RESULT_LIMIT))
            .map { rows -> rows.map(LegalDocumentEntity::toDomain) }
            .catch { emit(emptyList()) }

    fun observeDocument(id: String): Flow<LegalDocument?> =
        dao.observeById(id)
            .map { it?.toDomain() }
            .catch { emit(null) }

    suspend fun hasVerifiedContent(): Boolean =
        runCatching { dao.countVerified() > 0 }.getOrDefault(false)

    private fun LegalDocumentEntity.toDomain() = LegalDocument(
        id = id,
        type = documentType,
        title = title,
        lawNumber = lawNumber,
        articleNumber = articleNumber,
        body = body,
        sourceUrl = sourceUrl,
        publishedAtEpochDay = publishedAtEpochDay,
        updatedAtEpochMillis = updatedAtEpochMillis,
        verified = verified,
    )

    private companion object {
        const val DEFAULT_RESULT_LIMIT = 50
        const val MAX_RESULT_LIMIT = 200
    }
}
