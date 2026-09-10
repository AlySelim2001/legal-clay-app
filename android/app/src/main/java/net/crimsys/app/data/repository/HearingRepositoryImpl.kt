package net.crimsys.app.data.repository

import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import net.crimsys.app.core.Result
import net.crimsys.app.core.runCatchingResult
import net.crimsys.app.data.local.HearingDao
import net.crimsys.app.data.local.HearingEntity
import net.crimsys.app.data.local.OfflineActionDao
import net.crimsys.app.data.local.OfflineActionEntity
import net.crimsys.app.data.local.OfflineActionType
import net.crimsys.app.data.sync.NetworkMonitor
import net.crimsys.app.data.sync.SyncManager
import net.crimsys.app.domain.repository.HearingRepository

@Singleton
class HearingRepositoryImpl @Inject constructor(
    private val hearingDao: HearingDao,
    private val offlineActionDao: OfflineActionDao,
    private val networkMonitor: NetworkMonitor,
    private val syncManager: SyncManager,
) : HearingRepository {

    private val json = Json { encodeDefaults = true }

    override fun getHearingsForDay(day: LocalDate): Flow<List<HearingEntity>> =
        hearingDao.observeHearingsForDay(day.toEpochDay())

    override fun getHearingDays(from: LocalDate): Flow<Set<Long>> =
        hearingDao.observeHearingDays(from.toEpochDay()).map { it.toSet() }

    override fun getUpcomingHearings(from: LocalDate): Flow<List<HearingEntity>> =
        hearingDao.observeUpcoming(from.toEpochDay())

    override suspend fun scheduleHearing(hearing: HearingEntity): Result<Unit> =
        withContext(Dispatchers.IO) {
            runCatchingResult {
                // 1) Room immediately — calendar dots render without connectivity.
                hearingDao.upsert(hearing)

                // 2) Queue before pushing so the mutation is never lost.
                val payload: JsonObject =
                    buildJsonObject {
                        put("hearingId", hearing.id)
                        put("caseId", hearing.caseId)
                        put("caseNumber", hearing.caseNumber)
                        put("courtName", hearing.courtName)
                        put("epochDay", hearing.epochDay)
                        put("timeLabel", hearing.timeLabel)
                    }
                offlineActionDao.enqueue(
                    OfflineActionEntity(
                        type = OfflineActionType.CREATE_HEARING,
                        payloadJson = json.encodeToString(JsonObject.serializer(), payload),
                    ),
                )

                // 3) Opportunistic immediate drain request; SyncManager owns the rest.
                if (networkMonitor.isOnline.value) {
                    syncManager.requestDrain()
                }
            }
        }
}
