import { useState, useMemo } from "react";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { mockDeadlines, type UrgencyLevel } from "@/data/mock";

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
  const now = new Date("2026-08-30");
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Deadlines() {
  const [filterUrgency, setFilterUrgency] = useState<UrgencyLevel | "all">("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const deadlines = useMemo(() => {
    let result = [...mockDeadlines];
    if (filterUrgency !== "all") {
      result = result.filter((d) => d.urgency === filterUrgency);
    }
    if (filterStatus !== "all") {
      result = result.filter((d) => d.status === filterStatus);
    }
    // Sort by urgency then by days until
    const urgencyOrder = { critical: 0, high: 1, normal: 2 };
    result.sort((a, b) => {
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return daysUntil(a.dueDate) - daysUntil(b.dueDate);
    });
    return result;
  }, [filterUrgency, filterStatus]);

  const stats = {
    critical: mockDeadlines.filter((d) => d.urgency === "critical" && d.status !== "مكتمل").length,
    high: mockDeadlines.filter((d) => d.urgency === "high" && d.status !== "مكتمل").length,
    normal: mockDeadlines.filter((d) => d.urgency === "normal" && d.status !== "مكتمل").length,
    completed: mockDeadlines.filter((d) => d.status === "مكتمل").length,
  };

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
            <span className="text-xs font-semibold text-muted-foreground">مكتمل</span>
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
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="clay-input px-3 py-2 text-sm bg-background min-w-[140px]"
        >
          <option value="all">جميع الحالات</option>
          <option value="معلق">معلق</option>
          <option value="مكتمل">مكتمل</option>
          <option value="متأخر">متأخر</option>
        </select>
      </div>

      {/* Deadlines List */}
      <div className="space-y-3">
        {deadlines.map((d) => {
          const config = urgencyConfig[d.urgency];
          const days = daysUntil(d.dueDate);
          const daysLabel =
            d.status === "مكتمل"
              ? "مكتمل"
              : days < 0
              ? `متأخر ${Math.abs(days)} يوم`
              : days === 0
              ? "اليوم!"
              : days === 1
              ? "غدًا"
              : `${days} يوم متبقي`;

          return (
            <div
              key={d.id}
              className={cn(
                "clay-card p-5 border-2 transition-all hover:scale-[1.002]",
                config.borderColor
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Urgency indicator */}
                <div className={cn("p-3 rounded-2xl shrink-0", config.bgColor)}>
                  <AlertTriangle className={cn("w-5 h-5", config.color)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-foreground">
                      {d.description}
                    </h3>
                    <span className={cn("clay-badge text-[10px] font-bold px-2 py-0.5", config.bgColor, config.color)}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.caseCode} — النوع: {d.type}
                  </p>
                </div>

                {/* Due date + status */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-end">
                    <p className="text-xs text-muted-foreground">الموعد النهائي</p>
                    <p className="text-sm font-semibold text-foreground">{d.dueDate}</p>
                  </div>
                  <span
                    className={cn(
                      "clay-badge text-xs font-bold px-3 py-1.5 min-w-[80px] text-center",
                      d.status === "مكتمل"
                        ? "bg-urgency-normal/10 text-urgency-normal"
                        : days <= 3
                        ? "bg-urgency-critical/10 text-urgency-critical animate-pulse-glow"
                        : days <= 7
                        ? "bg-urgency-high/10 text-urgency-high"
                        : "bg-urgency-normal/10 text-urgency-normal"
                    )}
                  >
                    {daysLabel}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 clay-inset rounded-full h-2 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    d.status === "مكتمل"
                      ? "bg-urgency-normal"
                      : days <= 3
                      ? "bg-urgency-critical"
                      : days <= 7
                      ? "bg-urgency-high"
                      : "bg-urgency-normal"
                  )}
                  style={{
                    width:
                      d.status === "مكتمل"
                        ? "100%"
                        : days <= 0
                        ? "100%"
                        : `${Math.max(5, 100 - (days / 30) * 100)}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
