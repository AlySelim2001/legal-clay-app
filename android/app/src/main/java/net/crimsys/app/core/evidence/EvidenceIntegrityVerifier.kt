package net.crimsys.app.core.evidence

import java.io.File
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import net.crimsys.app.domain.evidence.ChainAction
import net.crimsys.app.domain.evidence.ChainEvent

/**
 * Red-team verification surface for evidence immutability.
 *
 * `setReadOnly()` is defense-in-depth, NOT a criminal-grade guarantee: on a
 * rooted device the immutable copy can be modified or deleted. The evidence
 * is the COMBINATION — original hash + chain of custody + encrypted metadata
 * — and this verifier re-derives truth from the bytes actually on disk and
 * the stored custody metadata, so tampering is DETECTED rather than assumed
 * impossible.
 *
 * Honest scope: [verifyHash] proves the bytes match the stored hash.
 * [replayChain] proves the custody metadata is internally consistent and
 * anchored to the original content hash. Neither proves anything against an
 * attacker who can rewrite BOTH the file and the local DB — that class is
 * covered by the remote copy (append-only, owner-scoped command log under
 * `android/firestore.rules`) and future attestation, not by client code.
 *
 * Production use: call [verifyHash] before any evidence is exported or
 * pushed, and [replayChain] when displaying or relying on custody history.
 * (No production caller yet — wired with the first evidence-consuming flow.)
 */
object EvidenceIntegrityVerifier {

    private val json = Json { ignoreUnknownKeys = true }

    sealed interface HashVerdict {

        /** Recomputed hash equals the stored hash — bytes are as captured. */
        data class Intact(
            val hash: String,
        ) : HashVerdict

        /** File exists but its bytes no longer hash to the stored value. */
        data class Tampered(
            val stored: String,
            val actual: String,
        ) : HashVerdict

        /** The immutable copy is gone — treated as tampering, not loss. */
        data class Missing(
            val path: String,
        ) : HashVerdict

        /** The file exists but cannot be read or hashed. */
        data class Unreadable(
            val path: String,
            val cause: String,
        ) : HashVerdict
    }

    sealed interface ChainVerdict {

        /** Custody metadata is decodable, well-formed, linked, and anchored. */
        data object Valid : ChainVerdict

        data class InvalidGenesis(
            val reason: String,
        ) : ChainVerdict

        /** Event at [index] does not link to its predecessor. */
        data class BrokenLink(
            val index: Int,
            val reason: String,
        ) : ChainVerdict

        /** The custody JSON itself is corrupt or was tampered with. */
        data class Corrupt(
            val cause: String,
        ) : ChainVerdict
    }

    /**
     * Re-derives the hash of [file]'s current bytes and compares it with
     * [storedHash]. Comparison is case-insensitive (both sides are hex).
     */
    fun verifyHash(
        file: File,
        storedHash: String,
    ): HashVerdict {
        if (!file.exists()) return HashVerdict.Missing(file.path)
        if (!file.canRead()) {
            return HashVerdict.Unreadable(
                file.path,
                "file exists but is not readable",
            )
        }

        val actual = try {
            file.inputStream().use { Sha256.digest(it) }
        } catch (t: Throwable) {
            return HashVerdict.Unreadable(
                file.path,
                t.message ?: t.javaClass.simpleName,
            )
        }

        return if (actual.equals(storedHash, ignoreCase = true)) {
            HashVerdict.Intact(actual)
        } else {
            HashVerdict.Tampered(
                stored = storedHash,
                actual = actual,
            )
        }
    }

    /**
     * Replays a stored chain-of-custody JSON and checks:
     *
     *  1. Decodability — the metadata was not mangled or replaced.
     *  2. Genesis shape — first event is CAPTURED with no previous hash.
     *  3. Genesis anchor — the genesis event's `currentHash` recomputes
     *     exactly from the canonical string bound to [originalFileHash].
     *     Swapping the stored original hash, the content, or the genesis
     *     event breaks this.
     *  4. Linkage — every later event's `previousHash` equals the prior
     *     event's `currentHash`; reorder, drop, or fork a link and it breaks.
     *
     * Timestamps are deliberately NOT checked for monotonicity: the hasher
     * makes no such guarantee, and the verifier does not invent one.
     */
    fun replayChain(
        chainOfCustodyJson: String,
        originalFileHash: String,
    ): ChainVerdict {
        val events = try {
            json.decodeFromString(
                ListSerializer(ChainEvent.serializer()),
                chainOfCustodyJson,
            )
        } catch (t: Throwable) {
            return ChainVerdict.Corrupt(
                t.message ?: t.javaClass.simpleName,
            )
        }

        val genesis = events.firstOrNull()
            ?: return ChainVerdict.InvalidGenesis("empty custody chain")

        if (genesis.action != ChainAction.CAPTURED) {
            return ChainVerdict.InvalidGenesis(
                "first event is ${genesis.action}, expected CAPTURED",
            )
        }

        if (genesis.previousHash != null) {
            return ChainVerdict.InvalidGenesis(
                "genesis event carries a previousHash",
            )
        }

        val genesisCanonical =
            "${ChainAction.CAPTURED.name}|" +
                "${genesis.timestampEpochMillis}|" +
                "|" +
                originalFileHash

        val recomputedGenesis = try {
            sha256Hex(genesisCanonical)
        } catch (t: Throwable) {
            return ChainVerdict.Corrupt(
                "genesis recompute failed: ${t.message}",
            )
        }

        if (!recomputedGenesis.equals(genesis.currentHash, ignoreCase = true)) {
            return ChainVerdict.InvalidGenesis(
                "genesis hash does not bind the stored original file hash",
            )
        }

        for (i in 1 until events.size) {
            val previous = events[i - 1]
            val current = events[i]

            val expectedPrevious = previous.currentHash
            val actualPrevious = current.previousHash

            if (actualPrevious == null ||
                !actualPrevious.equals(expectedPrevious, ignoreCase = true)
            ) {
                return ChainVerdict.BrokenLink(
                    index = i,
                    reason = "previousHash does not match prior event hash",
                )
            }
        }

        return ChainVerdict.Valid
    }

    private fun sha256Hex(
        value: String,
    ): String = java.security.MessageDigest
        .getInstance("SHA-256")
        .digest(value.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
}
