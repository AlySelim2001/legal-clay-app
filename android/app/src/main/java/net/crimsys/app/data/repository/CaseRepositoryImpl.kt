package net.crimsys.app.data.repository

import androidx.annotation.VisibleForTesting
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import net.crimsys.app.core.AppError
import net.crimsys.app.core.Result
import net.crimsys.app.core.runCatchingResult
import net.crimsys.app.data.local.CaseDao
import net.crimsys.app.data.local.CaseEntity
import net.crimsys.app.data.local.HearingDao
import net.crimsys.app.data.local.HearingEntity
import net.crimsys.app.data.local.OfflineActionDao
import net.crimsys.app.data.local.OfflineActionEntity
import net.crimsys.app.data.local.OfflineActionType
import net.crimsys.app.data.sync.NetworkMonitor
import net.crimsys.app.data.sync.SyncManager
import net.crimsys.app.domain.model.CaseDraft
import net.crimsys.app.domain.repository.CaseRepository

@Singleton
class CaseRepositoryImpl @Inject constructor(
    private val caseDao: CaseDao,
    private val hearingDao: HearingDao,
    private val offlineActionDao: OfflineActionDao,
    private val networkMonitor: NetworkMonitor,
    private val syncManager: SyncManager,
) : CaseRepository {

    private val json = Json { encodeDefaults = true }

    // ---------------------------------------------------------------- reads

    override fun getCases(): Flow<List<CaseEntity>> = caseDao.observeCases()

    override suspend fun getCaseById(id: String): CaseEntity? =
        withContext(Dispatchers.IO) { caseDao.getById(id) }

    override fun getUpcomingHearings(fromEpochDay: Long): Flow<List<HearingEntity>> =
        hearingDao.observeUpcoming(fromEpochDay)

    // --------------------------------------------------------------- writes

    override suspend fun createCase(draft: CaseDraft): Result<Unit> =
        withContext(Dispatchers.IO) {
            runCatchingResult {
                val now = System.currentTimeMillis()
                val entity =
                    CaseEntity(
                        id = UUID.randomUUID().toString(),
                        caseNumber = draft.caseNumber,
                        courtName = draft.courtName,
                        caseType = draft.caseType,
                        memoHtml = draft.memoHtml,
                        isSynced = false,
                        createdAt = now,
                        updatedAt = now,
                    )

                // 1) Room immediately — single source of truth, UI updates reactively.
                caseDao.upsert(entity)

                // 2) Queue entry first: guarantees no mutation is ever lost even if
                //    the process dies between enqueue and push.
                val payload: JsonObject =
                    buildJsonObject {
                        put("caseId", entity.id)
                        put("caseNumber", entity.caseNumber)
                        put("courtName", entity.courtName)
                        put("caseType", entity.caseType)
                    }
                offlineActionDao.enqueue(
                    OfflineActionEntity(
                        type = OfflineActionType.CREATE_CASE,
                        payloadJson = json.encodeToString(JsonObject.serializer(), payload),
                    ),
                )

                // 3) If online, attempt an immediate drain; else SyncManager will
                //    pick it up on the next connectivity event.
                if (networkMonitor.isOnline.value) {
                    syncManager.drainQueue()
                }
            }
        }

    override suspend fun saveMemo(caseId: String, memoHtml: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            runCatchingResult {
                caseDao.updateMemo(caseId, memoHtml)
                val payload: JsonObject =
                    buildJsonObject {
                        put("caseId", caseId)
                        put("memoHtml", memoHtml)
                    }
                offlineActionDao.enqueue(
                    OfflineActionEntity(
                        type = OfflineActionType.UPDATE_MEMO,
                        payloadJson = json.encodeToString(JsonObject.serializer(), payload),
                    ),
                )
                if (networkMonitor.isOnline.value) {
                    syncManager.drainQueue()
                }
            }
        }

    @VisibleForTesting
    internal suspend fun debugForceDrain() = syncManager.drainQueue()
}
