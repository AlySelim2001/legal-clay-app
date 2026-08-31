import { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Gavel,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAllSchedules, useAllCases, useAllClients } from "@/hooks/useSupabaseData";
import {
  FullCalendar,
  dayGridPlugin,
  timeGridPlugin,
  schedulesToEvents,
  getCalendarOptions,
  type CalendarEvent,
} from "@/lib/open-source/calendar-engine";

export default function CalendarPage() {
  const { data: allSchedules, loading } = useAllSchedules();
  const { data: allCases } = useAllCases();
  const { data: allClients } = useAllClients();
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const events = useMemo(
    () => schedulesToEvents(allSchedules ?? [], allCases ?? [], allClients ?? []),
    [allSchedules, allCases, allClients]
  );

  const calendarOptions = useMemo(() => getCalendarOptions(events), [events]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">التقويم</h1>
        <p className="text-sm text-muted-foreground mt-1">
          جدول الجلسات والمواعيد المحكمة
        </p>
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
              background: var(--clay-blue, #6C5CE7);
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
              background: var(--clay-purple, #553C9A);
            }
            .fc .fc-button-primary:not(:disabled).fc-button-active,
            .fc .fc-button-primary:not(:disabled):active {
              background: var(--clay-purple, #553C9A);
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
              color: var(--muted-foreground, #636E72);
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
              background: rgba(108, 92, 231, 0.05);
            }
            .fc .fc-more-link {
              background: rgba(108, 92, 231, 0.1);
              border-radius: 0.5rem;
              padding: 2px 8px;
              font-size: 0.7rem;
              font-weight: 600;
              color: var(--clay-purple, #553C9A);
            }
          `}</style>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin]}
            initialView="dayGridMonth"
            locale="ar-eg"
            direction="rtl"
            events={events.map((e) => ({
              id: e.id,
              title: e.title,
              start: e.start,
              end: e.end,
              allDay: e.allDay,
              color: e.color,
              extendedProps: e.extendedProps,
            }))}
            headerToolbar={calendarOptions.headerToolbar}
            firstDay={calendarOptions.firstDay}
            height="auto"
            editable={false}
            selectable={true}
            dayMaxEvents={3}
            eventDisplay="block"
            eventClick={(info) => {
              const event = events.find((e) => e.id === info.event.id);
              if (event) setSelectedEvent(event);
            }}
          />
        </div>

        {/* Event Detail Panel */}
        <div className="clay-card p-6">
          <h3 className="text-base font-bold text-foreground mb-4">
            {selectedEvent
              ? `تفاصيل الجلسة`
              : "اختر جلسة لعرض التفاصيل"}
          </h3>

          {selectedEvent ? (
            <div className="space-y-4">
              <div className="clay-card-soft p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-2xl bg-clay-blue/10">
                    <Gavel className="w-5 h-5 text-clay-blue" />
                  </div>
                  <span className="clay-badge text-[10px] font-bold bg-clay-purple/10 text-clay-purple px-2.5 py-1">
                    {selectedEvent.extendedProps.sessionType}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-foreground mb-1">
                  {selectedEvent.extendedProps.caseNo || "قضية"}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {selectedEvent.extendedProps.clientName || "—"}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{selectedEvent.start}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{selectedEvent.extendedProps.courtName || "—"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{selectedEvent.extendedProps.caseCode || "—"}</span>
                </div>
              </div>

              {selectedEvent.extendedProps.requiredAction && (
                <div className="clay-inset p-3 rounded-xl">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">الإجراء المطلوب</p>
                  <p className="text-sm text-foreground">{selectedEvent.extendedProps.requiredAction}</p>
                </div>
              )}

              <div className="flex gap-2">
                {selectedEvent.extendedProps.caseCode && (
                  <a
                    href={`/app/cases/${selectedEvent.extendedProps.caseCode}`}
                    className="clay-button flex items-center gap-2 px-3 py-2 bg-clay-blue/10 text-clay-blue text-xs font-semibold rounded-xl"
                  >
                    عرض القضية
                  </a>
                )}
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="clay-button px-3 py-2 text-xs text-muted-foreground"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                حدد جلسة في التقويم لعرض تفاصيلها
              </p>
            </div>
          )}

          {/* Upcoming hearings summary */}
          <div className="mt-6 pt-4 border-t border-border">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
              الجلسات القادمة
            </h4>
            <div className="space-y-2">
              {events.slice(0, 8).map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedEvent(e)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted/30 transition-colors text-end",
                    selectedEvent?.id === e.id && "bg-muted/30"
                  )}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: e.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {e.extendedProps.caseCode || "—"} — {e.extendedProps.clientName || e.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {e.start} — {e.extendedProps.sessionType}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
