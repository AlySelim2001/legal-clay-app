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
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import net.crimsys.app.core.Resource
import net.crimsys.app.core.evidence.ChainEventHasher
import net.crimsys.app.data.local.EvidenceDao
import net.crimsys.app.data.local.EvidenceEntity
import net.crimsys.app.domain.evidence.ChainAction
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
}
