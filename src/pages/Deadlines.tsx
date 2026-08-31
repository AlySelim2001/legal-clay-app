import { useState, useMemo } from "react";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  Filter,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpcomingHearings } from "@/hooks/useSupabaseData";

type UrgencyLevel = "critical" | "high" | "normal";

const urgencyConfig: Record<UrgencyLevel, { label: string; color: string; bgColor: string; borderColor: string }> = {
  critical: {
    label: "حرج",
    color: "text-urgency-critical",
    bgColor: "bg-urgency-critical/10",
    borderColor: "border-urgency-critical/20",
  },
  high: {
    label: "مرتفع",
    color: "text-urgency-high",
    bgColor: "bg-urgency-high/10",
    borderColor: "border-urgency-high/20",
  },
  normal: {
    label: "عادي",
    color: "text-urgency-normal",
    bgColor: "bg-urgency-normal/10",
    borderColor: "border-urgency-normal/20",
  },
};

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getUrgency(days: number): UrgencyLevel {
  if (days <= 3) return "critical";
  if (days <= 7) return "high";
  return "normal";
}

export default function Deadlines() {
  const { data: hearings, loading } = useUpcomingHearings();
  const [filterUrgency, setFilterUrgency] = useState<UrgencyLevel | "all">("all");

  const deadlines = useMemo(() => {
    if (!hearings) return [];
    let result = hearings.map((h) => {
      const days = daysUntil(h.session_date);
      return {
        id: h.id,
        caseCode: h.case?.case_code ?? "—",
        clientName: h.case?.client?.full_name ?? "—",
        description: h.required_action ?? h.session_type,
        dueDate: h.session_date,
        type: h.session_type,
        days,
        urgency: getUrgency(days),
        completed: days < 0,
      };
    });

    if (filterUrgency !== "all") {
      result = result.filter((d) => d.urgency === filterUrgency && !d.completed);
    }

    const urgencyOrder = { critical: 0, high: 1, normal: 2 };
    result.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return a.days - b.days;
    });
    return result;
  }, [hearings, filterUrgency]);

  const stats = useMemo(() => {
    if (!hearings) return { critical: 0, high: 0, normal: 0, completed: 0 };
    const active = hearings.filter((h) => daysUntil(h.session_date) >= 0);
    return {
      critical: active.filter((h) => daysUntil(h.session_date) <= 3).length,
      high: active.filter((h) => daysUntil(h.session_date) <= 7 && daysUntil(h.session_date) > 3).length,
      normal: active.filter((h) => daysUntil(h.session_date) > 7).length,
      completed: hearings.filter((h) => daysUntil(h.session_date) < 0).length,
    };
  }, [hearings]);

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
        <h1 className="text-2xl font-bold text-foreground">المواعيد النهائية</h1>
        <p className="text-sm text-muted-foreground mt-1">
          متابعة وإدارة جميع المواعيد القانونية
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="clay-card p-4 urgency-border-critical">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-urgency-critical" />
            <span className="text-xs font-semibold text-muted-foreground">حرج (≤ 3 أيام)</span>
          </div>
          <p className="text-2xl font-bold text-urgency-critical">{stats.critical}</p>
        </div>
        <div className="clay-card p-4 urgency-border-high">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-urgency-high" />
            <span className="text-xs font-semibold text-muted-foreground">مرتفع (≤ 7 أيام)</span>
          </div>
          <p className="text-2xl font-bold text-urgency-high">{stats.high}</p>
        </div>
        <div className="clay-card p-4 urgency-border-normal">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-urgency-normal" />
            <span className="text-xs font-semibold text-muted-foreground">عادي (&gt; 14 يوم)</span>
          </div>
          <p className="text-2xl font-bold text-urgency-normal">{stats.normal}</p>
        </div>
        <div className="clay-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-clay-teal" />
            <span className="text-xs font-semibold text-muted-foreground">منتهي</span>
          </div>
          <p className="text-2xl font-bold text-clay-teal">{stats.completed}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="clay-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          تصفية:
        </div>
        <select
          value={filterUrgency}
          onChange={(e) => setFilterUrgency(e.target.value as UrgencyLevel | "all")}
          className="clay-input px-3 py-2 text-sm bg-background min-w-[140px]"
        >
          <option value="all">جميع الأولويات</option>
          <option value="critical">حرج</option>
          <option value="high">مرتفع</option>
          <option value="normal">عادي</option>
        </select>
      </div>

      {/* Deadlines List */}
      <div className="space-y-3">
        {deadlines.map((d) => {
          const config = urgencyConfig[d.urgency];
          const daysLabel =
            d.completed
              ? "منتهي"
              : d.days < 0
              ? `متأخر ${Math.abs(d.days)} يوم`
              : d.days === 0
              ? "اليوم!"
              : d.days === 1
              ? "غدًا"
              : `${d.days} يوم متبقي`;

          return (
            <div
              key={d.id}
              className={cn(
                "clay-card p-5 border-2 transition-all hover:scale-[1.002]",
                d.completed ? "border-border/50 opacity-60" : config.borderColor
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Urgency dot */}
                {!d.completed && (
                  <div className={cn("w-3 h-3 rounded-full shrink-0", config.bgColor)} />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-semibold text-clay-blue">
                      {d.caseCode}
                    </span>
                    <span className="text-xs text-muted-foreground">— {d.clientName}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{d.description}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground">📅 {d.dueDate}</span>
                    <span className="clay-badge text-[10px] bg-card text-muted-foreground px-2 py-0.5">
                      {d.type}
                    </span>
                  </div>
                </div>

                {/* Days remaining */}
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={cn(
                      "clay-badge text-xs font-bold px-3 py-1.5",
                      d.completed
                        ? "bg-urgency-normal/10 text-urgency-normal"
                        : config.bgColor + " " + config.color
                    )}
                  >
                    {daysLabel}
                  </span>
                  {!d.completed && (
                    <span
                      className={cn(
                        "clay-badge text-[10px] font-bold px-2 py-1",
                        config.bgColor + " " + config.color
                      )}
                    >
                      {config.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
