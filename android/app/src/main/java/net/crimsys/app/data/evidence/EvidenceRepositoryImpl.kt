package net.crimsys.app.data.evidence

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.URLConnection
import java.security.MessageDigest
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import net.crimsys.app.core.Resource
import net.crimsys.app.core.evidence.ChainEventHasher
import net.crimsys.app.data.local.EvidenceDao
import net.crimsys.app.data.local.EvidenceEntity
import net.crimsys.app.domain.evidence.ChainAction
import net.crimsys.app.domain.evidence.ChainEvent
import net.crimsys.app.domain.evidence.EvidenceRepository

/**
 * Capture pipeline — the diagram is the contract, enforced here stage by stage:
 *
 * ```
 * Incoming File
 *      │
 *      ├── SHA-256
 *      │
 *      ├── Atomic temporary copy
 *      │
 *      ├── fsync()
 *      │
 *      ├── read-only filesystem flag
 *      │
 *      └── immutable/
 *             │
 *             └── EvidenceEntity
 *                     │
 *                     └── ChainEvent
 * ```
 *
 * | Diagram stage | Code | On failure |
 * |---|---|---|
 * | Incoming File | [captureAndSecureEvidence] — `file.isFile && file.canRead()` guard | `Resource.Error`, no side effects yet |
 * | SHA-256 | `MessageDigest("SHA-256")`, updated in the read loop | caught → `Resource.Error`, temp deleted |
 * | Atomic temporary copy | write to `.<uuid>.<ext>.tmp` — fused with the hash pass | caught → `Resource.Error`, temp deleted |
 * | fsync() | `output.fd.sync()` after `bufferedOutput.flush()` | caught → `Resource.Error`, temp deleted |
 * | read-only filesystem flag | `tempFile.setReadOnly()` | `SecurityException` → cleanup → `Resource.Error` |
 * | immutable/ | `tempFile.renameTo(finalFile)` → `evidence/immutable/<uuid>.<ext>` | `IOException` → cleanup → `Resource.Error` |
 * | EvidenceEntity | full row built from the digest + path → `evidenceDao.insert` | caught → `Resource.Error`, files deleted |
 * | ChainEvent | genesis `ChainEventHasher.create(CAPTURED, ts, null, hash)` embedded as element 0 of `chainOfCustodyJson` | — |
 *
 * One implementation note the linear diagram hides: SHA-256 and the temporary
 * copy are FUSED into a single buffered pass, not two sequential stages. That
 * is strictly stronger — the hashed content and the stored content can never
 * drift apart (no TOCTOU window between a hash pass and a copy pass), and the
 * source file is read exactly once.
 *
 * Storage shape: the immutable path is UUID-addressed, and the UNIQUE index on
 * `originalFileHash` means identical bytes can never be registered twice — a
 * duplicate capture fails loudly at Room instead of silently deduplicating.
 * Persistence is Room-only (single source of truth); any failure after the
 * rename cleans up both candidate files before reporting `Resource.Error`.
 */
@Singleton
class EvidenceRepositoryImpl @Inject constructor(
    @ApplicationContext
    private val context: Context,

    private val evidenceDao: EvidenceDao,
) : EvidenceRepository {

    private val json =
        Json {
            encodeDefaults = true
        }

    override fun captureAndSecureEvidence(
        file: File,
        caseId: UUID,
    ): Flow<Resource<EvidenceEntity>> =
        flow {

            emit(Resource.Loading)

            if (!file.isFile || !file.canRead()) {
                emit(
                    Resource.Error(
                        "تعذر قراءة ملف الدليل من مصدره الأصلي.",
                    ),
                )
                return@flow
            }

            val immutableDir =
                File(
                    context.filesDir,
                    "evidence/immutable",
                )

            if (
                !immutableDir.exists() &&
                !immutableDir.mkdirs()
            ) {
                emit(
                    Resource.Error(
                        "تعذر إنشاء مساحة التخزين الآمنة للدليل.",
                    ),
                )
                return@flow
            }

            val evidenceId = UUID.randomUUID()

            val extension =
                file.extension
                    .lowercase()
                    .filter { it.isLetterOrDigit() }
                    .take(12)

            val finalName =
                if (extension.isBlank()) {
                    "$evidenceId.bin"
                } else {
                    "$evidenceId.$extension"
                }

            val finalFile =
                File(
                    immutableDir,
                    finalName,
                )

            val tempFile =
                File(
                    immutableDir,
                    ".$finalName.tmp",
                )

            try {

                val captureTimestamp =
                    System.currentTimeMillis()

                val digest =
                    MessageDigest.getInstance(
                        "SHA-256",
                    )

                FileInputStream(file).use { input ->

                    BufferedInputStream(input).use { bufferedInput ->

                        FileOutputStream(tempFile).use { output ->

                            BufferedOutputStream(output).use {
                                bufferedOutput ->

                                val buffer =
                                    ByteArray(64 * 1024)

                                while (true) {

                                    val read =
                                        bufferedInput.read(
                                            buffer,
                                        )

                                    if (read < 0) break

                                    if (read == 0) continue

                                    digest.update(
                                        buffer,
                                        0,
                                        read,
                                    )

                                    bufferedOutput.write(
                                        buffer,
                                        0,
                                        read,
                                    )
                                }

                                bufferedOutput.flush()

                                output.fd.sync()
                            }
                        }
                    }
                }

                val originalHash =
                    digest.digest()
                        .joinToString("") {
                            "%02x".format(it)
                        }

                if (!tempFile.setReadOnly()) {
                    throw SecurityException(
                        "Unable to mark evidence immutable.",
                    )
                }

                if (!tempFile.renameTo(finalFile)) {
                    throw java.io.IOException(
                        "Evidence finalization failed.",
                    )
                }

                val capturedEvent =
                    ChainEventHasher.create(
                        action = ChainAction.CAPTURED,
                        timestampEpochMillis =
                            captureTimestamp,
                        previousHash = null,
                        contentHash = originalHash,
                    )

                val entity =
                    EvidenceEntity(
                        id = evidenceId.toString(),
                        caseId = caseId.toString(),
                        originalFileHash = originalHash,
                        processedFileHash = null,
                        mimeType =
                            URLConnection
                                .guessContentTypeFromName(
                                    file.name,
                                )
                                ?: "application/octet-stream",
                        captureTimestamp =
                            captureTimestamp,
                        chainOfCustodyJson =
                            json.encodeToString(
                                listOf(capturedEvent),
                            ),
                        immutableRelativePath =
                            "evidence/immutable/$finalName",
                    )

                evidenceDao.insert(entity)

                emit(
                    Resource.Success(entity),
                )

            } catch (t: Throwable) {

                tempFile.delete()
                finalFile.delete()

                emit(
                    Resource.Error(
                        "تعذر تأمين الدليل وحفظ سلسلة حيازته.",
                        t,
                    ),
                )
            }
        }.flowOn(Dispatchers.IO)

    /**
     * Stage 2 — OCR processing. The diagram is the contract:
     *
     * ```
     * Original
     *    │
     *    └── OCR Processed
     *            │
     *            └── new hash
     * ```
     *
     * | Diagram stage | Code | On failure |
     * |---|---|---|
     * | Original | [evidenceDao.findById] — the already-secured original row | `Resource.Error`, nothing written |
     * | OCR Processed | fused SHA-256 + temp copy of the processed artifact → fsync → read-only → rename to `<id>.ocr.<ext>` | caught → `Resource.Error`, temp/final deleted |
     * | new hash | stamped into `processedFileHash` AND bound into the `OCR_PROCESSED` event — one atomic UPDATE | caught → `Resource.Error`, files deleted |
     *
     * Custody invariants (same discipline as capture):
     *  - the event links from the LIVE chain head (decoded from the row) and
     *    binds the NEW hash, not the original's — the chain records which
     *    content each action attests;
     *  - the custody JSON is decoded BEFORE any byte is written — corrupt
     *    custody blocks the append, it is never silently reset;
     *  - a processed timestamp older than the chain head is rejected (the
     *    chain's narrative must not contradict its order);
     *  - exactly one processed derivative per evidence item — a second call
     *    is refused rather than muddying the lineage;
     *  - the stamp and the extended chain land in ONE UPDATE
     *    ([EvidenceDao.updateProcessed]) — never half-committed.
     */
    override fun recordOcrProcessing(
        evidenceId: String,
        processedFile: File,
    ): Flow<Resource<EvidenceEntity>> =
        flow {

            emit(Resource.Loading)

            val original =
                evidenceDao.findById(evidenceId)

            if (original == null) {
                emit(
                    Resource.Error(
                        "لم يتم العثور على الدليل الأصلي.",
                    ),
                )
                return@flow
            }

            if (original.processedFileHash != null) {
                emit(
                    Resource.Error(
                        "تمت معالجة هذا الدليل مسبقًا.",
                    ),
                )
                return@flow
            }

            if (!processedFile.isFile || !processedFile.canRead()) {
                emit(
                    Resource.Error(
                        "تعذر قراءة ملف المعالجة من مصدره.",
                    ),
                )
                return@flow
            }

            val immutableDir =
                File(
                    context.filesDir,
                    "evidence/immutable",
                )

            if (
                !immutableDir.exists() &&
                !immutableDir.mkdirs()
            ) {
                emit(
                    Resource.Error(
                        "تعذر إنشاء مساحة التخزين الآمنة للدليل.",
                    ),
                )
                return@flow
            }

            val extension =
                processedFile.extension
                    .lowercase()
                    .filter { it.isLetterOrDigit() }
                    .take(12)

            val finalName =
                if (extension.isBlank()) {
                    "${original.id}.ocr.bin"
                } else {
                    "${original.id}.ocr.$extension"
                }

            val finalFile =
                File(
                    immutableDir,
                    finalName,
                )

            val tempFile =
                File(
                    immutableDir,
                    "." + finalName + ".tmp",
                )

            try {

                // Custody is decoded BEFORE any byte is written: a corrupt
                // chain blocks the append instead of discovering the problem
                // after the artifact is already on disk.
                val chain =
                    json.decodeFromString<List<ChainEvent>>(
                        original.chainOfCustodyJson,
                    )

                val head =
                    chain.lastOrNull()
                        ?: throw IllegalStateException(
                            "Empty custody chain.",
                        )

                val processedTimestamp =
                    System.currentTimeMillis()

                if (processedTimestamp < head.timestampEpochMillis) {
                    throw IllegalStateException(
                        "Chain timestamp regression.",
                    )
                }

                val digest =
                    MessageDigest.getInstance(
                        "SHA-256",
                    )

                FileInputStream(processedFile).use { input ->

                    BufferedInputStream(input).use { bufferedInput ->

                        FileOutputStream(tempFile).use { output ->

                            BufferedOutputStream(output).use {
                                bufferedOutput ->

                                val buffer =
                                    ByteArray(64 * 1024)

                                while (true) {

                                    val read =
                                        bufferedInput.read(
                                            buffer,
                                        )

                                    if (read < 0) break

                                    if (read == 0) continue

                                    digest.update(
                                        buffer,
                                        0,
                                        read,
                                    )

                                    bufferedOutput.write(
                                        buffer,
                                        0,
                                        read,
                                    )
                                }

                                bufferedOutput.flush()

                                output.fd.sync()
                            }
                        }
                    }
                }

                val processedHash =
                    digest.digest()
                        .joinToString("") {
                            "%02x".format(it)
                        }

                if (!tempFile.setReadOnly()) {
                    throw SecurityException(
                        "Unable to mark processed evidence immutable.",
                    )
                }

                if (!tempFile.renameTo(finalFile)) {
                    throw java.io.IOException(
                        "Processed evidence finalization failed.",
                    )
                }

                val processedEvent =
                    ChainEventHasher.create(
                        action = ChainAction.OCR_PROCESSED,
                        timestampEpochMillis =
                            processedTimestamp,
                        previousHash = head.currentHash,
                        contentHash = processedHash,
                    )

                val updatedChain = chain + processedEvent

                val updatedChainJson =
                    json.encodeToString(updatedChain)

                evidenceDao.updateProcessed(
                    id = original.id,
                    processedFileHash = processedHash,
                    chainOfCustodyJson = updatedChainJson,
                )

                emit(
                    Resource.Success(
                        original.copy(
                            processedFileHash = processedHash,
                            chainOfCustodyJson = updatedChainJson,
                        ),
                    ),
                )

            } catch (t: Throwable) {

                tempFile.delete()
                finalFile.delete()

                emit(
                    Resource.Error(
                        "تعذر توثيق المعالجة وحفظ بصمة الملف المعالج.",
                        t,
                    ),
                )
            }
        }.flowOn(Dispatchers.IO)
}
