package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Transaction
import kotlinx.coroutines.flow.Flow

/**
 * Storage row for one chain-of-custody event.
 *
 * The domain [net.crimsys.app.domain.evidence.ChainEvent] carries a nullable
 * `previousHash` (null = genesis); persistence keeps the canonical 64-zero
 * representation in [previousEventHash] so the hash-linked columns stay
 * NOT NULL — Room schema validation and the verification walk both prefer a
 * constant sentinel over tri-state storage.
 */
@Entity(
    tableName = "evidence_chain_events",
    indices = [Index(value = ["evidenceId"])],
)
data class EvidenceChainEventEntity(
    @PrimaryKey val id: String,
    val evidenceId: String,
    /** Semantic action — [net.crimsys.app.domain.evidence.ChainAction] name (closed vocabulary). */
    val action: String,
    val occurredAtEpochMs: Long,
    val eventHash: String,
    val previousEventHash: String,
)

/**
 * Evidence store. The critical operations are the two @Transaction methods:
 * the chain can never exist in a half-appended state — an evidence row and
 * its capture event are written together, and a new head + event land in one
 * commit.
 */
@Dao
interface EvidenceDao {

    // ------------------------------------------------------------- evidence

    @Query("SELECT * FROM evidence_items ORDER BY capturedAtEpochMs DESC")
    fun observeEvidence(): Flow<List<EvidenceEntity>>

    @Query("SELECT * FROM evidence_items WHERE id = :evidenceId LIMIT 1")
    suspend fun findEvidence(evidenceId: String): EvidenceEntity?

    /**
     * Registers the item AND its first chain event atomically. Uses REPLACE
     * on the item (id is caller-minted UUID) and plain INSERT on the event
     * (fresh primary key; a duplicate event hash means a caller bug and
     * should fail loudly).
     */
    @Transaction
    suspend fun insertEvidenceWithEvent(evidence: EvidenceEntity, event: EvidenceChainEventEntity) {
        insertEvidence(evidence)
        insertChainEvent(event)
    }

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEvidence(evidence: EvidenceEntity)

    // ---------------------------------------------------------------- chain

    /** Append-ordered chain (insertion order == hash-link order). */
    @Query("SELECT * FROM evidence_chain_events WHERE evidenceId = :evidenceId ORDER BY rowid ASC")
    fun observeChain(evidenceId: String): Flow<List<EvidenceChainEventEntity>>

    @Query("SELECT * FROM evidence_chain_events WHERE evidenceId = :evidenceId ORDER BY rowid DESC LIMIT 1")
    suspend fun findChainHead(evidenceId: String): EvidenceChainEventEntity?

    @Query("SELECT * FROM evidence_chain_events WHERE evidenceId = :evidenceId ORDER BY rowid ASC")
    suspend fun chainInOrder(evidenceId: String): List<EvidenceChainEventEntity>

    /**
     * Atomic head swap: the new event, the item's `chainHeadHash`, and the
     * event counter all commit together. If the process died between the
     * event insert and the head update without this wrapper, the head
     * pointer would trail the actual chain — the verification walk would
     * then "fail" on healthy evidence.
     */
    @Transaction
    suspend fun appendChainEvent(event: EvidenceChainEventEntity, evidenceId: String) {
        insertChainEvent(event)
        updateChainHead(evidenceId, event.eventHash, System.currentTimeMillis())
    }

    @Insert
    suspend fun insertChainEvent(event: EvidenceChainEventEntity)

    @Query(
        "UPDATE evidence_items SET chainHeadHash = :headHash, " +
            "eventCount = eventCount + 1, updatedAt = :updatedAt WHERE id = :evidenceId",
    )
    suspend fun updateChainHead(evidenceId: String, headHash: String, updatedAt: Long)

    /** Marks the evidence row pushed; called after a successful sync. */
    @Query("UPDATE evidence_items SET isSynced = :synced, updatedAt = :updatedAt WHERE id = :evidenceId")
    suspend fun setEvidenceSynced(evidenceId: String, synced: Boolean, updatedAt: Long)
}
