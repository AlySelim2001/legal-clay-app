package net.crimsys.app.data.evidence

import android.util.Base64
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import net.crimsys.app.core.AppError
import net.crimsys.app.core.Result
import net.crimsys.app.core.WallClock
import net.crimsys.app.core.evidence.ChainEventHasher
import net.crimsys.app.core.evidence.Sha256
import net.crimsys.app.core.runCatchingResult
import net.crimsys.app.data.local.EvidenceChainEventEntity
import net.crimsys.app.data.local.EvidenceDao
import net.crimsys.app.data.local.EvidenceEntity
import net.crimsys.app.data.local.SyncCommandDao
import net.crimsys.app.data.local.SyncCommandEntity
import net.crimsys.app.data.sync.SyncWorker
import net.crimsys.app.domain.evidence.ChainEvent
import net.crimsys.app.domain.evidence.EvidenceRepository
import net.crimsys.app.domain.sync.SyncCommand

/**
 * Evidence chain-of-custody store. Room is the single source of truth; every
 * append is persisted locally first, then queued as a [SyncCommand] drained
 * by [SyncWorker] (offline-first — a push failure never loses an event).
 *
 * Integrity invariants enforced here (the caller cannot bypass them):
 *  - hash links are computed from the CURRENT chain head, never supplied by
 *    the caller;
 *  - the head pointer and the event counter move in the same transaction as
 *    the appended event ([EvidenceDao.appendChainEvent]);
 *  - a chain can never be created without its CAPTURED event, and vice versa.
 */
@Singleton
class EvidenceRepositoryImpl @Inject constructor(
    private val evidenceDao: EvidenceDao,
    private val syncCommandDao: SyncCommandDao,
    private val workManager: WorkManager,
    private val clock: WallClock,
) : EvidenceRepository {

    private val json = Json { encodeDefaults = true }

    // ---------------------------------------------------------------- reads

    override fun observeEvidence(): Flow<List<EvidenceRepository.EvidenceSummary>> =
        evidenceDao.observeEvidence().map { rows ->
            rows.map { row ->
                EvidenceRepository.EvidenceSummary(
                    id = row.id,
                    label = row.label,
                    sha256Hex = row.sha256Hex,
                    capturedAtEpochMs = row.capturedAtEpochMs,
                    isSynced = row.isSynced,
                    eventCount = row.eventCount,
                )
            }
        }

    override fun observeChain(evidenceId: String): Flow<List<ChainEvent>> =
        evidenceDao.observeChain(evidenceId).map { rows -> rows.map { it.toDomain() } }

    // --------------------------------------------------------------- writes

    override suspend fun captureEvidence(input: EvidenceRepository.CaptureEvidenceInput): Result<String> {
        val sha = input.sha256Hex.trim().lowercase()
        if (sha.length != 64 || sha.any { it !in "0123456789abcdef" }) {
            return Result.Error(AppError.Validation("بصمة الدليل (SHA-256) غير صالحة"))
        }
        if (input.label.isBlank()) {
            return Result.Error(AppError.Validation("وصف الدليل مطلوب"))
        }
        return runCatchingResult {
            val id = UUID.randomUUID().toString()
            val now = clock.nowMillis()
            val eventHash =
                ChainEventHasher.hash(ChainEventHasher.GENESIS_PREV, ChainEvent.Kind.CAPTURED, input.capturedAtEpochMs, null)

            val evidence = EvidenceEntity(
                id = id,
                label = input.label.trim(),
                sha256Hex = sha,
                chainHeadHash = eventHash,
                eventCount = 1,
                capturedAtEpochMs = input.capturedAtEpochMs,
                isSynced = false,
                createdAt = now,
                updatedAt = now,
            )
            val event = EvidenceChainEventEntity(
                id = UUID.randomUUID().toString(),
                evidenceId = id,
                offline = input.offline,
                kind = ChainEvent.Kind.CAPTURED,
                payload = null,
                occurredAtEpochMs = input.capturedAtEpochMs,
                eventHash = eventHash,
                previousEventHash = ChainEventHasher.GENESIS_PREV,
            )

            evidenceDao.insertEvidenceWithEvent(evidence, event)
            queueCapture(evidence, event)
            id
        }
    }

    override suspend fun appendEvent(
        evidenceId: String,
        kind: String,
        payload: ByteArray?,
        offline: Boolean,
    ): Result<ChainEvent> {
        if (evidenceId.isBlank()) {
            return Result.Error(AppError.Validation("معرّف الدليل مطلوب"))
        }
        if (kind.isBlank()) {
            return Result.Error(AppError.Validation("نوع حدث السلسلة مطلوب"))
        }
        return runCatchingResult {
            val evidence = evidenceDao.findEvidence(evidenceId)
                ?: throw IllegalArgumentException("unknown evidence: $evidenceId")

            val now = clock.nowMillis()
            val head = evidenceDao.findChainHead(evidenceId)
            val previousHash = head?.eventHash ?: ChainEventHasher.GENESIS_PREV

            // Contract: never accept a timestamp older than the chain head —
            // a backwards-set device clock would make the chain's narrative
            // contradict its hash order.
            if (head != null && now < head.occurredAtEpochMs) {
                throw IllegalStateException("chain timestamp regression for $evidenceId")
            }

            val eventHash = ChainEventHasher.hash(previousHash, kind, now, payload)
            val entity = EvidenceChainEventEntity(
                id = UUID.randomUUID().toString(),
                evidenceId = evidenceId,
                offline = offline,
                kind = kind,
                payload = payload,
                occurredAtEpochMs = now,
                eventHash = eventHash,
                previousEventHash = previousHash,
            )

            evidenceDao.appendChainEvent(entity, evidenceId)
            queueAppend(evidence, entity)
            entity.toDomain()
        }
    }

    override suspend fun verifyChain(evidenceId: String): Result<EvidenceRepository.ChainVerification> {
        if (evidenceId.isBlank()) {
            return Result.Error(AppError.Validation("معرّف الدليل مطلوب"))
        }
        return runCatchingResult {
            val evidence = evidenceDao.findEvidence(evidenceId)
                ?: throw IllegalArgumentException("unknown evidence: $evidenceId")

            val chain = evidenceDao.chainInOrder(evidenceId)
            var previousHash = ChainEventHasher.GENESIS_PREV
            var brokenAt: String? = null

            for (event in chain) {
                val expected = ChainEventHasher.hash(previousHash, event.kind, event.occurredAtEpochMs, event.payload)
                if (event.previousEventHash != previousHash || !Sha256.matches(event.eventHash, expected)) {
                    brokenAt = event.id
                    break
                }
                previousHash = event.eventHash
            }

            // Head-pointer tamper check: a re-spliced chain that rehashes
            // consistently still disagrees with the head stored on the item.
            if (brokenAt == null && chain.isNotEmpty() && evidence.chainHeadHash != chain.last().eventHash) {
                brokenAt = chain.last().id
            }

            val valid = brokenAt == null
            if (valid) {
                // Verification becomes part of the auditable record.
                appendEventInternal(evidenceId, ChainEvent.Kind.HASH_VERIFIED, payload = null)
            }
            EvidenceRepository.ChainVerification(
                evidenceId = evidenceId,
                valid = valid,
                inspectedEvents = chain.size,
                brokenAtEventId = brokenAt,
            )
        }
    }

    /**
     * Append used by [verifyChain] itself. [appendEvent] cannot be reused
     * directly — it would queue a second sync command for an event that is
     * an artifact of verification, doubling remote rows. This variant
     * persists the chain link only.
     */
    private suspend fun appendEventInternal(evidenceId: String, kind: String, payload: ByteArray?): ChainEvent {
        val now = clock.nowMillis()
        val head = evidenceDao.findChainHead(evidenceId)
        val previousHash = head?.eventHash ?: ChainEventHasher.GENESIS_PREV
        val eventHash = ChainEventHasher.hash(previousHash, kind, now, payload)
        val entity = EvidenceChainEventEntity(
            id = UUID.randomUUID().toString(),
            evidenceId = evidenceId,
            offline = false,
            kind = kind,
            payload = payload,
            occurredAtEpochMs = now,
            eventHash = eventHash,
            previousEventHash = previousHash,
        )
        evidenceDao.appendChainEvent(entity, evidenceId)
        return entity.toDomain()
    }

    // ------------------------------------------------------- sync queueing

    private suspend fun queueCapture(evidence: EvidenceEntity, event: EvidenceChainEventEntity) {
        val payload = buildJsonObject {
            put("evidenceId", evidence.id)
            put("eventId", event.id)
            put("kind", event.kind)
            put("label", evidence.label)
            put("sha256", evidence.sha256Hex)
            put("capturedAt", evidence.capturedAtEpochMs)
            put("occurredAt", event.occurredAtEpochMs)
            put("offline", event.offline)
            put("eventHash", event.eventHash)
            put("previousEventHash", event.previousEventHash)
        }
        enqueueCommand(SyncCommand.Type.EVIDENCE_APPEND_EVENT, json.encodeToString(JsonObject.serializer(), payload))
    }

    private suspend fun queueAppend(evidence: EvidenceEntity, event: EvidenceChainEventEntity) {
        val payload = buildJsonObject {
            put("evidenceId", evidence.id)
            put("eventId", event.id)
            put("kind", event.kind)
            put("occurredAt", event.occurredAtEpochMs)
            put("offline", event.offline)
            put("eventHash", event.eventHash)
            put("previousEventHash", event.previousEventHash)
            if (event.payload != null) {
                put("payloadB64", Base64.encodeToString(event.payload, Base64.NO_WRAP))
            }
        }
        enqueueCommand(SyncCommand.Type.EVIDENCE_APPEND_EVENT, json.encodeToString(JsonObject.serializer(), payload))
    }

    private suspend fun enqueueCommand(type: String, payloadJson: String) {
        val command = SyncCommand.create(type, payloadJson, clock.nowMillis())
        syncCommandDao.enqueue(SyncCommandEntity.fromCommand(command))
        requestDrain()
    }

    /**
     * Expedited one-time drain. The CONNECTED constraint makes WorkManager
     * hold the request while offline — no manual connectivity check needed.
     */
    private fun requestDrain() {
        val request = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(
                Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
            )
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        workManager.enqueueUniqueWork(DRAIN_WORK_NAME, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }

    private fun EvidenceChainEventEntity.toDomain(): ChainEvent =
        ChainEvent(
            id = id,
            evidenceId = evidenceId,
            offline = offline,
            kind = kind,
            payload = payload,
            occurredAtEpochMs = occurredAtEpochMs,
            eventHash = eventHash,
            previousEventHash = previousEventHash,
        )

    private companion object {
        const val DRAIN_WORK_NAME = "haris-sync-command-drain"
    }
}
