package net.crimsys.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface HearingDao {

    @Query("SELECT * FROM hearings WHERE epochDay = :epochDay ORDER BY timeLabel ASC")
    fun observeHearingsForDay(epochDay: Long): Flow<List<HearingEntity>>

    /** Distinct days that carry at least one hearing — drives calendar dots. */
    @Query("SELECT DISTINCT epochDay FROM hearings WHERE epochDay >= :fromEpochDay")
    fun observeHearingDays(fromEpochDay: Long): Flow<List<Long>>

    @Query("SELECT * FROM hearings WHERE epochDay >= :fromEpochDay ORDER BY epochDay ASC, timeLabel ASC")
    fun observeUpcoming(fromEpochDay: Long): Flow<List<HearingEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(hearing: HearingEntity)
}
