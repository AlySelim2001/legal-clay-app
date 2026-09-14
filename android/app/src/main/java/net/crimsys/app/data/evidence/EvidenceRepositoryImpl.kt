package net.crimsys.app.data.evidence

import android.content.Context
import android.webkit.MimeTypeMap
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
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import net.crimsys.app.core.Resource
import net.crimsys.app.core.evidence.ChainEventHasher
import net.crimsys.app.core.evidence.Sha256
import net.crimsys.app.data.local.EvidenceDao
import net.crimsys.app.data.local.EvidenceEntity
import net.crimsys.app.data.local.SyncCommandDao
import net.crimsys.app.data.local.SyncCommandEntity
import net.crimsys.app.data.sync.SyncWorker
import net.crimsys.app.domain.evidence.ChainAction
import net.crimsys.app.domain.evidence.ChainOfCustody
import net.crimsys.app.domain.evidence.EvidenceRepository
import net.crimsys.app.domain.sync.SyncCommand

/**
 * Evidence capture store. Room is the single source of truth; every capture
 * is persisted locally first, then queued as a [SyncCommand] drained by
 * [SyncWorker] (offline-first — a push failure never loses evidence).
 *
 * Integrity invariants enforced here (the caller cannot bypass them):
 *  - the original-file digest is computed HERE via [Sha256.digest] streaming
 *    over the captured file — callers hand over a file, never a hash;
 *  - the file is copied to its CONTENT-ADDRESSED path
 *    (`evidence/<sha256>.<ext>`), so file identity == custody identity and
 *    capture is idempotent on bytes;
 *  - the genesis CAPTURED [net.crimsys.app.domain.evidence.ChainEvent] is
 *    built by [ChainEventHasher.create] and stored embedded in
 *    `chainOfCustodyJson`;
 *  - failures surface as [Resource.Error], never a crash.
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

    override fun captureAndSecureEvidence(
        file: File,
        caseId: UUID,
    ): Flow<Resource<EvidenceEntity>> = flow {
        emit(Resource.Loading)

        if (!file.exists() || !file.isFile || !file.canRead()) {
            emit(Resource.Error("الملف غير موجود أو غير قابل للقراءة"))
            return@flow
        }
        if (file.length() == 0L) {
            emit(Resource.Error("محتوى الدليل مطلوب لحساب البصمة"))
            return@flow
        }

        // The content digest is computed by the store, never the caller —
        // streaming over the file in constant memory (large recordings OK).
        val contentHash = file.inputStream().use(Sha256::digest)
        if (!isValidHash(contentHash)) {
            throw IllegalStateException("content digest rejected: malformed SHA-256")
        }

        // Idempotent on bytes: the UNIQUE index on originalFileHash makes a
        // second row for the same content structurally impossible, so a probe
        // hit IS the successful outcome — the existing row is returned as-is.
        val existing = evidenceDao.findByOriginalHash(contentHash)
        if (existing != null) {
            emit(Resource.Success(existing))
            return@flow
        }

        // Content-addressed immutable storage: file identity == digest.
        val relativePath = contentAddressedPath(contentHash, file.extension)
        storeContent(relativePath, file)

        val now = clock.millis()
        val genesis = ChainEventHasher.create(
            action = ChainAction.CAPTURED,
            timestampEpochMillis = now,
            previousHash = null,
            contentHash = contentHash,
        )
        val entity = EvidenceEntity(
            id = UUID.randomUUID().toString(),
            caseId = caseId.toString(),
            originalFileHash = contentHash,
            processedFileHash = null,
            mimeType = resolveMimeType(file),
            captureTimestamp = now,
            chainOfCustodyJson = ChainOfCustody.encode(
                ChainOfCustody(events = listOf(genesis)),
            ),
            immutableRelativePath = relativePath,
        )

        evidenceDao.insert(entity)
        queueSnapshot(entity)
        emit(Resource.Success(entity))
    }.catch { t ->
        if (t is CancellationException) throw t
        emit(Resource.Error("فشل تأمين الدليل", t))
    }.flowOn(Dispatchers.IO)

    // ------------------------------------------------- content-addressed fs

    /** `evidence/<sha256>.<ext>` — derived from the digest, never caller-supplied. */
    private fun contentAddressedPath(hash: String, extension: String): String {
        val ext = extension.trim().lowercase()
            .filter { it.isLetterOrDigit() }
            .take(12)
        val fileName = if (ext.isEmpty()) hash else "$hash.$ext"
        return "evidence/$fileName"
    }

    /** Copies the captured file under its content address (parent dirs created). */
    private fun storeContent(relativePath: String, source: File) {
        val destination = File(context.filesDir, relativePath)
        destination.parentFile?.mkdirs()
        source.copyTo(destination, overwrite = true)
    }

    /** Best-effort MIME type from the file extension. */
    private fun resolveMimeType(file: File): String {
        val ext = file.extension.trim().lowercase()
        return MimeTypeMap.getSingleton()
            .getMimeTypeFromExtension(ext)
            ?: "application/octet-stream"
    }

    private fun isValidHash(hex: String): Boolean =
        hex.length == 64 && hex.all { it in "0123456789abcdef" }

    // ------------------------------------------------------- sync queueing

    /**
     * Evidence syncs as a full-row snapshot keyed by evidence id: re-sending
     * an entire row is idempotent remotely, and the embedded custody JSON
     * carries the hash-linked chain — the backend can independently
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
