import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSessions, useCases } from "@/hooks/useEnterprise";
import { SessionModal } from "@/components/SessionModal";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Loader2,
  Plus,
  AlertTriangle,
} from "lucide-react";

// FullCalendar imports
import { Calendar as FullCalendar } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import arLocale from "@fullcalendar/core/locales/ar";
import { useRef, useEffect } from "react";

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  color: string;
  extendedProps: {
    sessionId: string;
    caseId: string;
    caseCode?: string;
    caseNumber?: string;
    courtName?: string;
    sessionType: string;
    requiredAction?: string;
    attendanceStatus: string;
  };
}

const SESSION_TYPE_COLORS: Record<string, string> = {
  "نظر القضية": "#3b82f6",
  "إعلان الحكم": "#8b5cf6",
  جراحة: "#f59e0b",
  استئناف: "#10b981",
  معارضة: "#ef4444",
  أخرى: "#6b7280",
};

export default function EnterpriseCalendar() {
  const { data: sessions, loading: loadingSessions } = useSessions();
  const { data: cases } = useCases();
  const calendarRef = useRef<HTMLDivElement>(null);
  const calendarInstanceRef = useRef<FullCalendar | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);

  // Build case lookup map
  const caseMap = useMemo(() => {
    if (!cases) return new Map();
    return new Map(cases.map((c) => [c.id, c]));
  }, [cases]);

  // Convert sessions to calendar events
  const events = useMemo((): CalendarEvent[] => {
    if (!sessions) return [];
    return sessions.map((s) => {
      const caseData = caseMap.get(s.case_id);
      return {
        id: s.id,
        title: `${s.session_type} — ${caseData?.case_number ?? "—"}`,
        start: s.session_date_time,
        end: new Date(new Date(s.session_date_time).getTime() + 60 * 60 * 1000).toISOString(),
        color: SESSION_TYPE_COLORS[s.session_type] ?? "#6b7280",
        extendedProps: {
          sessionId: s.id,
          caseId: s.case_id,
          caseCode: caseData?.case_code,
          caseNumber: caseData?.case_number,
          courtName: caseData?.court_name,
          sessionType: s.session_type,
          requiredAction: s.required_action,
          attendanceStatus: s.attendance_status,
        },
      };
    });
  }, [sessions, caseMap]);

  // Initialize FullCalendar
  useEffect(() => {
    if (!calendarRef.current || calendarInstanceRef.current) return;

    const calendar = new FullCalendar(calendarRef.current, {
      plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
      initialView: "dayGridMonth",
      locale: arLocale,
      direction: "rtl",
      headerToolbar: {
        start: "today prev,next",
        center: "title",
        end: "dayGridMonth,timeGridWeek,timeGridDay",
      },
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        color: e.color,
        extendedProps: e.extendedProps,
      })),
      eventClick: (info) => {
        const event = events.find((e) => e.id === info.event.id);
        if (event) setSelectedEvent(event);
      },
      firstDay: 6, // Saturday (Egyptian week start)
      height: "auto",
      editable: false,
      selectable: true,
      dayMaxEvents: 3,
      eventDisplay: "block",
    });

    calendarInstanceRef.current = calendar;

    return () => {
      calendar.destroy();
      calendarInstanceRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update events when data changes
  useEffect(() => {
    if (calendarInstanceRef.current) {
      calendarInstanceRef.current.removeAllEvents();
      events.forEach((e) => {
        calendarInstanceRef.current?.addEvent({
          id: e.id,
          title: e.title,
          start: e.start,
          end: e.end,
          color: e.color,
          extendedProps: e.extendedProps,
        });
      });
    }
  }, [events]);

  const handleSessionCreated = useCallback(() => {
    setSessionModalOpen(false);
    // React Query will auto-refetch
  }, []);

  if (loadingSessions) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">التقويم</h1>
          <p className="text-sm text-muted-foreground">
            جدول الجلسات والمواعيد المحكمة
          </p>
        </div>
        <Button className="gap-2 clay-button" onClick={() => setSessionModalOpen(true)}>
          <Plus className="h-4 w-4" />
          جلسة جديدة
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* FullCalendar */}
        <div className="lg:col-span-2 clay-card p-6 overflow-hidden">
          <style>{`
            .fc {
              direction: rtl;
              font-family: 'Noto Sans Arabic', 'Inter', sans-serif;
            }
            .fc .fc-toolbar-title {
              font-size: 1.2rem;
              font-weight: 700;
            }
            .fc .fc-button {
              background: var(--primary, #1B365D);
              border: none;
              border-radius: 0.75rem;
              padding: 0.4rem 0.8rem;
              font-size: 0.75rem;
              font-weight: 600;
              box-shadow: 2px 2px 6px rgba(0,0,0,0.08), -2px -2px 6px rgba(255,255,255,0.8);
            }
            .fc .fc-button:hover {
              opacity: 0.9;
              transform: translateY(-1px);
            }
            .fc .fc-button-active {
              background: var(--primary, #1B365D);
              opacity: 0.85;
            }
            .fc td, .fc th {
              border: 1px solid var(--border, rgba(0,0,0,0.08));
              border-radius: 0.5rem;
            }
            .fc .fc-daygrid-day {
              min-height: 80px;
            }
            .fc .fc-daygrid-day-number {
              padding: 4px 8px;
              font-size: 0.85rem;
              font-weight: 500;
            }
            .fc .fc-event {
              border-radius: 0.5rem;
              padding: 2px 6px;
              font-size: 0.7rem;
              font-weight: 500;
              margin: 1px 2px;
            }
            .fc .fc-col-header-cell {
              padding: 8px 4px;
              font-weight: 600;
              font-size: 0.8rem;
              color: var(--muted-foreground, #6B7280);
            }
            .fc .fc-scrollgrid {
              border: 1px solid var(--border, rgba(0,0,0,0.08));
              border-radius: 1rem;
              overflow: hidden;
            }
            .fc .fc-scrollgrid td {
              border-color: var(--border, rgba(0,0,0,0.08));
            }
            .fc .fc-daygrid-day.fc-day-today {
              background: rgba(27, 54, 93, 0.05);
            }
            .fc .fc-more-link {
              background: rgba(27, 54, 93, 0.1);
              border-radius: 0.5rem;
              padding: 2px 8px;
              font-size: 0.7rem;
              font-weight: 600;
              color: var(--primary, #1B365D);
            }
          `}</style>
          <div ref={calendarRef} />
        </div>

        {/* Event Detail Panel */}
        <div className="clay-card p-6">
          <h3 className="text-base font-bold text-foreground mb-4">
            {selectedEvent ? "تفاصيل الجلسة" : "اختر جلسة لعرض التفاصيل"}
          </h3>

          {selectedEvent ? (
            <div className="space-y-4">
              <div className="clay-card-soft p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-2xl bg-primary/10">
                    <CalendarIcon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                    {selectedEvent.extendedProps.sessionType}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-foreground mb-1">
                  قضية {selectedEvent.extendedProps.caseNumber ?? "—"}
                </h4>
                <p className="text-xs text-muted-foreground">
                  كود: {selectedEvent.extendedProps.caseCode ?? "—"}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">
                    {new Date(selectedEvent.start).toLocaleString("ar-EG")}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">
                    {selectedEvent.extendedProps.courtName ?? "—"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">الحضور:</span>
                <Badge variant="outline" className="text-xs">
                  {selectedEvent.extendedProps.attendanceStatus}
                </Badge>
              </div>

              {selectedEvent.extendedProps.requiredAction && (
                <div className="rounded-xl bg-muted/30 p-3 border border-border/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    الإجراء المطلوب
                  </p>
                  <p className="text-sm">{selectedEvent.extendedProps.requiredAction}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">انقر على جلسة في التقويم لعرض تفاصيلها</p>
            </div>
          )}
        </div>
      </div>

      {/* Session Modal */}
      <SessionModal
        open={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
      />

      {/* Legal Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        <AlertTriangle className="mx-auto mb-1 h-4 w-4" />
        جميع البيانات والإجراءات مقترحة — يجب التحقق منها مع المحامي المختص قبل اتخاذ أي إجراء قانوني.
      </div>
    </div>
  );
}
