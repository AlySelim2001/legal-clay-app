package net.crimsys.app.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * One evidence item (photo, recording, document) with the head pointers of
 * its hash-linked chain of custody. Events themselves live in
 * `evidence_chain_events` ([EvidenceChainEventEntity]); denormalizing the
 * head here keeps the list screen to a single indexed read.
 *
 * Integrity model: [sha256Hex] is the content digest computed at capture.
 * [chainHeadHash] lets any reader spot a truncated or re-spliced chain
 * without walking every event — recompute-and-compare fails loudly.
 */
@Entity(
    tableName = "evidence_items",
    indices = [Index(value = ["sha256Hex"])],
)
data class EvidenceEntity(
    @PrimaryKey val id: String,
    /** Human label (Arabic-first). Never contains case-confidential detail. */
    val label: String,
    /** Lowercase SHA-256 hex of the evidence content. */
    val sha256Hex: String,
    /** Hash of the newest chain event (genesis when the chain is empty). */
    val chainHeadHash: String,
    /** Number of chain events — maintained by [EvidenceDao] on every append. */
    val eventCount: Int = 0,
    /** Storage key of the content blob, when the bytes live on-device. */
    val contentUri: String? = null,
    /** Firestore push state — flipped by the sync layer, never by the UI. */
    val isSynced: Boolean = false,
    /** Wall-clock capture time (display; NOT trusted for chain ordering). */
    val capturedAtEpochMs: Long = System.currentTimeMillis(),
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
)
