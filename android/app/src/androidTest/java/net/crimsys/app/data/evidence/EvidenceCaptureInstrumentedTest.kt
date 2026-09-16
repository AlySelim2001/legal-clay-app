package net.crimsys.app.data.evidence

import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.UUID
import kotlinx.coroutines.flow.filterNot
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import net.crimsys.app.core.Resource
import net.crimsys.app.core.evidence.EvidenceIntegrityVerifier
import net.crimsys.app.core.evidence.Sha256
import net.crimsys.app.data.local.CrimSysDatabase
import net.crimsys.app.data.local.EvidenceEntity
import net.crimsys.app.domain.evidence.ChainAction
import net.crimsys.app.domain.evidence.ChainEvent
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Evidence capture instrumentation test (RELEASE_CHECKLIST.md §3.1 stage 2).
 *
 * Requires a real device/emulator — the pipeline under test is
 * [EvidenceRepositoryImpl.captureAndSecureEvidence] through the FULL critical
 * path: fused hash+copy off the real filesystem → fsync → read-only flag →
 * rename into `evidence/immutable/` → Room insert → genesis CAPTURED event.
 * None of that is simulatable on the JVM (filesDir + Room + file locks).
 *
 * The in-memory Room instance uses the plain framework SQLite factory —
 * deliberately NOT the production SQLCipher factory. The encryption layer is
 * orthogonal to the custody contract under test, and the test APK does not
 * package the SQLCipher JNI library (`System.loadLibrary("sqlcipher")` in
 * AppModule would UnsatisfiedLinkError here).
 *
 * `sha256("hello")` is pinned to the project's own audited vector
 * (`Sha256Test`) so the capture pipeline and the hashing primitive prove the
 * same constant — byte parity between the two layers.
 *
 * Hygiene: [tearDown] wipes `filesDir/evidence` after EVERY test, so each
 * test starts from a clean store — the "no side effects" assertions rely on
 * that (JUnit4 runs @Before/@After around each method).
 */
@RunWith(AndroidJUnit4::class)
class EvidenceCaptureInstrumentedTest {

    private val context =
        InstrumentationRegistry.getInstrumentation().targetContext

    private lateinit var db: CrimSysDatabase
    private lateinit var repository: EvidenceRepositoryImpl

    private val caseId: UUID = UUID.randomUUID()

    private val json = Json

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(
            context,
            CrimSysDatabase::class.java,
        )
            .allowMainThreadQueries()
            .build()
        repository = EvidenceRepositoryImpl(
            context = context,
            evidenceDao = db.evidenceDao(),
        )
    }

    @After
    fun tearDown() {
        db.close()
        // Remove any artifacts the suite secured (test hygiene only; each
        // test also asserts on its own files before this runs).
        context.filesDir.resolve("evidence").deleteRecursively()
    }

    // ── helpers ──────────────────────────────────────────────────────────

    /** A readable source file in the test app's cache dir. */
    private fun sourceFile(
        name: String,
        bytes: ByteArray,
    ): File =
        File(context.cacheDir, name).apply {
            writeBytes(bytes)
            deleteOnExit()
        }

    private suspend fun capture(
        file: File,
    ): Resource<EvidenceEntity> =
        repository
            .captureAndSecureEvidence(file, caseId)
            .filterNot { it is Resource.Loading }
            .first()

    private fun immutableDir(): File =
        File(context.filesDir, "evidence/immutable")

    private fun decodeChain(chainOfCustodyJson: String): List<ChainEvent> =
        json.decodeFromString(
            ListSerializer(ChainEvent.serializer()),
            chainOfCustodyJson,
        )

    // ── the happy path: the full custody chain, end to end ───────────────

    @Test
    fun capture_securesFile_hashesIt_andOpensTheCustodyChain(): Unit =
        runBlocking {
            val bytes = "hello".toByteArray(Charsets.UTF_8)
            val source = sourceFile("capture-src.txt", bytes)

            val outcome = capture(source)

            val evidence = (outcome as Resource.Success<EvidenceEntity>).data

            // ── Hash: fused during the copy, matches the audited vector ──
            assertEquals(
                "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
                evidence.originalFileHash,
            )

            // ── Immutable copy: exists on disk, byte-identical, read-only ──
            val stored =
                File(context.filesDir, evidence.immutableRelativePath)
            assertTrue("immutable copy must exist", stored.exists())
            assertTrue(
                "stored bytes must equal the source bytes",
                stored.readBytes().contentEquals(bytes),
            )
            assertFalse("immutable copy must be read-only", stored.canWrite())

            // ── Row: linkage + metadata shape ──
            assertEquals(caseId.toString(), evidence.caseId)
            assertEquals("text/plain", evidence.mimeType)
            assertTrue(evidence.captureTimestamp > 0)
            assertNull(evidence.processedFileHash)
            assertTrue(evidence.immutableRelativePath.startsWith("evidence/immutable/"))

            // ── Chain of custody: genesis CAPTURED, anchored, valid ──
            val chain = decodeChain(evidence.chainOfCustodyJson)
            assertEquals(1, chain.size)
            assertEquals(ChainAction.CAPTURED, chain.single().action)
            assertNull(chain.single().previousHash)
            assertEquals(
                EvidenceIntegrityVerifier.ChainVerdict.Valid,
                EvidenceIntegrityVerifier.replayChain(
                    evidence.chainOfCustodyJson,
                    evidence.originalFileHash,
                ),
            )

            // ── Row is actually persisted (single source of truth) ──
            assertNotNull(db.evidenceDao().findById(evidence.id))
        }

    @Test
    fun capture_hashIsDeterministic_forIdenticalContent(): Unit =
        runBlocking {
            val bytes = "عهدة ثابتة".toByteArray(Charsets.UTF_8)

            val captured =
                capture(sourceFile("det-a.bin", bytes)) as Resource.Success<EvidenceEntity>

            // Same bytes → same content hash, independent of the UUID-addressed
            // storage path. (A second capture of identical bytes is refused by
            // UNIQUE(originalFileHash) — covered in the duplicate test below —
            // so determinism is proven by re-deriving, not re-capturing.)
            val recomputed =
                sourceFile("det-b.bin", bytes).inputStream().use { Sha256.digest(it) }

            assertEquals(
                recomputed,
                captured.data.originalFileHash,
            )
        }

    // ── failure paths: clean failure, no partial artifacts ───────────────

    @Test
    fun capture_unreadableSource_failsCleanly_withNoSideEffects(): Unit =
        runBlocking {
            val missing = File(context.cacheDir, "does-not-exist.bin")

            val outcome = capture(missing)

            assertTrue(outcome is Resource.Error)
            // Clean store (tearDown wipes it after every test): the early
            // guard must not have created storage or written anything.
            assertFalse(
                "no storage space may be created on early failure",
                immutableDir().exists(),
            )
            assertEquals(0, immutableDir().listFiles()?.size ?: 0)
        }

    @Test
    fun capture_duplicateContent_failsLoudly_andCleansCandidateFiles(): Unit =
        runBlocking {
            val bytes = "hello".toByteArray(Charsets.UTF_8)

            val first =
                capture(sourceFile("dup-a.txt", bytes)) as Resource.Success<EvidenceEntity>

            val before = immutableDir().listFiles()!!.size

            // UNIQUE(originalFileHash) — the dedup contract — must surface as
            // a loud Resource.Error, never a silent dedup, and the failed
            // attempt's candidate file must be cleaned up.
            val outcome =
                capture(sourceFile("dup-b.txt", bytes))

            assertTrue("duplicate capture must fail", outcome is Resource.Error)

            val after = immutableDir().listFiles()!!.size
            assertEquals(
                "failed duplicate must leave no file behind",
                before,
                after,
            )

            // The original capture is untouched and still verifies.
            val stored =
                File(context.filesDir, first.data.immutableRelativePath)
            assertTrue(stored.exists())
            assertEquals(
                EvidenceIntegrityVerifier.HashVerdict.Intact::class,
                EvidenceIntegrityVerifier.verifyHash(stored, first.data.originalFileHash)::class,
            )
        }

    // ── red-team smoke: tamper-and-compare on the real secured file ──────

    @Test
    fun capturedFile_tamperedOnDisk_isDetected_byReDerivation(): Unit =
        runBlocking {
            val secured =
                capture(sourceFile("tamper.txt", "سجل أصلي".toByteArray(Charsets.UTF_8)))
                    as Resource.Success<EvidenceEntity>

            // THE red-team scenario on the real filesystem: rewrite the
            // immutable copy, then compare with the stored hash.
            val stored =
                File(context.filesDir, secured.data.immutableRelativePath)
            stored.setWritable(true)
            stored.appendBytes("TAMPERED".toByteArray(Charsets.UTF_8))

            val verdict =
                EvidenceIntegrityVerifier.verifyHash(
                    stored,
                    secured.data.originalFileHash,
                )

            val tampered = verdict as EvidenceIntegrityVerifier.HashVerdict.Tampered
            assertEquals(secured.data.originalFileHash, tampered.stored)
            assertTrue(tampered.actual != tampered.stored)
        }

    // ── stage 2: OCR processing extends the same chain ────────────────────

    @Test
    fun ocrProcessing_stampsNewHash_andExtendsTheChainFromItsHead(): Unit =
        runBlocking {
            val secured =
                capture(sourceFile("ocr-src.txt", "مستند الدليل".toByteArray(Charsets.UTF_8)))
                    as Resource.Success<EvidenceEntity>

            val processedBytes = "نص مستخرج بالتعرف الضوئي".toByteArray(Charsets.UTF_8)
            val processed = sourceFile("ocr-out.txt", processedBytes)

            val outcome =
                repository
                    .recordOcrProcessing(secured.data.id, processed)
                    .filterNot { it is Resource.Loading }
                    .first()

            val updated = (outcome as Resource.Success<EvidenceEntity>).data

            // New hash stamped + bound into the extended chain.
            assertEquals(
                processed.inputStream().use { Sha256.digest(it) },
                updated.processedFileHash,
            )

            val processedArtifact =
                File(
                    context.filesDir,
                    "evidence/immutable/${updated.id}.ocr.txt",
                )
            assertTrue(processedArtifact.exists())
            assertTrue(
                processedArtifact.readBytes().contentEquals(processedBytes),
            )
            assertFalse("processed artifact must be read-only", processedArtifact.canWrite())

            // Chain: CAPTURED → OCR_PROCESSED, still anchored and valid.
            val chain = decodeChain(updated.chainOfCustodyJson)
            assertEquals(2, chain.size)
            assertEquals(ChainAction.OCR_PROCESSED, chain[1].action)
            assertEquals(
                chain[0].currentHash,
                chain[1].previousHash,
            )
            assertEquals(
                EvidenceIntegrityVerifier.ChainVerdict.Valid,
                EvidenceIntegrityVerifier.replayChain(
                    updated.chainOfCustodyJson,
                    updated.originalFileHash,
                ),
            )

            // One atomic UPDATE persisted both the stamp and the chain.
            val persisted = db.evidenceDao().findById(secured.data.id)!!
            assertEquals(updated.processedFileHash, persisted.processedFileHash)
            assertEquals(updated.chainOfCustodyJson, persisted.chainOfCustodyJson)
        }

    @Test
    fun ocrProcessing_secondDerivative_isRefused(): Unit =
        runBlocking {
            val secured =
                capture(sourceFile("once.txt", "أصل فريد".toByteArray(Charsets.UTF_8)))
                    as Resource.Success<EvidenceEntity>

            val first =
                repository
                    .recordOcrProcessing(
                        secured.data.id,
                        sourceFile("once-ocr.txt", "once".toByteArray()),
                    )
                    .filterNot { it is Resource.Loading }
                    .first()
            assertTrue(first is Resource.Success)

            val second =
                repository
                    .recordOcrProcessing(
                        secured.data.id,
                        sourceFile("twice-ocr.txt", "twice".toByteArray()),
                    )
                    .filterNot { it is Resource.Loading }
                    .first()

            assertTrue(
                "a second derivative must be refused",
                second is Resource.Error,
            )
        }
}
