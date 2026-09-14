package net.crimsys.app.data.evidence

import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import java.io.ByteArrayInputStream
import java.time.Clock
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
import net.crimsys.app.core.evidence.ChainEventHasher
import net.crimsys.app.core.evidence.Sha256
import net.crimsys.app.core.runCatchingResult
import net.crimsys.app.data.local.EvidenceChainEventEntity
import net.crimsys.app.data.local.EvidenceDao
import net.crimsys.app.data.local.EvidenceEntity
import net.crimsys.app.data.local.SyncCommandDao
import net.crimsys.app.data.local.SyncCommandEntity
import net.crimsys.app.data.sync.SyncWorker
import net.crimsys.app.domain.evidence.ChainAction
import net.crimsys.app.domain.evidence.ChainEvent
import net.crimsys.app.domain.evidence.EvidenceRepository
import net.crimsys.app.domain.sync.SyncCommand

/**
 * Evidence chain-of-custody store. Room is the single source of truth; every
 * append is persisted locally first, then queued as a [SyncCommand] drained
 * by [SyncWorker] (offline-first — a push failure never loses an event).
 *
 * Integrity invariants enforced here (the caller cannot bypass them):
 *  - the content digest is computed HERE via [Sha256.digest] over the bytes
 *    supplied at capture — the caller never supplies a hash;
 *  - every [ChainEvent] is built by [ChainEventHasher.create] from the chain
 *    head — the canonical digest binds (action | timestamp | prev | content),
 *    so an event is self-verifying against its item's `sha256Hex`;
 *  - the head pointer and the event counter move in the same transaction as
 *    the appended event ([EvidenceDao.appendChainEvent]);
 *  - a chain can never be created without its CAPTURED event, and vice versa.
 */
@Singleton
class EvidenceRepositoryImpl @Inject constructor(
    private val evidenceDao: EvidenceDao,
    private val syncCommandDao: SyncCommandDao,
    private val workManager: WorkManager,
    private val clock: Clock,
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
        if (input.content.isEmpty()) {
            return Result.Error(AppError.Validation("محتوى الدليل مطلوب لحساب البصمة"))
        }
        if (input.label.isBlank()) {
            return Result.Error(AppError.Validation("وصف الدليل مطلوب"))
        }
        return runCatchingResult {
            val id = UUID.randomUUID().toString()

            // The content digest is computed by the store, never the caller —
            // streaming over the bytes in constant memory (large recordings OK).
            val contentHash = Sha256.digest(ByteArrayInputStream(input.content))
            if (!isValidHash(contentHash)) {
                throw IllegalStateException("content digest rejected: malformed SHA-256")
            }

            // Genesis link: previousHash = null in the domain model, stored
            // canonically as 64 zeros in the persistence layer.
            val event = ChainEventHasher.create(
                action = ChainAction.CAPTURED,
                timestampEpochMillis = input.capturedAtEpochMs,
                previousHash = null,
                contentHash = contentHash,
            )

            val evidence = EvidenceEntity(
                id = id,
                label = input.label.trim(),
                sha256Hex = contentHash,
                chainHeadHash = event.currentHash,
                eventCount = 1,
                capturedAtEpochMs = input.capturedAtEpochMs,
                isSynced = false,
                createdAt = clock.millis(),
                updatedAt = clock.millis(),
            )
            val eventEntity = EvidenceChainEventEntity(
                id = UUID.randomUUID().toString(),
                evidenceId = id,
                action = event.action.name,
                occurredAtEpochMs = event.timestampEpochMillis,
                contentHash = contentHash,
                eventHash = event.currentHash,
                previousEventHash = EvidenceChainEventEntity.GENESIS_PREV,
            )

            evidenceDao.insertEvidenceWithEvent(evidence, eventEntity)
            queueCapture(evidence, eventEntity)
            id
        }
    }

    override suspend fun appendEvent(
        evidenceId: String,
        action: ChainAction,
    ): Result<ChainEvent> {
        if (evidenceId.isBlank()) {
            return Result.Error(AppError.Validation("معرّف الدليل مطلوب"))
        }
        return runCatchingResult {
            val evidence = evidenceDao.findEvidence(evidenceId)
                ?: throw IllegalArgumentException("unknown evidence: $evidenceId")

            val now = clock.millis()
            val head = evidenceDao.findChainHead(evidenceId)

            // Contract: never accept a timestamp older than the chain head —
            // a backwards-set device clock would make the chain's narrative
            // contradict its hash order.
            if (head != null && now < head.occurredAtEpochMs) {
                throw IllegalStateException("chain timestamp regression for $evidenceId")
            }

            // Every link re-binds the SAME content hash — an event is only
            // valid as part of the chain of one specific evidence item.
            val event = ChainEventHasher.create(
                action = action,
                timestampEpochMillis = now,
                previousHash = head?.eventHash,
                contentHash = evidence.sha256Hex,
            )
            val entity = EvidenceChainEventEntity(
                id = UUID.randomUUID().toString(),
                evidenceId = evidenceId,
                action = event.action.name,
                occurredAtEpochMs = event.timestampEpochMillis,
                contentHash = evidence.sha256Hex,
                eventHash = event.currentHash,
                previousEventHash = head?.eventHash ?: EvidenceChainEventEntity.GENESIS_PREV,
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
            var previousHash: String? = null
            var brokenAt: String? = null

            for (event in chain) {
                val rebuilt = ChainEventHasher.create(
                    action = ChainAction.valueOf(event.action),
                    timestampEpochMillis = event.occurredAtEpochMs,
                    previousHash = previousHash,
                    contentHash = event.contentHash,
                )
                val expectedPrev = previousHash ?: EvidenceChainEventEntity.GENESIS_PREV
                val prevOk = event.previousEventHash == expectedPrev
                val linkOk = event.eventHash == rebuilt.currentHash
                // Content binding: the attested bytes must be the item's bytes.
                val contentOk = event.contentHash == evidence.sha256Hex
                if (!prevOk || !linkOk || !contentOk) {
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

            EvidenceRepository.ChainVerification(
                evidenceId = evidenceId,
                valid = brokenAt == null,
                inspectedEvents = chain.size,
                brokenAtEventId = brokenAt,
            )
        }
    }

    // ------------------------------------------------------- sync queueing

    private suspend fun queueCapture(evidence: EvidenceEntity, event: EvidenceChainEventEntity) {
        val payload = buildJsonObject {
            put("evidenceId", evidence.id)
            put("eventId", event.id)
            put("action", event.action)
            put("label", evidence.label)
            put("sha256", evidence.sha256Hex)
            put("capturedAt", evidence.capturedAtEpochMs)
            put("occurredAt", event.occurredAtEpochMs)
            put("contentHash", event.contentHash)
            put("eventHash", event.eventHash)
            put("previousEventHash", event.previousEventHash)
        }
        enqueueCommand(SyncCommand.Type.EVIDENCE_APPEND_EVENT, json.encodeToString(JsonObject.serializer(), payload))
    }

    private suspend fun queueAppend(evidence: EvidenceEntity, event: EvidenceChainEventEntity) {
        val payload = buildJsonObject {
            put("evidenceId", evidence.id)
            put("eventId", event.id)
            put("action", event.action)
            put("occurredAt", event.occurredAtEpochMs)
            put("contentHash", event.contentHash)
            put("eventHash", event.eventHash)
            put("previousEventHash", event.previousEventHash)
        }
        enqueueCommand(SyncCommand.Type.EVIDENCE_APPEND_EVENT, json.encodeToString(JsonObject.serializer(), payload))
    }

    private suspend fun enqueueCommand(type: String, payloadJson: String) {
        val command = SyncCommand.create(type, payloadJson, clock.millis())
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

    private fun isValidHash(hex: String): Boolean =
        hex.length == 64 && hex.all { it in "0123456789abcdef" }

    /** Domain link: `previousHash` is null exactly at genesis (64 zeros). */
    private fun EvidenceChainEventEntity.toDomain(): ChainEvent =
        ChainEvent(
            action = ChainAction.valueOf(action),
            timestampEpochMillis = occurredAtEpochMs,
            previousHash = if (previousEventHash == EvidenceChainEventEntity.GENESIS_PREV) null else previousEventHash,
            currentHash = eventHash,
        )

    private companion object {
        const val DRAIN_WORK_NAME = "haris-sync-command-drain"
    }
}
