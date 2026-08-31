import { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Gavel,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAllSchedules } from "@/hooks/useSupabaseData";

const daysOfWeek = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function generateMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export default function CalendarPage() {
  const { data: allSchedules, loading } = useAllSchedules();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(8); // September (0-indexed)
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const cells = useMemo(() => generateMonth(year, month), [year, month]);
  const monthName = new Date(year, month).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
  });

  // Map hearings to dates
  const hearingsByDate = useMemo(() => {
    const map: Record<string, typeof allSchedules> = {};
    (allSchedules ?? []).forEach((h) => {
      const key = h.session_date;
      if (!map[key]) map[key] = [];
      map[key]!.push(h);
    });
    return map;
  }, [allSchedules]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const selectedDate = selectedDay
    ? `${year}-${String(month + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`
    : null;

  const selectedHearings = selectedDate ? (hearingsByDate[selectedDate] ?? []) : [];

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
        {/* Calendar Grid */}
        <div className="lg:col-span-2 clay-card p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} className="clay-button p-2 bg-card rounded-xl">
              <ChevronRight className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-bold text-foreground">{monthName}</h2>
            <button onClick={nextMonth} className="clay-button p-2 bg-card rounded-xl">
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {daysOfWeek.map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />;

              const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayHearings = hearingsByDate[dateKey] ?? [];
              const isSelected = selectedDay === day;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all",
                    isSelected
                      ? "bg-clay-blue text-white font-bold shadow-lg"
                      : dayHearings.length > 0
                      ? "bg-clay-purple/10 text-foreground font-medium hover:bg-clay-purple/20"
                      : "text-foreground hover:bg-muted/50"
                  )}
                >
                  <span>{day}</span>
                  {dayHearings.length > 0 && !isSelected && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayHearings.slice(0, 3).map((_, i) => (
                        <span key={i} className="w-1 h-1 rounded-full bg-clay-purple" />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Panel */}
        <div className="clay-card p-6">
          <h3 className="text-base font-bold text-foreground mb-4">
            {selectedDay
              ? `جلسات ${selectedDay} / ${month + 1}`
              : "اختر يومًا لعرض الجلسات"}
          </h3>

          {selectedHearings.length > 0 ? (
            <div className="space-y-3">
              {selectedHearings.map((h) => (
                <div key={h.id} className="clay-card-soft p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-xl bg-clay-blue/10">
                      <Gavel className="w-4 h-4 text-clay-blue" />
                    </div>
                    <span className="clay-badge text-[10px] font-bold bg-clay-purple/10 text-clay-purple px-2 py-0.5">
                      {h.session_type}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    {h.case?.case_code ?? "—"} — {h.case?.client?.full_name ?? "—"}
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{h.session_date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>{h.case?.court_name ?? "—"}</span>
                    </div>
                  </div>
                  {h.required_action && (
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {h.required_action}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : selectedDay ? (
            <div className="text-center py-8">
              <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">لا توجد جلسات في هذا اليوم</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">حدد يومًا في التقويم لعرض الجلسات</p>
            </div>
          )}

          {/* Upcoming All */}
          <div className="mt-6 pt-4 border-t border-border">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">
              جميع الجلسات
            </h4>
            <div className="space-y-2">
              {(allSchedules ?? []).slice(0, 10).map((h) => (
                <div
                  key={h.id}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/30 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-clay-purple shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {h.case?.case_code ?? "—"} — {h.case?.client?.full_name ?? "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {h.session_date} — {h.session_type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
