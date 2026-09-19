import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FlaskConical, Loader2, PlayCircle, XCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CONVEX_URL } from "@/contexts/ConvexProvider";
import { EmptyState, StatusBadge } from "@/components/legal/ui";

/**
 * تقييم الذكاء الاصطناعي — runs TEST-001..010 against the live pipeline.
 * Covers: supported answer, abstention, invented article rejection,
 * outdated detection, conflict detection, document injection as DATA,
 * IDOR, historical retrieval, current retrieval, and entailment.
 */

interface RunRow {
  _id: string;
  knowledgeVersion: string;
  total: number;
  passed: number;
  failed: number;
  results: Array<{ code: string; passed: boolean; expected: string; actual: string; note?: string }>;
  createdAt: number;
}

const CASE_DESCRIPTIONS: Record<string, string> = {
  "TEST-001": "سؤال له مادة داعمة مباشرة → مدعوم",
  "TEST-002": "سؤال بلا أدلة → امتناع صريح",
  "TEST-003": "إجابة تخترع مادة 999 → تُرفض",
  "TEST-004": "مصدر ملغي → يُوسم قديم",
  "TEST-005": "مصدران متعارضان → كشف التعارض",
  "TEST-006": "مستند يحوي تعليمات خبيثة → يُعامل كبيانات",
  "TEST-007": "مستخدم يصل لمستند آخر → 403",
  "TEST-008": "سؤال تاريخي → نسخة تاريخية",
  "TEST-009": "سؤال حالي → النسخة السارية",
  "TEST-010": "استشهاد لا يدعم الادعاء → غير مدعوم",
};

export default function AdminEvaluation() {
  const [running, setRunning] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const runs = useQuery(
    api.admin.latestEvaluationRuns,
    CONVEX_URL && !roleError ? { limit: 5 } : "skip",
  ) as RunRow[] | undefined;
  const runEval = useAction(api.admin.runEvaluation);

  if (!CONVEX_URL) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={<FlaskConical className="h-8 w-8 text-muted-foreground" />}
          title="منصة المعرفة غير مُهيأة"
        />
      </div>
    );
  }

  if (roleError) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-black text-clay-text">تقييم الذكاء الاصطناعي</h1>
        <div className="clay-card mt-4 p-6 text-center text-sm font-bold text-clay-text">
          {roleError}
        </div>
      </div>
    );
  }

  const latest = runs?.[0];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black text-clay-text">تقييم الذكاء الاصطناعي</h1>
        <p className="text-sm text-clay-text-secondary">
          تشغيل 10 اختبارات معيارية على خط الأدلة الحقيقي: الامتناع عند نقص الأدلة، رفض الاختراع،
          كشف التعارض، والصلاحية الزمنية.
        </p>
      </div>

      {/* Run button + latest summary */}
      <div className="clay-card flex items-center gap-4 p-4">
        <div className="flex-1">
          {latest ? (
            <>
              <p className="text-sm font-bold text-clay-text">
                آخر تشغيل: {latest.passed}/{latest.total} ناجح
              </p>
              <p className="text-xs text-clay-text-secondary">
                {new Date(latest.createdAt).toLocaleString("ar-EG")} · إصدار المعرفة{" "}
                {latest.knowledgeVersion}
              </p>
            </>
          ) : (
            <p className="text-sm text-clay-text-secondary">لم يُشغَّل التقييم بعد.</p>
          )}
        </div>
        <button
          onClick={async () => {
            setRunning(true);
            try {
              const r = await runEval({});
              toast.success(`انتهى التقييم: ${r.passed}/${r.total} ناجح`);
            } catch (e) {
              const msg = e instanceof Error ? e.message : "";
              if (msg.includes("FORBIDDEN")) {
                setRoleError("تقييم النظام متاح للمراجعين فقط — اطلب الصلاحية من لوحة المعرفة.");
              } else {
                toast.error("تعذّر تشغيل التقييم.");
              }
            } finally {
              setRunning(false);
            }
          }}
          disabled={running}
          className="clay-button flex items-center gap-2 bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          تشغيل الاختبارات
        </button>
      </div>

      {/* Latest run details */}
      {latest && (
        <section className="space-y-2">
          <h2 className="text-sm font-black text-clay-text">نتائج آخر تشغيل</h2>
          {latest.results.map((r) => (
            <div
              key={r.code}
              className={`clay-card flex items-start gap-3 p-3 ${r.passed ? "" : "border-e-4 border-e-red-400"}`}
            >
              {r.passed ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-clay-text">
                  {r.code} — {CASE_DESCRIPTIONS[r.code] ?? r.expected}
                </p>
                <p className="mt-0.5 text-xs text-clay-text-secondary">
                  المتوقع: {r.expected} · الناتج: {r.actual}
                  {r.note && ` — ${r.note}`}
                </p>
              </div>
              <StatusBadge status={r.passed ? "SUPPORTED" : "UNSUPPORTED"} />
            </div>
          ))}
        </section>
      )}

      {/* History */}
      {runs && runs.length > 1 && (
        <section>
          <h2 className="mb-2 text-sm font-black text-clay-text">سجل التشغيلات</h2>
          <div className="space-y-1.5">
            {runs.slice(1).map((r) => (
              <div key={r._id} className="clay-card-soft flex items-center gap-2 p-2.5 text-xs">
                <span className="font-bold text-clay-text">
                  {r.passed}/{r.total}
                </span>
                <span className="text-clay-text-secondary">{r.knowledgeVersion}</span>
                <span className="ms-auto text-[10px] text-clay-text-secondary">
                  {new Date(r.createdAt).toLocaleString("ar-EG")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
