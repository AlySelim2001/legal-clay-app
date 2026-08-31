// ============================================================
// CRIM-SYS 2026 — Calendar Engine Module
// FullCalendar integration with Arabic locale (ar-EG) and RTL
// Pre-configured for Egyptian court hearing schedules
// ============================================================

import type { CalendarViewType } from "@/lib/open-source";
import type { ScheduleRow, CaseRow, ClientRow } from "@/types/database";

// Re-declare CalendarEvent locally to avoid circular imports
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  color?: string;
  extendedProps: {
    caseId: string;
    caseCode: string;
    caseNo: string;
    clientName: string;
    sessionType: string;
    requiredAction: string;
    courtName: string;
    urgency: "critical" | "high" | "normal";
  };
}

// ---- Arabic Locale Configuration ----

export const arabicLocale = {
  code: "ar-eg",
  week: "أسبوع",
  month: "شهر",
  year: "سنة",
  allDay: "اليوم كله",
  events: "أحداث",
  event: "حدث",
  noEvents: "لا أحداث",
  day: "يوم",
  weekNumber: "أسبوع {n}",
  dateFormat: "D M YYYY",
  timeFormat: "h:mm A",
  buttonText: {
    today: "اليوم",
    month: "شهر",
    week: "أسبوع",
    day: "يوم",
    list: "قائمة",
  },
  buttonHints: {
    month: "عرض الشهر",
    week: "عرض الأسبوع",
    day: "عرض اليوم",
    list: "عرض القائمة",
  },
  views: {
    dayGridMonth: {
      titleFormat: "MMMM YYYY",
      allDayText: "اليوم كله",
    },
    timeGridWeek: {
      titleFormat: "D MMMM YYYY",
      allDayText: "اليوم كله",
    },
    timeGridDay: {
      titleFormat: "D MMMM YYYY",
      allDayText: "اليوم كله",
    },
  },
  monthNames: [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ],
  monthNamesShort: [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ],
  dayNames: [
    "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
  ],
  dayNamesShort: [
    "أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت",
  ],
  firstDay: 6, // Saturday as first day of week (Egyptian convention)
};

// ---- Urgency Color Map ----

const urgencyColors: Record<string, string> = {
  critical: "#C0392B", // urgency-critical
  high: "#F1C40F",     // urgency-high
  normal: "#27AE60",   // urgency-normal
};

const sessionTypeColors: Record<string, string> = {
  "جلسة معارضة": "#6C5CE7",
  "جلسة استئناف": "#0984E3",
  "جلسة طعن بالنقض": "#C0392B",
  "جلسة عامة": "#00B894",
  " volunteered": "#636E72",
};

// ---- Event Factory ----

/**
 * Convert database schedule rows into FullCalendar events
 */
export function schedulesToEvents(
  schedules: ScheduleRow[],
  cases: CaseRow[],
  clients: ClientRow[]
): CalendarEvent[] {
  const caseMap = new Map<string, CaseRow>();
  cases.forEach((c) => caseMap.set(c.id, c));

  const clientMap = new Map<string, ClientRow>();
  clients.forEach((c) => clientMap.set(c.id, c));

  return schedules.map((s) => {
    const caseData = caseMap.get(s.case_id);
    const clientData = caseData ? clientMap.get(caseData.client_id) : null;

    return {
      id: s.id,
      title: `${s.session_type} — ${caseData?.case_no ?? "قضية"}`,
      start: s.session_date,
      end: s.session_date,
      allDay: true,
      color: sessionTypeColors[s.session_type] ?? "#636E72",
      extendedProps: {
        caseId: s.case_id,
        caseCode: caseData?.case_code ?? "",
        caseNo: caseData?.case_no ?? "",
        clientName: clientData?.full_name ?? "",
        sessionType: s.session_type,
        requiredAction: s.required_action ?? "",
        courtName: caseData?.court_name ?? "",
        urgency: calculateUrgency(s.session_date),
      },
    };
  });
}

/**
 * Convert schedule rows to events when cases aren't available
 */
export function schedulesToEventsSimple(schedules: ScheduleRow[]): CalendarEvent[] {
  return schedules.map((s) => ({
    id: s.id,
    title: `${s.session_type}`,
    start: s.session_date,
    end: s.session_date,
    allDay: true,
    color: sessionTypeColors[s.session_type] ?? "#636E72",
    extendedProps: {
      caseId: s.case_id,
      caseCode: "",
      caseNo: "",
      clientName: "",
      sessionType: s.session_type,
      requiredAction: s.required_action ?? "",
      courtName: "",
      urgency: calculateUrgency(s.session_date),
    },
  }));
}

// ---- FullCalendar Plugin Config ----

export function getCalendarOptions(events: CalendarEvent[], view: CalendarViewType = "dayGridMonth") {
  return {
    plugins: ["dayGrid", "timeGrid", "interaction"],
    initialView: view,
    locale: "ar-eg",
    direction: "rtl" as const,
    events,
    headerToolbar: {
      start: "prev,next today",
      center: "title",
      end: "dayGridMonth,timeGridWeek,timeGridDay",
    },
    buttonText: arabicLocale.buttonText,
    firstDay: 6,
    height: "auto" as const,
    editable: false,
    selectable: true,
    dayMaxEvents: 3,
    moreLinkText: (n: number) => `+${n} أخرى`,
    noEventsText: arabicLocale.noEvents,
    titleFormat: "MMMM YYYY",
    eventDisplay: "block" as const,
    eventDidMount: (info: { el: HTMLElement; event: { extendedProps: { urgency?: string } } }) => {
      const urgency = info.event.extendedProps.urgency;
      if (urgency === "critical") {
        info.el.style.borderRight = `4px solid ${urgencyColors.critical}`;
      } else if (urgency === "high") {
        info.el.style.borderRight = `4px solid ${urgencyColors.high}`;
      }
    },
  };
}

// ---- Helpers ----

function calculateUrgency(dateString: string): "critical" | "high" | "normal" {
  const now = new Date();
  const target = new Date(dateString);
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 3) return "critical";
  if (diffDays <= 7) return "high";
  return "normal";
}

/**
 * Get events for a specific day
 */
export function getEventsForDay(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter((e) => e.start === date);
}

/**
 * Get upcoming events sorted by date
 */
export function getUpcomingEvents(events: CalendarEvent[], limit: number = 10): CalendarEvent[] {
  const now = new Date().toISOString().split("T")[0];
  return events
    .filter((e) => e.start >= now)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, limit);
}

// ---- Constants for fullcalendar package resolution ----

// These are re-exported so the CalendarPage can import them directly
// without needing to resolve package paths
export { default as FullCalendar } from "@fullcalendar/react";
export { default as dayGridPlugin } from "@fullcalendar/daygrid";
export { default as timeGridPlugin } from "@fullcalendar/timegrid";
