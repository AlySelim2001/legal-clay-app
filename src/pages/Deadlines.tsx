import { useState } from "react";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  Loader2,
  Calculator,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpcomingHearings, useLegalDeadlines } from "@/hooks/useSupabaseData";
import { computeDeadline } from "@/lib/deadline";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";

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
  const { data: hearings, loading: hearingsLoading } = useUpcomingHearings();
  const { data: legalDeadlines, loading: deadlinesLoading } = useLegalDeadlines();

  // Calculator state
  const [calcStartDate, setCalcStartDate] = useState("");
  const [calcCode, setCalcCode] = useState("");
  const [calcResult, setCalcResult] = useState<{
    deadline_date: string | null;
    days_remaining: number | null;
    urgency: UrgencyLevel;
    legal_basis: string;
  } | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const handleCalculate = async () => {
    if (!calcStartDate || !calcCode) return;
    setCalcLoading(true);
    setCalcResult(null);

    try {
      const deadlineDate = await computeDeadline(calcStartDate, calcCode);
      const dl = legalDeadlines?.find((l) => l.code === calcCode);

      if (deadlineDate) {
        const days = daysUntil(deadlineDate);
        setCalcResult({
          deadline_date: deadlineDate,
          days_remaining: days,
          urgency: getUrgency(days),
          legal_basis: dl?.legal_basis ?? "—",
        });
      } else {
        setCalcResult({
          deadline_date: null,
          days_remaining: null,
          urgency: "normal",
          legal_basis: dl?.legal_basis ?? "إجراءات مفتوحة без مدة محددة",
        });
      }
    } catch {
      setCalcResult({
        deadline_date: null,
        days_remaining: null,
        urgency: "normal",
        legal_basis: "خطأ في حساب الموعد — تأكد من صحة البيانات المدخلة",
      });
    } finally {
      setCalcLoading(false);
    }
  };

  // Upcoming deadlines list
  const upcomingDeadlines = (hearings ?? [])
    .map((h) => {
      const days = daysUntil(h.session_date);
      return { ...h, days, urgency: getUrgency(days) };
    })
    .filter((d) => d.days >= 0)
    .sort((a, b) => a.days - b.days);

  const stats = {
    critical: upcomingDeadlines.filter((d) => d.urgency === "critical").length,
    high: upcomingDeadlines.filter((d) => d.urgency === "high").length,
    normal: upcomingDeadlines.filter((d) => d.urgency === "normal").length,
    completed: (hearings ?? []).filter((h) => daysUntil(h.session_date) < 0).length,
  };

  if (hearingsLoading || deadlinesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Legal Disclaimer */}
      <LegalDisclaimer />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">المواعيد النهائية</h1>
        <p className="text-sm text-muted-foreground mt-1">
          حاسبة المواعيد القانونية ومتابعة الجلسات القادمة
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
            <span className="text-xs font-semibold text-muted-foreground">عادي (&gt; 7 أيام)</span>
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

      {/* Interactive Calculator */}
      <div className="clay-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-clay-blue" />
          <h2 className="text-base font-bold text-foreground">حاسبة المواعيد القانونية</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">تاريخ البدء</label>
            <input
              type="date"
              value={calcStartDate}
              onChange={(e) => setCalcStartDate(e.target.value)}
              className="clay-input w-full px-4 py-3 text-sm bg-background"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">نوع الإجراء</label>
            <select
              value={calcCode}
              onChange={(e) => setCalcCode(e.target.value)}
              className="clay-input w-full px-4 py-3 text-sm bg-background"
            >
              <option value="">اختر نوع الإجراء...</option>
              {(legalDeadlines ?? []).map((dl) => (
                <option key={dl.code} value={dl.code}>
                  {dl.code} — {dl.procedure_name}
                  {dl.duration_value ? ` (${dl.duration_value} ${dl.duration_unit})` : " (مفتوح)"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleCalculate}
              disabled={!calcStartDate || !calcCode || calcLoading}
              className="clay-button w-full py-3 bg-primary text-primary-foreground text-sm font-semibold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {calcLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Calculator className="w-4 h-4" />
              )}
              احتساب الموعد
            </button>
          </div>
        </div>

        {/* Calculator Result */}
        {calcResult && (
          <div className={cn(
            "clay-card-soft p-4 border-2 mt-4",
            calcResult.deadline_date
              ? urgencyConfig[calcResult.urgency].borderColor
              : "border-border"
          )}>
            {calcResult.deadline_date ? (
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">الموعد النهائي المحسوب</p>
                  <p className="text-xs text-muted-foreground mt-1">{calcResult.legal_basis}</p>
                </div>
                <div className="text-end">
                  <p className="text-lg font-bold text-foreground">{calcResult.deadline_date}</p>
                  <span className={cn(
                    "clay-badge text-xs font-bold px-2 py-1",
                    urgencyConfig[calcResult.urgency].bgColor,
                    urgencyConfig[calcResult.urgency].color
                  )}>
                    {calcResult.days_remaining} يوم — {urgencyConfig[calcResult.urgency].label}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">إجراءات مفتوحة — لا يوجد مدة محددة</p>
                  <p className="text-xs text-muted-foreground mt-1">{calcResult.legal_basis}</p>
                  <p className="text-xs text-clay-blue mt-2">
                    ⚠️ يجب التحقق من الموعد مع المحامي المختص
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upcoming Deadlines List */}
      <div className="clay-card p-6">
        <h3 className="text-base font-bold text-foreground mb-4">الجلسات القادمة</h3>
        <div className="space-y-3">
          {upcomingDeadlines.length > 0 ? (
            upcomingDeadlines.map((d) => {
              const config = urgencyConfig[d.urgency];
              return (
                <div
                  key={d.id}
                  className={cn("clay-card-soft p-4 border-2 transition-all hover:scale-[1.002]", config.borderColor)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-semibold text-clay-blue">
                          {d.case?.case_code ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">— {d.case?.client?.full_name ?? "—"}</span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{d.session_type}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-medium text-foreground">📅 {d.session_date}</span>
                      <span className={cn("clay-badge text-xs font-bold px-3 py-1.5", config.bgColor, config.color)}>
                        {d.days === 0 ? "اليوم!" : d.days === 1 ? "غدًا" : `${d.days} يوم`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">لا توجد جلسات قادمة</p>
          )}
        </div>
      </div>
    </div>
  );
}
