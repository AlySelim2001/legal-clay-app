package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface CaseDao {

    /** Single source of truth for the case list UI. */
    @Query("SELECT * FROM cases ORDER BY updatedAt DESC")
    fun observeCases(): Flow<List<CaseEntity>>

    @Query("SELECT * FROM cases WHERE id = :id")
    suspend fun getById(id: String): CaseEntity?

    @Upsert
    suspend fun upsert(case: CaseEntity)

    @Query("UPDATE cases SET isSynced = :synced, updatedAt = :updatedAt WHERE id = :id")
    suspend fun setSynced(id: String, synced: Boolean, updatedAt: Long = System.currentTimeMillis())

    @Query("UPDATE cases SET memoHtml = :html, isSynced = 0, updatedAt = :updatedAt WHERE id = :id")
    suspend fun updateMemo(id: String, html: String, updatedAt: Long = System.currentTimeMillis())

    @Query("SELECT * FROM cases WHERE isSynced = 0")
    suspend fun unsyncedCases(): List<CaseEntity>
}
