import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  deleteCaseOutcome,
  getSuccessRateAnalyzer,
  listCaseOutcomes,
  OUTCOME_VERDICT_LABELS,
  recordCaseOutcome,
  type CaseOutcomeRecord,
  type OutcomeVerdict,
} from "@/analytics/predictive-analytics";
import {
  buildSuccessRateReportPdf,
  downloadSuccessRateReport,
} from "@/lib/reports/success-rate-report";

const CASE_TYPE_OPTIONS = [
  "جنائي — جرائم عنف",
  "جنائي — مخدرات",
  "جنائي — أموال عامة",
  "جنائي — شيكات",
  "مدني",
  "تجاري",
  "أحوال شخصية",
];

const inputClass =
  "clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic";

function rateColor(rate: number): string {
  return rate >= 60 ? "text-clay-green" : rate >= 40 ? "text-urgency-high" : "text-urgency-critical";
}

function barColor(rate: number): string {
  return rate >= 60 ? "bg-clay-green" : rate >= 40 ? "bg-urgency-high" : "bg-urgency-critical";
}

export function OutcomeAnalyticsDesk() {
  const analyzer = getSuccessRateAnalyzer();

  const [outcomes, setOutcomes] = useState<CaseOutcomeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick-log form
  const [caseRef, setCaseRef] = useState("");
  const [caseType, setCaseType] = useState(CASE_TYPE_OPTIONS[0]);
  const [lawyerId, setLawyerId] = useState("");
  const [verdict, setVerdict] = useState<OutcomeVerdict>("won");
  const [durationDays, setDurationDays] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState("");

  // Filters
  const [lawyerFilter, setLawyerFilter] = useState("الكل");
  const [typeFilter, setTypeFilter] = useState("الكل");

  const refresh = useCallback(async () => {
    try {
      setOutcomes(await listCaseOutcomes());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lawyerOptions = useMemo(
    () => [...new Set(outcomes.map((o) => o.lawyerId).filter((l): l is string => Boolean(l)))],
    [outcomes],
  );
  const typeOptions = useMemo(
    () => [...new Set(outcomes.map((o) => o.caseType))].sort((a, b) => a.localeCompare(b, "ar")),
    [outcomes],
  );

  const handleAdd = useCallback(async () => {
    setFormError("");
    if (!caseRef.trim()) {
      setFormError("أدخل رقم/كود القضية أولاً");
      return;
    }
    setAdding(true);
    try {
      const parsedDuration = durationDays.trim() ? Number(durationDays.trim()) : undefined;
      if (parsedDuration !== undefined && (Number.isNaN(parsedDuration) || parsedDuration < 0)) {
        setFormError("المدة يجب أن تكون عدد أيام صحيحاً");
        return;
      }
      await recordCaseOutcome({
        caseRef: caseRef.trim(),
        caseType,
        lawyerId: lawyerId.trim() || undefined,
        verdict,
        durationDays: parsedDuration,
      });
      setCaseRef("");
      setDurationDays("");
      setVerdict("won");
      await refresh();
    } catch {
      setFormError("تعذر حفظ النتيجة — حاول مجدداً");
    } finally {
      setAdding(false);
    }
  }, [caseRef, caseType, lawyerId, verdict, durationDays, refresh]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteCaseOutcome(id);
        await refresh();
      } catch {
        // Ignore delete failures in the demo desk
      }
    },
    [refresh],
  );


  // Live analysis — recomputed on every registry/filter change.
  const [live, setLive] = useState<Awaited<ReturnType<typeof analyzer.analyzeSuccessRate>> | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLiveLoading(true);
    void (async () => {
      const result = await analyzer.analyzeSuccessRate(
        lawyerFilter === "الكل" ? null : lawyerFilter,
        typeFilter,
        outcomes,
      );
      if (!cancelled) {
        setLive(result);
        setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [analyzer, lawyerFilter, typeFilter, outcomes]);

  const [exporting, setExporting] = useState(false);
  const handleExport = useCallback(async () => {
    if (exporting || !live) return;
    setExporting(true);
    try {
      const bytes = await buildSuccessRateReportPdf(live, {
        lawyerLabel: lawyerFilter === "الكل" ? "كل المحامين" : lawyerFilter,
        caseTypeLabel: typeFilter === "الكل" ? "جميع أنواع القضايا" : typeFilter,
      });
      downloadSuccessRateReport(bytes);
    } catch {
      // Report export failure is non-critical — keep the desk usable
    } finally {
      setExporting(false);
    }
  }, [exporting, live, lawyerFilter, typeFilter]);

  const decidedLabel = (t: { caseType: string; successRate: number; decided: number }): string =>
    `${t.caseType} — ${Math.round(t.successRate)}% (${t.decided} قضايا)`;

  return (
    <div className="space-y-4">
      <div className="clay-card p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-clay-teal" />
            <h3 className="text-sm font-bold font-arabic">تحليل معدل النجاح حسب المحامي ونوع القضية</h3>
          </div>
          <div className="flex items-center gap-2">
          <span className="clay-badge text-[10px] bg-clay-teal/10 text-clay-teal px-2.5 py-1 rounded-full w-fit font-arabic">
            استناداً إلى سجل النتائج المحلي
          </span>
          <button
            onClick={handleExport}
            disabled={exporting || !live || live.totalCases === 0}
            className="clay-button rounded-xl bg-clay-purple/10 text-clay-purple px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold font-arabic disabled:opacity-50"
            title="تصدير التقرير كملف PDF للمراجعة"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            تصدير PDF
          </button>
          </div>
        </div>

        {/* Filters + metrics */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground font-arabic block mb-1">عامل المحامي</label>
                <select
                  value={lawyerFilter}
                  onChange={(e) => setLawyerFilter(e.target.value)}
                  className={inputClass}
                >
                  <option value="الكل">كل المحامين</option>
                  {lawyerOptions.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-arabic block mb-1">نوع القضية</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className={inputClass}
                >
                  <option value="الكل">جميع الأنواع</option>
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-xl bg-muted/40 p-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground font-arabic">معدل النجاح</p>
                  {liveLoading || !live ? (
                    <p className="text-2xl font-black text-muted-foreground/50 font-arabic">—</p>
                  ) : (
                    <p className={`text-4xl font-black ${rateColor(live.successRate)} font-arabic`}>
                      {Math.round(live.successRate)}%
                    </p>
                  )}
                </div>
                <div className="text-end space-y-1">
                  <p className="text-[10px] text-muted-foreground font-arabic">
                    قضايا محسومة: <span className="text-foreground font-bold font-arabic">{live?.decidedCases ?? 0}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground font-arabic">
                    إجمالي السجل: <span className="text-foreground font-bold font-arabic">{live?.totalCases ?? 0}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground font-arabic flex items-center gap-1 justify-end">
                    <Clock className="w-3 h-3" />
                    متوسط المدة:{" "}
                    <span className="text-foreground font-bold font-arabic">
                      {live && live.averageDurationDays !== null
                        ? `${Math.round(live.averageDurationDays)} يوم`
                        : "—"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden" dir="ltr">
                <div
                  className={`h-full rounded-full ${barColor(live?.successRate ?? 0)}`}
                  style={{ width: `${live?.successRate ?? 0}%` }}
                />
              </div>
            </div>

            {live && !liveLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-xl bg-clay-green/5 border border-clay-green/20 p-2.5">
                  <p className="text-[10px] font-bold text-clay-green font-arabic mb-1.5 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    أقوى أنواع القضايا
                  </p>
                  {live.strongestCaseTypes.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground font-arabic">
                      سجّل نتيجتين محسومتين على الأقل لكل نوع لعرض التصنيف
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {live.strongestCaseTypes.map((t) => (
                        <li key={t.caseType} className="text-[10px] text-foreground font-arabic">
                          {decidedLabel(t)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-xl bg-clay-rose/5 border border-clay-rose/20 p-2.5">
                  <p className="text-[10px] font-bold text-clay-rose font-arabic mb-1.5 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    مجالات التحسين
                  </p>
                  {live.improvementAreas.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground font-arabic">
                      لا توجد فئات كافية للتحليل بعد
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {live.improvementAreas.map((t) => (
                        <li key={t.caseType} className="text-[10px] text-foreground font-arabic">
                          {decidedLabel(t)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick log form */}
          <div className="space-y-2.5">
            <p className="text-[10px] text-muted-foreground font-arabic">
              سجّل نتيجة قضية محسومة ليُحدَّث التحليل فوراً (يُحفظ محلياً على الجهاز).
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={caseRef}
                onChange={(e) => setCaseRef(e.target.value)}
                placeholder="رقم / كود القضية *"
                className={inputClass}
              />
              <input
                value={lawyerId}
                onChange={(e) => setLawyerId(e.target.value)}
                placeholder="المحامي (اختياري)"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={caseType} onChange={(e) => setCaseType(e.target.value)} className={inputClass}>
                {CASE_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select value={verdict} onChange={(e) => setVerdict(e.target.value as OutcomeVerdict)} className={inputClass}>
                {(Object.keys(OUTCOME_VERDICT_LABELS) as OutcomeVerdict[]).map((v) => (
                  <option key={v} value={v}>{OUTCOME_VERDICT_LABELS[v]}</option>
                ))}
              </select>
            </div>
            <input
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value.replace(/[^0-9]/g, ""))}
              type="number"
              min={0}
              placeholder="مدة القضية بالأيام (اختياري)"
              className={inputClass}
            />
            <button
              onClick={handleAdd}
              disabled={adding}
              className="clay-button w-full rounded-xl bg-clay-teal/10 text-clay-teal px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50 font-arabic"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              تسجيل النتيجة وتحديث التحليل
            </button>
            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-urgency-high/30 bg-urgency-high/10 p-2 text-xs text-foreground font-arabic">
                <AlertTriangle className="w-4 h-4 shrink-0 text-urgency-high" />
                {formError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logged outcomes */}
      <div className="clay-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold font-arabic">سجل النتائج ({outcomes.length})</h4>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        </div>

        {outcomes.length === 0 ? (
          <p className="text-[11px] text-muted-foreground font-arabic text-center py-4">
            لا توجد نتائج مسجلة بعد — أضف أول قضية محسومة بالأعلى وسيتشكل التحليل تدريجياً
            (يُحتسب التصنيف بعد نتيجتين محسومتين على الأقل لكل نوع).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-start px-2 py-2 font-semibold text-muted-foreground text-[10px] font-arabic">القضية</th>
                  <th className="text-start px-2 py-2 font-semibold text-muted-foreground text-[10px] font-arabic">النوع</th>
                  <th className="text-start px-2 py-2 font-semibold text-muted-foreground text-[10px] font-arabic">المحامي</th>
                  <th className="text-start px-2 py-2 font-semibold text-muted-foreground text-[10px] font-arabic">النتيجة</th>
                  <th className="text-start px-2 py-2 font-semibold text-muted-foreground text-[10px] font-arabic">المدة</th>
                  <th className="text-start px-2 py-2 font-semibold text-muted-foreground text-[10px] font-arabic">التاريخ</th>
                  <th className="text-start px-2 py-2 font-semibold text-muted-foreground text-[10px] font-arabic"></th>
                </tr>
              </thead>
              <tbody>
                {outcomes.map((o) => (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-2 py-2 font-mono text-xs text-clay-blue">{o.caseRef}</td>
                    <td className="px-2 py-2 text-foreground font-arabic">{o.caseType}</td>
                    <td className="px-2 py-2 text-muted-foreground font-arabic">{o.lawyerId ?? "—"}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`clay-badge text-[10px] px-2 py-0.5 rounded-full font-arabic ${
                          o.verdict === "won"
                            ? "bg-clay-green/10 text-clay-green"
                            : o.verdict === "lost"
                              ? "bg-clay-rose/10 text-clay-rose"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {OUTCOME_VERDICT_LABELS[o.verdict]}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground font-arabic">
                      {typeof o.durationDays === "number" ? `${o.durationDays} يوم` : "—"}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground font-arabic whitespace-nowrap">
                      {new Date(o.createdAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => handleDelete(o.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                        title="حذف النتيجة"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/30 p-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-clay-teal mt-0.5" />
          <p className="text-[10px] text-muted-foreground font-arabic leading-4">
            {live?.disclaimer ??
              "التحليل الإحصائي استرشادي — سجّل النتائج الفعلية دورياً لتحسين دقة التقديرات المستقبلية."}
          </p>
        </div>
      </div>
    </div>
  );
}
