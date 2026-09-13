package net.crimsys.app.data.legal

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import net.crimsys.app.core.Result
import net.crimsys.app.core.WallClock
import net.crimsys.app.core.runCatchingResult
import net.crimsys.app.data.local.LegalSourceDao
import net.crimsys.app.data.local.LegalSourceEntity
import net.crimsys.app.domain.legal.LegalRegistryRepository

/**
 * Room-backed legal registry. Persist-only by design: the decision that a
 * source IS authoritative belongs to the review workflow (human-verified
 * flag), never to this class.
 */
@Singleton
class LegalRegistryRepositoryImpl @Inject constructor(
    private val dao: LegalSourceDao,
    private val clock: WallClock,
) : LegalRegistryRepository {

    override fun observeSources(): Flow<List<LegalSourceEntity>> = dao.observeAll()

    override suspend fun findSourceByKey(sourceKey: String): LegalSourceEntity? =
        withContext(Dispatchers.IO) { dao.findByKey(sourceKey.trim()) }

    override suspend fun upsertSources(sources: List<LegalSourceEntity>): Result<Unit> =
        withContext(Dispatchers.IO) {
            runCatchingResult {
                if (sources.isEmpty()) return@runCatchingResult
                val now = clock.nowMillis()
                dao.upsertAll(
                    sources.map { source ->
                        source.copy(
                            sourceKey = source.sourceKey.trim(),
                            updatedAt = now,
                        )
                    },
                )
            }
        }

    override suspend fun seedDefaultsIfEmpty(defaults: List<LegalSourceEntity>): Result<Int> =
        withContext(Dispatchers.IO) {
            runCatchingResult {
                if (dao.count() > 0) return@runCatchingResult 0
                val now = clock.nowMillis()
                val rows = defaults.map { it.copy(createdAt = now, updatedAt = now) }
                dao.upsertAll(rows)
                rows.size
            }
        }
}
