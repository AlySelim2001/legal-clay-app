package net.crimsys.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * A court hearing (جلسة). Dates are stored as java.time epoch-day so the
 * kizitonwose calendar can map them to [java.time.LocalDate] cheaply.
 */
@Entity(tableName = "hearings")
data class HearingEntity(
    @PrimaryKey val id: String,
    val caseId: String,
    val caseNumber: String,
    val courtName: String,
    val epochDay: Long,
    /** Display label like "09:30" — kept free-form for Arabic court formats. */
    val timeLabel: String = "",
    val notes: String = "",
)
