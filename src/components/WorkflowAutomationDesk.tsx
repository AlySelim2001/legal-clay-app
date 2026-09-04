import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Workflow,
  Play,
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
  Trash2,
  Upload,
  History,
  FileText,
} from "lucide-react";
import {
  getWorkflowAutomation,
  WORKFLOW_DEFINITIONS,
  listWorkflowRuns,
  deleteWorkflowRun,
  type WorkflowId,
  type WorkflowRunSummary,
} from "@/automation/intelligent-workflow";

const automation = getWorkflowAutomation();

const inputCls =
  "clay-input w-full rounded-xl border bg-white px-3 py-2 text-sm dark:bg-background font-arabic";

const ACCENT: Record<string, { chip: string; btn: string; dot: string }> = {
  "new-case-intake": { chip: "bg-clay-teal/10 text-clay-teal", btn: "bg-clay-teal/10 text-clay-teal", dot: "text-clay-teal" },
  "document-review": { chip: "bg-clay-blue/10 text-clay-blue", btn: "bg-clay-blue/10 text-clay-blue", dot: "text-clay-blue" },
  "deadline-monitoring": { chip: "bg-urgency-high/10 text-urgency-high", btn: "bg-urgency-high/15 text-urgency-high", dot: "text-urgency-high" },
  "court-session-prep": { chip: "bg-clay-purple/10 text-clay-purple", btn: "bg-clay-purple/10 text-clay-purple", dot: "text-clay-purple" },
};

interface RunLogRow {
  id: string;
  workflowLabel: string;
  startedAt: string;
  status: WorkflowRunSummary["status"];
  stepCount: number;
  okCount: number;
}

export function WorkflowAutomationDesk() {
  const [selected, setSelected] = useState<WorkflowId>("new-case-intake");
  const [values, setValues] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<WorkflowRunSummary | null>(null);
  const [log, setLog] = useState<RunLogRow[]>([]);

  const def = useMemo(
    () => WORKFLOW_DEFINITIONS.find((d) => d.id === selected) ?? WORKFLOW_DEFINITIONS[0],
    [selected],
  );
  const accent = ACCENT[def.id];

  const refreshLog = useCallback(async () => {
    const runs = await listWorkflowRuns();
    setLog(
      runs.slice(0, 6).map((r) => ({
        id: r.id,
        workflowLabel: r.workflowLabel,
        startedAt: r.startedAt,
        status: r.status,
        stepCount: r.steps.length,
        okCount: r.steps.filter((s) => s.ok && !s.skipped).length,
      })),
    );
  }, []);

  useEffect(() => {
    void refreshLog();
  }, [refreshLog]);

  useEffect(() => {
    setValues({});
    setFile(null);
    setLast(null);
    setError(null);
  }, [selected]);

  const handleRun = useCallback(async () => {
    if (busy) return;
    const missing = def.inputs.filter((i) => i.required && !(values[i.key] ?? "").trim());
    if (missing.length > 0) {
      setError(`أكمل الحقول الإلزامية: ${missing.map((m) => m.label).join("، ")}`);
      return;
    }
    setBusy(true);
    setError(null);
    setLast(null);
    try {
      const ctx: Record<string, string> = {};
      for (const input of def.inputs) {
        const value = (values[input.key] ?? "").trim();
        if (value) ctx[input.key] = value;
      }
      const summary = await automation.executeWorkflow(def.id, ctx, file);
      setLast(summary);
      await refreshLog();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل تشغيل التدفق");
    } finally {
      setBusy(false);
    }
  }, [busy, def, values, file, refreshLog]);

  const statusChip = (status: WorkflowRunSummary["status"]) =>
    status === "completed"
      ? "bg-clay-green/10 text-clay-green"
      : status === "completed-with-notes"
        ? "bg-urgency-high/10 text-urgency-high"
        : "bg-urgency-critical/10 text-urgency-critical";

  const statusAr = (status: WorkflowRunSummary["status"]) =>
    status === "completed" ? "مكتمل" : status === "completed-with-notes" ? "اكتمل مع ملاحظات" : "فشل";

  return (
    <div className="space-y-4">
      {/* Engine notice */}
      <div className="clay-card p-3 flex items-start gap-2">
        <Workflow className="w-4 h-4 shrink-0 text-clay-purple mt-0.5" />
        <p className="text-[10px] text-muted-foreground font-arabic leading-relaxed">
          محرك أتمتة يعمل محلياً بالكامل (بديل n8n — غير قابل للتشغيل في المتصفح): كل خطوة تنفَّذ عبر وحدات
          التطبيق الفعلية — سرب الوكلاء للتصنيف، قاعدة المواعيد (قانون الإجراءات)، استرجاع RAG للأحكام، ومسح
          OCR حقيقي عبر Tesseract للمستندات المرفوعة. سجل التشغيل يُحفظ في الخزينة المحلية (IndexedDB).
        </p>
      </div>

      {/* Workflow picker */}
      <div className="grid gap-3 md:grid-cols-2">
        {WORKFLOW_DEFINITIONS.map((w) => {
          const active = w.id === selected;
          const a = ACCENT[w.id];
          return (
            <button
              key={w.id}
              onClick={() => setSelected(w.id)}
              className={`clay-card p-3 text-start transition-all ${
                active ? "ring-2 ring-clay-purple/50 shadow-md" : "hover:bg-muted/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className={`text-[10px] font-bold rounded-lg px-2 py-0.5 font-arabic ${a.chip}`}>
                  {w.labelAr}
                </span>
                <span className="text-[8px] font-mono text-muted-foreground" dir="ltr">
                  {w.triggerAr}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-arabic leading-relaxed mb-2">
                {w.descAr}
              </p>
              <div className="space-y-0.5">
                {w.stepsPreview.map((s, i) => (
                  <p key={i} className="text-[9px] text-muted-foreground/80 font-arabic flex items-center gap-1.5">
                    <span className={a.dot}>◆</span>
                    {s}
                  </p>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Runner */}
      <div className="clay-card p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold font-arabic">تشغيل التدفق: {def.labelAr}</h3>
          <span className={`text-[10px] font-bold rounded-lg px-2.5 py-1 font-arabic ${accent.chip}`}>
            {def.stepsPreview.length} خطوات
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {def.inputs.map((input) => (
            <div key={input.key}>
              <label className="text-[10px] text-muted-foreground font-arabic block mb-1">
                {input.label}
                {input.required && <span className="text-urgency-critical"> *</span>}
              </label>
              <input
                value={values[input.key] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [input.key]: e.target.value }))}
                placeholder={input.placeholder}
                className={inputCls}
              />
            </div>
          ))}
        </div>

        {def.acceptFile && (
          <div className="mt-2">
            <label className="text-[10px] text-muted-foreground font-arabic block mb-1">
              {def.fileInputLabel}
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-dashed border-clay-blue/40 bg-clay-blue/5 px-3 py-2 cursor-pointer hover:bg-clay-blue/10 transition-colors">
              <Upload className="w-4 h-4 text-clay-blue shrink-0" />
              <span className="text-[10px] font-arabic text-muted-foreground truncate">
                {file ? file.name : "اختر صورة المستند (PNG/JPG) — يعالج محلياً"}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => void handleRun()}
            disabled={busy}
            className={`clay-button rounded-xl px-4 py-2 flex items-center gap-2 text-xs font-bold font-arabic disabled:opacity-50 ${accent.btn}`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {busy ? "جارٍ التنفيذ…" : "تشغيل التدفق"}
          </button>
          {error && (
            <p className="text-[10px] text-urgency-critical font-arabic flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </p>
          )}
        </div>

        {/* Outcome */}
        {last && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-black rounded-lg px-2 py-0.5 font-arabic ${statusChip(last.status)}`}>
                {statusAr(last.status)}
              </span>
              <span className="text-[9px] text-muted-foreground font-arabic">
                {last.steps.length} خطوة • بدأ {new Date(last.startedAt).toLocaleTimeString("ar-EG")}
              </span>
            </div>
            {last.steps.map((s) => (
              <div key={s.id} className="rounded-xl border border-border bg-muted/20 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {s.ok && !s.skipped ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-clay-green shrink-0" />
                    ) : s.skipped ? (
                      <Info className="w-3.5 h-3.5 text-urgency-high shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-urgency-critical shrink-0" />
                    )}
                    <span
                      className={`text-[11px] font-bold font-arabic ${
                        s.ok && !s.skipped
                          ? "text-clay-green"
                          : s.skipped
                            ? "text-urgency-high"
                            : "text-urgency-critical"
                      }`}
                    >
                      {s.labelAr}
                    </span>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-mono">{s.durationMs}ms</span>
                </div>
                <pre className="text-[10px] text-foreground/90 font-arabic whitespace-pre-wrap leading-relaxed mt-1.5 font-sans">
                  {s.detail}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div className="clay-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <History className="w-4 h-4 text-clay-rose" />
          <h4 className="text-xs font-bold font-arabic">سجل التشغيل المحلي</h4>
          {log.length === 0 && (
            <span className="text-[9px] text-muted-foreground font-arabic">
              — لا توجد تشغيلات بعد
            </span>
          )}
        </div>
        {log.length > 0 && (
          <div className="space-y-1.5">
            {log.map((r) => (
              <div
                key={r.id}
                className="rounded-lg bg-muted/20 px-2.5 py-1.5 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[10px] font-bold font-arabic truncate">{r.workflowLabel}</span>
                  <span className={`text-[9px] font-black rounded px-1.5 py-0.5 font-arabic shrink-0 ${statusChip(r.status)}`}>
                    {statusAr(r.status)}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-arabic shrink-0 hidden sm:inline">
                    {r.okCount}/{r.stepCount} خطوات ناجحة
                  </span>
                  <span className="text-[9px] text-muted-foreground shrink-0">
                    {new Date(r.startedAt).toLocaleString("ar-EG")}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    await deleteWorkflowRun(r.id);
                    await refreshLog();
                  }}
                  className="text-muted-foreground hover:text-urgency-critical shrink-0"
                  title="حذف من السجل"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
