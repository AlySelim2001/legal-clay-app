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
