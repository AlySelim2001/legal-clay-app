package net.crimsys.app.data.evidence

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
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
import net.crimsys.app.data.local.EvidenceDao
import net.crimsys.app.data.local.EvidenceEntity
import net.crimsys.app.data.local.SyncCommandDao
import net.crimsys.app.data.local.SyncCommandEntity
import net.crimsys.app.data.sync.SyncWorker
import net.crimsys.app.domain.evidence.ChainAction
import net.crimsys.app.domain.evidence.ChainEvent
import net.crimsys.app.domain.evidence.ChainOfCustody
import net.crimsys.app.domain.evidence.EvidenceRepository
import net.crimsys.app.domain.sync.SyncCommand

/**
 * Evidence chain-of-custody store. Room is the single source of truth; every
 * mutation is persisted locally first, then queued as a [SyncCommand] drained
 * by [SyncWorker] (offline-first — a push failure never loses evidence).
 *
 * Integrity invariants enforced here (the caller cannot bypass them):
 *  - the original-file digest is computed HERE via [Sha256.digest] over the
 *    captured bytes — callers hand over content, never hashes;
 *  - the bytes are stored at their CONTENT-ADDRESSED path
 *    (`evidence/<sha256>.<ext>`), so file identity == custody identity and
 *    registration is idempotent on bytes;
 *  - every [ChainEvent] is built by [ChainEventHasher.create] from the live
 *    chain head, binding (action | timestamp | prev | originalFileHash) —
 *    the whole chain re-serializes into `chainOfCustodyJson` atomically
 *    (single UPDATE, head always moves with the event);
 *  - a custody column that fails to decode blocks appends and fails
 *    verification — corrupted custody data is never silently reset.
 */
@Singleton
class EvidenceRepositoryImpl @Inject constructor(
    @ApplicationContext private val context: Context,
    private val evidenceDao: EvidenceDao,
    private val syncCommandDao: SyncCommandDao,
    private val workManager: WorkManager,
    private val clock: Clock,
) : EvidenceRepository {

    private val json = Json { encodeDefaults = true }

    // ---------------------------------------------------------------- reads

    override fun observeForCase(caseId: String): Flow<List<EvidenceRepository.EvidenceSummary>> =
        evidenceDao.observeForCase(caseId).map { rows -> rows.map { it.toSummary() } }

    override fun observeChain(evidenceId: String): Flow<List<ChainEvent>> =
        evidenceDao.observeById(evidenceId).map { row -> row?.toChain().orEmpty() }

    // --------------------------------------------------------------- writes

    override suspend fun registerEvidence(
        input: EvidenceRepository.RegisterEvidenceInput,
    ): Result<EvidenceRepository.Registration> {
        if (input.caseId.isBlank()) {
            return Result.Error(AppError.Validation("معرّف القضية مطلوب"))
        }
        if (input.mimeType.isBlank()) {
            return Result.Error(AppError.Validation("نوع الملف مطلوب"))
        }
        if (input.content.isEmpty()) {
            return Result.Error(AppError.Validation("محتوى الدليل مطلوب لحساب البصمة"))
        }
        return runCatchingResult {
            // The content digest is computed by the store, never the caller —
            // streaming over the bytes in constant memory (large recordings OK).
            val contentHash = Sha256.digest(input.content.inputStream())
            if (!isValidHash(contentHash)) {
                throw IllegalStateException("content digest rejected: malformed SHA-256")
            }

            // Dedup on bytes: the UNIQUE index on originalFileHash makes a
            // second row for the same content structurally impossible, so a
            // probe hit IS the idempotent outcome.
            val existing = evidenceDao.findByOriginalHash(contentHash)
            if (existing != null) {
                return@runCatchingResult EvidenceRepository.Registration(
                    evidenceId = existing.id,
                    alreadyRegistered = true,
                )
            }

            // Content-addressed immutable storage: file identity == digest.
            val relativePath = contentAddressedPath(contentHash, input.mimeType)
            storeContent(relativePath, input.content)

            val id = UUID.randomUUID().toString()
            val genesis = ChainEventHasher.create(
                action = ChainAction.CAPTURED,
                timestampEpochMillis = input.capturedAtEpochMillis,
                previousHash = null,
                contentHash = contentHash,
            )
            val entity = EvidenceEntity(
                id = id,
                caseId = input.caseId.trim(),
                originalFileHash = contentHash,
                processedFileHash = null,
                mimeType = input.mimeType.trim(),
                captureTimestamp = input.capturedAtEpochMillis,
                chainOfCustodyJson = ChainOfCustody.encode(ChainOfCustody(events = listOf(genesis))),
                immutableRelativePath = relativePath,
            )

            evidenceDao.insert(entity)
            queueSnapshot(entity)
            EvidenceRepository.Registration(evidenceId = id, alreadyRegistered = false)
        }
    }

    override suspend fun setProcessedHash(
        evidenceId: String,
        processedHash: String?,
    ): Result<Unit> {
        if (evidenceId.isBlank()) {
            return Result.Error(AppError.Validation("معرّف الدليل مطلوب"))
        }
        if (processedHash != null && !isValidHash(processedHash.trim().lowercase())) {
            return Result.Error(AppError.Validation("بصمة الملف المعالج غير صالحة"))
        }
        return runCatchingResult {
            val row = evidenceDao.findById(evidenceId)
                ?: throw IllegalArgumentException("unknown evidence: $evidenceId")
            evidenceDao.setProcessedFileHash(evidenceId, processedHash?.trim()?.lowercase())
            // The processed hash is part of the remote snapshot — re-queue the
            // row so the backend sees the pipeline result.
            queueSnapshot(row.copy(processedFileHash = processedHash?.trim()?.lowercase()))
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
            val row = evidenceDao.findById(evidenceId)
                ?: throw IllegalArgumentException("unknown evidence: $evidenceId")
            val custody = row.toChainOfCustody()
                ?: throw IllegalStateException("corrupt custody column for $evidenceId")

            val now = clock.millis()

            // Contract: never accept a timestamp older than the chain head —
            // a backwards-set device clock would make the chain's narrative
            // contradict its hash order.
            val head = custody.events.lastOrNull()
            if (head != null && now < head.timestampEpochMillis) {
                throw IllegalStateException("chain timestamp regression for $evidenceId")
            }

            // Every link re-binds the SAME original-file hash — an event is
            // only valid as part of the chain of one specific evidence item.
            val event = ChainEventHasher.create(
                action = action,
                timestampEpochMillis = now,
                previousHash = head?.currentHash,
                contentHash = row.originalFileHash,
            )

            val updated = row.copy(
                chainOfCustodyJson = ChainOfCustody.encode(
                    custody.copy(events = custody.events + event),
                ),
            )
            evidenceDao.updateChainOfCustody(row.id, updated.chainOfCustodyJson)
            queueSnapshot(updated)
            event
        }
    }

    override suspend fun verifyChain(
        evidenceId: String,
    ): Result<EvidenceRepository.ChainVerification> {
        if (evidenceId.isBlank()) {
            return Result.Error(AppError.Validation("معرّف الدليل مطلوب"))
        }
        return runCatchingResult {
            val row = evidenceDao.findById(evidenceId)
                ?: throw IllegalArgumentException("unknown evidence: $evidenceId")

            val custody = row.toChainOfCustody()
            if (custody == null) {
                // A custody column that cannot even decode IS a verification
                // failure — it is never silently reset or repaired.
                return@runCatchingResult EvidenceRepository.ChainVerification(
                    evidenceId = evidenceId,
                    valid = false,
                    inspectedEvents = 0,
                    brokenAtIndex = 0,
                )
            }

            var previousHash: String? = null
            var brokenAt: Int? = null

            for ((index, event) in custody.events.withIndex()) {
                val rebuilt = ChainEventHasher.create(
                    action = event.action,
                    timestampEpochMillis = event.timestampEpochMillis,
                    previousHash = previousHash,
                    contentHash = row.originalFileHash,
                )
                val prevOk = event.previousHash == previousHash
                val linkOk = event.currentHash == rebuilt.currentHash
                if (!prevOk || !linkOk) {
                    brokenAt = index
                    break
                }
                previousHash = event.currentHash
            }

            EvidenceRepository.ChainVerification(
                evidenceId = evidenceId,
                valid = brokenAt == null,
                inspectedEvents = custody.events.size,
                brokenAtIndex = brokenAt,
            )
        }
    }

    // ------------------------------------------------- content-addressed fs

    /** `evidence/<sha256>.<ext>` — derived from the digest, never caller-supplied. */
    private fun contentAddressedPath(hash: String, mimeType: String): String {
        val ext = mimeType.substringAfter('/', "")
            .filter { it.isLetterOrDigit() }
            .take(12)
        val fileName = if (ext.isEmpty()) hash else "$hash.$ext"
        return "evidence/$fileName"
    }

    /** Persists the bytes under their content address (parent dirs created). */
    private fun storeContent(relativePath: String, content: ByteArray) {
        val file = File(context.filesDir, relativePath)
        file.parentFile?.mkdirs()
        file.writeBytes(content)
    }

    // ------------------------------------------------------- sync queueing

    /**
     * Evidence syncs as a full-row snapshot keyed by evidence id: re-sending
     * an entire row is idempotent remotely, and the embedded custody JSON
     * carries the full hash-linked chain — the backend can independently
     * re-verify every link it receives.
     */
    private suspend fun queueSnapshot(row: EvidenceEntity) {
        val payload = SyncPayloads.snapshot(row)
        enqueueCommand(SyncCommand.Type.EVIDENCE_REGISTER, json.encodeToString(JsonObject.serializer(), payload))
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

    // ------------------------------------------------------------- mapping

    private fun EvidenceEntity.toChainOfCustody(): ChainOfCustody? =
        ChainOfCustody.decode(chainOfCustodyJson)

    private fun EvidenceEntity.toChain(): List<ChainEvent> =
        toChainOfCustody()?.events.orEmpty()

    private fun EvidenceEntity.toSummary(): EvidenceRepository.EvidenceSummary {
        val events = toChain()
        return EvidenceRepository.EvidenceSummary(
            id = id,
            caseId = caseId,
            originalFileHash = originalFileHash,
            processedFileHash = processedFileHash,
            mimeType = mimeType,
            captureTimestamp = captureTimestamp,
            eventCount = events.size,
            chainHeadHash = events.lastOrNull()?.currentHash,
        )
    }

    private fun isValidHash(hex: String): Boolean =
        hex.length == 64 && hex.all { it in "0123456789abcdef" }

    /** Payload shape for [SyncCommand.Type.EVIDENCE_REGISTER] snapshots. */
    private object SyncPayloads {
        fun snapshot(row: EvidenceEntity): JsonObject = buildJsonObject {
            put("evidenceId", row.id)
            put("caseId", row.caseId)
            put("originalFileHash", row.originalFileHash)
            put("processedFileHash", row.processedFileHash)
            put("mimeType", row.mimeType)
            put("captureTimestamp", row.captureTimestamp)
            put("chainOfCustody", row.chainOfCustodyJson)
            put("immutableRelativePath", row.immutableRelativePath)
        }
    }

    private companion object {
        const val DRAIN_WORK_NAME = "haris-sync-command-drain"
    }
}
