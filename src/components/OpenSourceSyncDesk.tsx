import { useCallback, useEffect, useRef, useState } from "react";
import {
  Globe,
  Landmark,
  Upload,
  Download,
  Clock,
  ListChecks,
  Trash2,
  Check,
  Loader2,
  FileText,
  ExternalLink,
  Plus,
} from "lucide-react";
import {
  getArkCaseIntegration,
  getOpenLawOfficeIntegration,
  getFreeLawProjectIntegration,
  isCourtListenerConfigured,
  downloadTextFile,
  type ArkCaseSyncedCaseRecord,
  type CourtListenerSearchOutcome,
  type OloTaskRecord,
  type OloTimeEntryRecord,
} from "@/integrations/github-open-source";

const ark = getArkCaseIntegration();
const olo = getOpenLawOfficeIntegration();
const freeLaw = getFreeLawProjectIntegration();

const inputCls =
  "clay-input w-full rounded-xl border bg-white px-3 py-1.5 text-xs dark:bg-background font-arabic";
const btnCls =
  "clay-button rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold font-arabic disabled:opacity-50";
const today = () => new Date().toISOString().slice(0, 10);

// ============================================================
// Free Law Project (CourtListener) — comparative research
// ============================================================

function CourtListenerPanel() {
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<CourtListenerSearchOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const tokenOn = isCourtListenerConfigured();

  const handleSearch = useCallback(async () => {
    if (!query.trim() || busy) return;
    setBusy(true);
    try {
      const res = await freeLaw.searchCourtListener(query.trim(), { topK: 5 });
      setOutcome(res);
    } finally {
      setBusy(false);
    }
  }, [query, busy]);

  return (
    <div className="clay-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-clay-blue" />
          <h3 className="text-sm font-bold font-arabic">
            البحث المقارن — Free Law Project (CourtListener)
          </h3>
        </div>
        <span
          className={`clay-badge text-[9px] px-2 py-0.5 rounded-full font-arabic ${
            tokenOn
              ? "bg-clay-green/10 text-clay-green"
              : "bg-urgency-high/10 text-urgency-high"
          }`}
        >
          {tokenOn ? "رمز API مفعل" : "بدون رمز — معدل محدود"}
        </span>
      </div>

      <div className="flex gap-2 mb-1">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="مثال: search-and-seizure probable cause warrant"
          className={inputCls}
        />
        <button
          onClick={handleSearch}
          disabled={busy || !query.trim()}
          className={`${btnCls} bg-clay-blue/10 text-clay-blue shrink-0`}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
          بحث
        </button>
      </div>
      <p className="text-[9px] text-muted-foreground font-arabic mb-2">
        قاعدة أحكام المحاكم الأمريكية (٨ ملايين حكم) — مرجع مقارن/دولي وليس سلطة مصرية. أضف{" "}
        <span className="font-mono" dir="ltr">VITE_COURTLISTENER_TOKEN</span> في تبويب المفاتيح لرفع حد
        الاستخدام.
      </p>

      {outcome && (
        <div className="space-y-2 max-h-64 overflow-y-auto ps-1">
          {outcome.live ? (
            outcome.hits.length === 0 ? (
              <p className="text-[10px] text-muted-foreground font-arabic py-3 text-center">
                لا توجد نتائج في مكتبة CourtListener
              </p>
            ) : (
              <>
                <p className="text-[9px] text-clay-blue bg-clay-blue/5 rounded-lg px-2 py-1 font-arabic">
                  {outcome.note}
                </p>
                {outcome.hits.map((h, i) => (
                  <div key={h.clusterId} className="rounded-xl border border-border bg-muted/20 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-clay-blue bg-clay-blue/10 rounded-lg px-1.5 py-0.5">
                            {i + 1}
                          </span>
                          <p className="text-[11px] font-bold text-foreground leading-snug" dir="ltr">
                            {h.caseName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground flex-wrap">
                          <span>{h.court || "محكمة غير محددة"}</span>
                          {h.dateFiled && <span>• {h.dateFiled}</span>}
                          {h.caseNumber && (
                            <span className="font-mono" dir="ltr">• {h.caseNumber}</span>
                          )}
                          {h.status && <span>• {h.status}</span>}
                        </div>
                        {h.snippet && (
                          <p className="text-[10px] text-muted-foreground font-arabic mt-1 leading-relaxed">
                            {h.snippet.length > 220 ? `${h.snippet.slice(0, 220)}…` : h.snippet}
                          </p>
                        )}
                      </div>
                      {h.absoluteUrl && (
                        <a
                          href={`https://www.courtlistener.com${h.absoluteUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-clay-blue shrink-0 mt-0.5"
                          title="فتح على CourtListener"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    {h.citation.length > 0 && (
                      <p className="text-[9px] text-clay-purple font-arabic mt-1">
                        الاستشهاد: {h.citation.join("، ")}
                      </p>
                    )}
                  </div>
                ))}
              </>
            )
          ) : (
            <>
              {outcome.note && (
                <p className="text-[9px] text-urgency-high bg-urgency-high/5 rounded-lg px-2 py-1 font-arabic">
                  {outcome.note}
                </p>
              )}
              {outcome.error && (
                <p className="text-[9px] text-urgency-critical bg-urgency-critical/5 rounded-lg px-2 py-1 font-arabic">
                  {outcome.error}
                </p>
              )}
              {outcome.hits.map((h, i) => (
                <div key={`${h.clusterId}-${i}`} className="rounded-xl border border-border bg-muted/20 p-2.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Landmark className="w-3 h-3 text-clay-green shrink-0" />
                    <span className="text-[9px] font-bold text-clay-green bg-clay-green/10 rounded-lg px-1.5 py-0.5 font-arabic">
                      بديل محلي — {h.court}
                    </span>
                    {h.caseNumber && (
                      <span className="text-[9px] text-clay-purple bg-clay-purple/10 rounded-lg px-1.5 py-0.5 font-arabic">
                        {h.caseNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-arabic text-foreground leading-relaxed">{h.caseName}</p>
                  {h.snippet && (
                    <p className="text-[9px] text-muted-foreground font-arabic mt-0.5">{h.snippet}</p>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ArkCase CE — case exchange
// ============================================================

function ArkCasePanel() {
  const [synced, setSynced] = useState<ArkCaseSyncedCaseRecord[]>([]);
  const [report, setReport] = useState<{ imported: number; skipped: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refresh = useCallback(async () => {
    setSynced(await ark.getSyncedCases());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleExport = useCallback(() => {
    const payload = ark.buildExchangePayload();
    downloadTextFile(
      JSON.stringify(payload, null, 2),
      `arkcase-cases-export-${today()}.json`,
      "application/json;charset=utf-8",
    );
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const parsed: unknown = JSON.parse(await file.text());
        const res = await ark.syncCases(parsed);
        setReport({ imported: res.imported, skipped: res.skipped });
        await refresh();
      } catch {
        setReport({ imported: 0, skipped: 0 });
      } finally {
        setBusy(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [refresh],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await ark.deleteSyncedCase(id);
      await refresh();
    },
    [refresh],
  );

  return (
    <div className="clay-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Landmark className="w-5 h-5 text-clay-purple" />
        <h3 className="text-sm font-bold font-arabic">تبادل القضايا — ArkCase (Community Edition)</h3>
      </div>

      <div className="flex items-center gap-2 flex-wrap mb-2">
        <button onClick={handleExport} className={`${btnCls} bg-clay-purple/10 text-clay-purple`}>
          <Download className="w-3.5 h-3.5" />
          تصدير ملف التبادل (JSON)
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={`${btnCls} bg-clay-teal/10 text-clay-teal`}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          استيراد من ArkCase
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </div>

      {report && (
        <p className="text-[10px] font-arabic mb-2 bg-muted/30 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-clay-teal shrink-0" />
          <span className="text-clay-green font-bold">{report.imported}</span> قضية مستوردة
          {report.skipped > 0 && (
            <>
              <span className="text-urgency-critical font-bold">{report.skipped}</span> صف تم تجاوزه
            </>
          )}
        </p>
      )}

      {synced.length === 0 ? (
        <p className="text-[10px] text-muted-foreground font-arabic py-2 text-center">
          لا توجد قضايا متزامنة — صدّر ملفاً من التطبيق، أو استورد ملف JSON قادماً من نسخة ArkCase ذاتية
          الاستضافة (تُحفظ محلياً بالكامل)
        </p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto ps-1">
          {synced.slice(0, 8).map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-border bg-muted/20 px-2.5 py-1.5 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-clay-purple bg-clay-purple/10 rounded px-1.5 py-0.5 font-arabic">
                    {c.caseCode}
                  </span>
                  {c.priority && (
                    <span className="text-[9px] text-urgency-critical font-bold font-arabic">{c.priority}</span>
                  )}
                </div>
                <p className="text-[10px] font-bold text-foreground font-arabic truncate mt-0.5">{c.title}</p>
                <p className="text-[9px] text-muted-foreground font-arabic truncate">
                  {[c.court, c.clientName, c.lawyer && `المحامي: ${c.lawyer}`].filter(Boolean).join(" • ")}
                </p>
              </div>
              <button
                onClick={() => void handleDelete(c.id)}
                className="text-muted-foreground hover:text-urgency-critical shrink-0"
                title="حذف"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {synced.length > 8 && (
            <p className="text-[9px] text-muted-foreground font-arabic text-center">
              + {synced.length - 8} قضية أخرى
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// OpenLawOffice — billing ledger + task/deadline sheet
// ============================================================

function OpenLawOfficePanel() {
  const [entries, setEntries] = useState<OloTimeEntryRecord[]>([]);
  const [tasks, setTasks] = useState<OloTaskRecord[]>([]);

  // Billing form
  const [caseCode, setCaseCode] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("1");
  const [rate, setRate] = useState("0");
  const [lawyer, setLawyer] = useState("");

  // Task form
  const [tCaseCode, setTCaseCode] = useState("");
  const [tTitle, setTTitle] = useState("");
  const [tDue, setTDue] = useState("");

  const refresh = useCallback(async () => {
    const [e, t] = await Promise.all([olo.listTimeEntries(), olo.listTasks()]);
    setEntries(e);
    setTasks(t);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addEntry = useCallback(async () => {
    const h = parseFloat(hours);
    if (!caseCode.trim() || !description.trim() || Number.isNaN(h) || h <= 0) return;
    await olo.addTimeEntry({
      caseCode: caseCode.trim(),
      description: description.trim(),
      date: today(),
      hours: h,
      rate: parseFloat(rate) || 0,
      lawyer: lawyer.trim() || "غير محدد",
    });
    setDescription("");
    setHours("1");
    await refresh();
  }, [caseCode, description, hours, rate, lawyer, refresh]);

  const addTask = useCallback(async () => {
    if (!tCaseCode.trim() || !tTitle.trim()) return;
    await olo.addTask({
      caseCode: tCaseCode.trim(),
      title: tTitle.trim(),
      dueDate: tDue || today(),
    });
    setTTitle("");
    await refresh();
  }, [tCaseCode, tTitle, tDue, refresh]);

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const totalValue = entries.reduce((sum, e) => sum + e.hours * e.rate, 0);

  return (
    <div className="clay-card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-clay-rose" />
          <h3 className="text-sm font-bold font-arabic">مزامنة المكتب — OpenLawOffice</h3>
        </div>
        <span className="clay-badge text-[9px] bg-clay-rose/10 text-clay-rose px-2 py-0.5 rounded-full font-arabic">
          محلي + تصدير CSV
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Billing */}
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-[11px] font-bold text-clay-rose font-arabic flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> سجل الساعات والفواتير
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input value={caseCode} onChange={(e) => setCaseCode(e.target.value)} placeholder="رقم القضية" className={inputCls} />
            <input value={lawyer} onChange={(e) => setLawyer(e.target.value)} placeholder="المحامي" className={inputCls} />
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void addEntry()}
            placeholder="وصف العمل (مثال: حضوري جلسة محكمة جنايات)"
            className={inputCls}
          />
          <div className="flex items-center gap-2">
            <input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              type="number"
              min="0.25"
              step="0.25"
              className={`${inputCls} w-20`}
            />
            <span className="text-[10px] text-muted-foreground font-arabic">ساعة</span>
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              type="number"
              min="0"
              step="50"
              className={`${inputCls} w-28`}
            />
            <span className="text-[10px] text-muted-foreground font-arabic">ج.م/ساعة</span>
            <button
              onClick={() => void addEntry()}
              className={`${btnCls} bg-clay-rose/10 text-clay-rose ms-auto`}
            >
              <Plus className="w-3.5 h-3.5" /> إضافة
            </button>
          </div>

          {entries.length > 0 && (
            <>
              <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold font-arabic">
                <span className="text-clay-green">
                  الإجمالي: {Math.round(totalHours * 100) / 100} ساعة
                </span>
                <span className="text-clay-rose">
                  ≈ {Math.round(totalValue).toLocaleString("ar-EG")} ج.م
                </span>
                <button
                  onClick={() =>
                    downloadTextFile(
                      olo.exportBillingCsv(entries),
                      `olo-billing-${today()}.csv`,
                    )
                  }
                  className={`${btnCls} bg-muted/50 text-muted-foreground !px-2 !py-1 ms-auto`}
                >
                  <Download className="w-3 h-3" /> CSV
                </button>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto ps-1">
                {entries.slice(0, 6).map((e) => (
                  <div
                    key={e.id}
                    className="rounded-lg bg-muted/20 px-2 py-1 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold font-arabic truncate">
                        <span className="text-clay-rose">{e.caseCode}</span> — {e.description}
                      </p>
                      <p className="text-[9px] text-muted-foreground font-arabic">
                        {e.date} • {e.lawyer} • {e.hours} س × {e.rate}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await olo.deleteTimeEntry(e.id);
                        await refresh();
                      }}
                      className="text-muted-foreground hover:text-urgency-critical shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tasks */}
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-[11px] font-bold text-clay-teal font-arabic flex items-center gap-1.5">
            <ListChecks className="w-3.5 h-3.5" /> المهام والمواعيد
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input value={tCaseCode} onChange={(e) => setTCaseCode(e.target.value)} placeholder="رقم القضية" className={inputCls} />
            <input value={tDue} onChange={(e) => setTDue(e.target.value)} type="date" className={inputCls} />
          </div>
          <div className="flex items-center gap-2">
            <input
              value={tTitle}
              onChange={(e) => setTTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addTask()}
              placeholder="المهمة (مثال: تجهيز مذكرة دفاع — ميعاد قانوني)"
              className={inputCls}
            />
            <button
              onClick={() => void addTask()}
              className={`${btnCls} bg-clay-teal/10 text-clay-teal shrink-0`}
            >
              <Plus className="w-3.5 h-3.5" /> إضافة
            </button>
          </div>

          {tasks.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground font-arabic">
                  {tasks.filter((t) => t.status === "معلق").length} معلقة •{" "}
                  {tasks.filter((t) => t.status === "مكتمل").length} مكتملة
                </span>
                <button
                  onClick={() =>
                    downloadTextFile(olo.exportTasksCsv(tasks), `olo-tasks-${today()}.csv`)
                  }
                  className={`${btnCls} bg-muted/50 text-muted-foreground !px-2 !py-1`}
                >
                  <Download className="w-3 h-3" /> CSV
                </button>
              </div>
              <div className="space-y-1 max-h-36 overflow-y-auto ps-1">
                {tasks.slice(0, 6).map((t) => {
                  const overdue = t.dueDate < today() && t.status === "معلق";
                  return (
                    <div
                      key={t.id}
                      className="rounded-lg bg-muted/20 px-2 py-1 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p
                          className={`text-[10px] font-bold font-arabic truncate ${
                            t.status === "مكتمل" ? "line-through opacity-60" : ""
                          }`}
                        >
                          <span className="text-clay-teal">{t.caseCode}</span> — {t.title}
                        </p>
                        <p
                          className={`text-[9px] font-arabic ${
                            overdue ? "text-urgency-critical font-bold" : "text-muted-foreground"
                          }`}
                        >
                          استحقاق: {t.dueDate}
                          {overdue ? " — متأخرة!" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {t.status === "معلق" && (
                          <button
                            onClick={async () => {
                              await olo.toggleTask(t.id, true);
                              await refresh();
                            }}
                            className="text-clay-green hover:opacity-70"
                            title="إكمال"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            await olo.deleteTask(t.id);
                            await refresh();
                          }}
                          className="text-muted-foreground hover:text-urgency-critical"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Desk
// ============================================================

export function OpenSourceSyncDesk() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-border" />
        <span className="clay-badge text-[10px] bg-clay-purple/10 text-clay-purple px-2.5 py-1 rounded-full font-arabic">
          تكاملات المصادر المفتوحة (حرة بالكامل — تعمل دون خادم وسيط)
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <CourtListenerPanel />
      <ArkCasePanel />
      <OpenLawOfficePanel />
    </div>
  );
}
