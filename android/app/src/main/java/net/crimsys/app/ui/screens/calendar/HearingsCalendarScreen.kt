package net.crimsys.app.ui.screens.calendar

import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.kizitonwose.calendar.compose.HorizontalCalendar
import com.kizitonwose.calendar.compose.rememberCalendarState
import com.kizitonwose.calendar.core.CalendarDay
import com.kizitonwose.calendar.core.CalendarMonth
import com.kizitonwose.calendar.core.OutDateStyle
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale
import net.crimsys.app.R
import net.crimsys.app.data.local.HearingEntity
import net.crimsys.app.ui.components.ClayCard
import net.crimsys.app.ui.components.clayInset
import net.crimsys.app.ui.components.claySurface
import net.crimsys.app.ui.theme.ClayPrimary
import net.crimsys.app.ui.theme.UrgencyHigh

/**
 * P1: single source for date-related formatting. Resolves the EFFECTIVE
 * per-app locale (in-app override → OS default) instead of hardcoding
 * `Locale("ar")` at every call site, so an English-preferring user gets
 * correctly localized month/weekday names and digits without any branch.
 */
@Composable
internal fun rememberAppLocale(): Locale {
    val perApp = AppCompatDelegate.getApplicationLocales()[0]
    val configuration = LocalConfiguration.current
    return remember(perApp, configuration) {
        perApp ?: configuration.locales[0]
    }
}

@Composable
fun HearingsCalendarScreen(
    viewModel: HearingsCalendarViewModel = hiltViewModel(),
) {
    val today = viewModel.today
    val selectedDay by viewModel.selectedDay.collectAsState()
    val hearingDays by viewModel.hearingDays.collectAsState()
    val dayHearings by viewModel.dayHearings.collectAsState()

    val appLocale = rememberAppLocale()

    val calendarState = rememberCalendarState(
        startMonth = today.minusMonths(12),
        endMonth = today.plusMonths(12),
        firstVisibleMonth = YearMonth.now(),
        firstDayOfWeek = DayOfWeek.SATURDAY, // Egyptian weekend convention
        outDateStyle = OutDateStyle.EndOfGrid,
    )

    Column(
        Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
    ) {
        Text(
            stringResource(R.string.calendar_title),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(vertical = 12.dp),
        )

        ClayCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(14.dp)) {
                HorizontalCalendar(
                    state = calendarState,
                    dayContent = { day ->
                        DayCell(
                            day = day,
                            today = today,
                            selectedDay = selectedDay,
                            hasHearing = hearingDays.contains(day.date.toEpochDay()),
                            onClick = { viewModel.selectDay(day.date) },
                        )
                    },
                    monthHeader = { month ->
                        MonthHeader(
                            month = month,
                            firstDayOfWeek = DayOfWeek.SATURDAY,
                            appLocale = appLocale,
                        )
                    },
                )
            }
        }

        Spacer(Modifier.height(16.dp))
        Text(
            text = selectedDay.dateLabel(appLocale),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(bottom = 8.dp),
        )

        if (dayHearings.isEmpty()) {
            Text(
                stringResource(R.string.calendar_no_hearings),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(vertical = 24.dp),
            )
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(dayHearings, key = { it.id }) { hearing ->
                    HearingCard(hearing)
                }
                item { Spacer(Modifier.height(24.dp)) }
            }
        }
    }
}

/** Locale-aware long date, e.g. "الأربعاء 14 يناير 2026". */
private fun LocalDate.dateLabel(locale: Locale): String =
    "${dayOfWeek.getDisplayName(TextStyle.FULL, locale)} $dayOfMonth ${
        month.getDisplayName(TextStyle.FULL, locale)
    } $year"

@Composable
private fun MonthHeader(
    month: CalendarMonth,
    firstDayOfWeek: DayOfWeek,
    appLocale: Locale,
) {
    val daysOfWeek = remember(firstDayOfWeek) {
        DayOfWeek.entries.sortedBy { if (it.value < firstDayOfWeek.value) it.value + 7 else it.value }
    }
    Column {
        Text(
            text = "${month.yearMonth.month.getDisplayName(TextStyle.FULL, appLocale)} ${month.yearMonth.year}",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(bottom = 8.dp),
        )
        Row(Modifier.fillMaxWidth()) {
            daysOfWeek.forEach { dow ->
                Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Text(
                        dow.getDisplayName(TextStyle.NARROW, appLocale),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        Spacer(Modifier.height(4.dp))
    }
}

@Composable
private fun DayCell(
    day: CalendarDay,
    today: LocalDate,
    selectedDay: LocalDate,
    hasHearing: Boolean,
    onClick: () -> Unit,
) {
    val isToday = day.date == today
    val isSelected = day.date == selectedDay
    val bg =
        when {
            isSelected -> ClayPrimary
            isToday -> MaterialTheme.colorScheme.primaryContainer
            else -> androidx.compose.ui.graphics.Color.Transparent
        }
    val textColor =
        when {
            isSelected -> MaterialTheme.colorScheme.onPrimary
            isToday -> MaterialTheme.colorScheme.onPrimaryContainer
            else -> MaterialTheme.colorScheme.onSurface
        }

    Box(
        Modifier
            .padding(2.dp)
            .fillMaxWidth()
            .height(38.dp)
            .background(bg, CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            day.date.dayOfMonth.toString(),
            style = MaterialTheme.typography.bodyMedium,
            color = textColor,
        )
        if (hasHearing) {
            Box(
                Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 3.dp)
                    .size(5.dp)
                    .background(UrgencyHigh, CircleShape),
            )
        }
    }
}

@Composable
private fun HearingCard(hearing: HearingEntity) {
    ClayCard(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(40.dp)
                    .background(ClayPrimary, RoundedCornerShape(12.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.AccountBalance,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimary,
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(hearing.caseNumber, style = MaterialTheme.typography.titleMedium)
                Text(
                    hearing.courtName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Text(
                hearing.timeLabel,
                style = MaterialTheme.typography.labelLarge,
                color = ClayPrimary,
                modifier = Modifier.clayInset(RoundedCornerShape(10.dp)).padding(6.dp),
            )
        }
    }
}
