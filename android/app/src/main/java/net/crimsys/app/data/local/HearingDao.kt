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

    /**
     * P1: upcoming sessions scoped to ONE case, filtered and sorted by the
     * database (WHERE + ORDER BY), never in Kotlin memory. The old pattern
     * fetched every case's hearings and filtered with `.filter { it.caseId == id }`
     * on every emission — O(total hearings) per update, growing with the
     * practice's whole docket. This query does the same work in SQLite via
     * the (caseId) index scan. Named to pair with [observeHearingsForDay].
     */
    @Query(
        "SELECT * FROM hearings WHERE caseId = :caseId AND epochDay >= :fromEpochDay " +
            "ORDER BY epochDay ASC, timeLabel ASC",
    )
    fun observeHearingsForCase(caseId: String, fromEpochDay: Long): Flow<List<HearingEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(hearing: HearingEntity)
}
