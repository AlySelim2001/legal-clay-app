package net.crimsys.app.ui.screens.calendar

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.stateIn
import net.crimsys.app.data.local.HearingEntity
import net.crimsys.app.domain.usecase.GetHearingDaysUseCase
import net.crimsys.app.domain.usecase.GetHearingsForDayUseCase

/**
 * Calendar state: which day is selected (drives the day agenda list) and the
 * set of epoch days carrying at least one hearing (drives the dot indicators).
 */
@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class HearingsCalendarViewModel @Inject constructor(
    getHearingDays: GetHearingDaysUseCase,
    getHearingsForDay: GetHearingsForDayUseCase,
) : ViewModel() {

    val today: LocalDate = LocalDate.now()

    private val _selectedDay = MutableStateFlow(today)
    val selectedDay: StateFlow<LocalDate> = _selectedDay.asStateFlow()

    val hearingDays: StateFlow<Set<Long>> = getHearingDays(today.minusMonths(1)).stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = emptySet(),
    )

    val dayHearings: StateFlow<List<HearingEntity>> = _selectedDay
        .flatMapLatest { day -> getHearingsForDay(day) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = emptyList(),
        )

    fun selectDay(day: LocalDate) {
        _selectedDay.value = day
    }
}
