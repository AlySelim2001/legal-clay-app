import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileCheck2,
  GitCommitVertical,
  Lock,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CONVEX_URL } from "@/contexts/ConvexProvider";
import { EmptyState, StatusBadge } from "@/components/legal/ui";

/**
 * لوحة الإدارة — مصادر ومراجعة. Human review workflow: submit → review →
 * publish. The AI never publishes; each action is audited (P-05, P-09).
 */

interface SourceRow {
  _id: string;
  title: string;
  sourceType: string;
  publisher?: string;
  officialUrl?: string;
  version: string;
  status: string;
  verificationStatus: string;
}

interface AuditRow {
  _id: string;
  action: string;
  userId?: string;
  targetType?: string;
  targetId?: string;
  details?: string;
  createdAt: number;
}

interface Health {
  knowledge: { publishedSources: number; pendingReviews: number; chunks: number };
  activity: { answersStored: number; recentAuditCount: number };
  evaluation: { at: number; passed: number; total: number } | null;
}

export default function AdminKnowledge() {
  const [roleError, setRoleError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<string | null>("REVIEW_PENDING");

  const claim = useMutation(api.admin.claimReviewerRole);
  const sources = useQuery(
    api.legal.listSources,
    CONVEX_URL && !roleError ? { limit: 100 } : "skip",
  ) as SourceRow[] | undefined;
  const audits = useQuery(
    api.admin.adminAuditLogs,
    CONVEX_URL && !roleError ? { limit: 30 } : "skip",
  ) as AuditRow[] | undefined;
  const health = useQuery(
    api.admin.systemHealth,
    CONVEX_URL && !roleError ? {} : "skip",
  ) as Health | undefined;
  const versions = useQuery(
    api.admin.knowledgeVersionsList,
    CONVEX_URL && !roleError ? {} : "skip",
  ) as Array<{ _id: string; version: string; createdAt: number; notes?: string }> | undefined;

  const review = useMutation(api.admin.reviewSource);
  const publish = useMutation(api.admin.publishSource);
  const submit = useMutation(api.admin.submitSource);

  function handleForbidden(e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("FORBIDDEN")) {
      setRoleError("هذه اللوحة للمراجعين المعتمدين فقط — اطلب صلاحية المراجعة أولاً.");
    } else if (msg.includes("UNAUTHENTICATED")) {
      setRoleError("جلسة غير صالحة — أعد تحميل الصفحة.");
    } else if (msg.includes("INVALID_STATE")) {
      toast.error("حالة المصدر لا تسمح بهذا الإجراء.");
    } else {
      toast.error("تعذّر تنفيذ الإجراء.");
    }
  }

  if (!CONVEX_URL) {
    return (
      <div className="mx-auto max-w-4xl">
        <EmptyState
          icon={<ShieldCheck className="h-8 w-8 text-muted-foreground" />}
          title="منصة المعرفة غير مُهيأة"
        />
      </div>
    );
  }

  // ---- Not a reviewer yet: offer the audited claim button ----
  if (roleError) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <h1 className="text-2xl font-black text-clay-text">لوحة إدارة المعرفة</h1>
        <div className="clay-card p-6 text-center">
          <Lock className="mx-auto h-10 w-10 text-amber-600" />
          <p className="mt-3 text-sm font-bold text-clay-text">{roleError}</p>
          <p className="mt-1 text-xs leading-relaxed text-clay-text-secondary">
            الصلاحية تُمنح ذاتياً وتُسجَّل في سجل التدقيق دائماً — أول حساب يطالب بالصلاحية يصبح
            مديراً، وما بعده مراجعاً.
          </p>
          <button
            onClick={async () => {
              try {
                const r = await claim({});
                setRoleError(null);
                toast.success(`تم تسجيل دورك: ${r.role === "admin" ? "مدير" : "مراجع"}`);
              } catch (e) {
                handleForbidden(e);
              }
            }}
            className="clay-button mt-4 bg-primary px-5 py-2.5 text-sm font-bold text-white"
          >
            <ShieldCheck className="me-1.5 inline h-4 w-4" />
            طلب صلاحية المراجعة (يُسجَّل بالتدقيق)
          </button>
        </div>
      </div>
    );
  }

  const pending = (sources ?? []).filter((s) => s.status === "REVIEW_PENDING");
  const approved = (sources ?? []).filter((s) => s.status === "APPROVED");
  const shown = filter === "REVIEW_PENDING" ? pending : filter === "APPROVED" ? approved : (sources ?? []);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-clay-text">لوحة إدارة المعرفة</h1>
        <p className="text-sm text-clay-text-secondary">
          مراجعة المصادر واعتمادها ونشرها — كل إجراء يُسجَّل في سجل التدقيق.
        </p>
      </div>

      {/* Health */}
      {health && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "مصادر منشورة", value: health.knowledge.publishedSources },
            { label: "بانتظار المراجعة", value: health.knowledge.pendingReviews },
            { label: "مقاطع مفهرسة", value: health.knowledge.chunks },
            { label: "إجابات مخزنة", value: health.activity.answersStored },
          ].map((k) => (
            <div key={k.label} className="clay-card p-3 text-center">
              <p className="text-xl font-black text-primary">{k.value}</p>
              <p className="text-[11px] text-clay-text-secondary">{k.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Submit new source */}
      <details className="clay-card p-4">
        <summary className="cursor-pointer text-sm font-bold text-clay-text">
          إضافة مصدر جديد (يدخل قائمة المراجعة)
        </summary>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            try {
              await submit({
                title: String(fd.get("title") ?? ""),
                sourceType: String(fd.get("sourceType") ?? "statute"),
                publisher: String(fd.get("publisher") ?? "") || undefined,
                officialUrl: String(fd.get("officialUrl") ?? "") || undefined,
                version: String(fd.get("version") ?? "1.0"),
              });
              toast.success("أُرسل المصدر لقائمة المراجعة.");
            } catch (err) {
              handleForbidden(err);
            }
          }}
        >
          <input name="title" required minLength={5} placeholder="عنوان المصدر" className="clay-input h-10 text-sm" dir="rtl" />
          <select name="sourceType" className="clay-input h-10 text-sm" aria-label="نوع المصدر">
            <option value="statute">قانون</option>
            <option value="regulation">لائحة</option>
            <option value="constitution">دستور</option>
            <option value="decree">مرسوم</option>
            <option value="portal">بوابة رسمية</option>
          </select>
          <input name="publisher" placeholder="الجهة المصدرة" className="clay-input h-10 text-sm" dir="rtl" />
          <input name="officialUrl" type="url" placeholder="الرابط الرسمي" className="clay-input h-10 text-sm" dir="ltr" />
          <input name="version" defaultValue="1.0" className="clay-input h-10 text-sm" dir="ltr" />
          <button type="submit" className="clay-button bg-primary px-4 py-2 text-sm font-bold text-white">
            إرسال للمراجعة
          </button>
        </form>
      </details>

      {/* Review queue */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-black text-clay-text">طابور المراجعة</h2>
          <div className="ms-auto flex gap-1.5">
            {[
              ["REVIEW_PENDING", "بانتظار المراجعة"],
              ["APPROVED", "معتمد"],
              [null, "الكل"],
            ].map(([key, label]) => (
              <button
                key={String(label)}
                onClick={() => setFilter(key)}
                className={`clay-badge text-xs ${filter === key ? "bg-primary text-white" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {sources === undefined ? (
          <div className="clay-card h-24 animate-pulse" />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<FileCheck2 className="h-8 w-8 text-muted-foreground" />}
            title="لا مصادر في هذا التصنيف"
          />
        ) : (
          <div className="space-y-2">
            {shown.map((s) => (
              <article key={s._id} className="clay-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-clay-text">{s.title}</span>
                  <span className="text-xs text-clay-text-secondary">نسخة {s.version}</span>
                  <div className="ms-auto flex items-center gap-1.5">
                    <StatusBadge status={s.status} />
                    <StatusBadge status={s.verificationStatus} />
                  </div>
                </div>
                {s.officialUrl && (
                  <a
                    href={s.officialUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    المصدر الرسمي
                  </a>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={notes[s._id] ?? ""}
                    onChange={(e) => setNotes((p) => ({ ...p, [s._id]: e.target.value }))}
                    placeholder="ملاحظات المراجعة…"
                    className="clay-input h-9 flex-1 text-xs"
                    dir="rtl"
                  />
                  {s.status === "REVIEW_PENDING" && (
                    <>
                      <button
                        onClick={async () => {
                          try {
                            await review({ sourceId: s._id as never, decision: "approve", notes: notes[s._id] });
                            toast.success("تم الاعتماد — جاهز للنشر.");
                          } catch (e) {
                            handleForbidden(e);
                          }
                        }}
                        className="clay-button flex items-center gap-1 bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        اعتماد
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await review({ sourceId: s._id as never, decision: "reject", notes: notes[s._id] });
                            toast.info("تم الرفض.");
                          } catch (e) {
                            handleForbidden(e);
                          }
                        }}
                        className="clay-button flex items-center gap-1 bg-red-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        رفض
                      </button>
                    </>
                  )}
                  {s.status === "APPROVED" && (
                    <button
                      onClick={async () => {
                        try {
                          await publish({ sourceId: s._id as never });
                          toast.success("تم النشر — المصدر متاح الآن للإجابات.");
                        } catch (e) {
                          handleForbidden(e);
                        }
                      }}
                      className="clay-button flex items-center gap-1 bg-primary px-3 py-2 text-xs font-bold text-white"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      نشر
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Knowledge versions */}
      {versions && versions.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-lg font-black text-clay-text">
            <GitCommitVertical className="h-5 w-5 text-primary" />
            إصدارات المعرفة
          </h2>
          <div className="space-y-1.5">
            {versions.slice(0, 5).map((v) => (
              <div key={v._id} className="clay-card-soft flex items-center gap-3 p-3 text-sm">
                <span className="font-bold text-clay-text">{v.version}</span>
                <span className="text-xs text-clay-text-secondary">{v.notes}</span>
                <span className="ms-auto text-[10px] text-clay-text-secondary">
                  {new Date(v.createdAt).toLocaleString("ar-EG")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Audit */}
      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-lg font-black text-clay-text">
          <Activity className="h-5 w-5 text-primary" />
          سجل التدقيق
        </h2>
        {audits === undefined ? (
          <div className="clay-card h-20 animate-pulse" />
        ) : (
          <div className="clay-card divide-y divide-clay-border/50">
            {audits.map((a) => (
              <div key={a._id} className="flex items-center gap-2 p-2.5 text-xs">
                <span className="rounded bg-muted px-1.5 py-0.5 font-bold text-clay-text">
                  {a.action}
                </span>
                <span className="truncate text-clay-text-secondary">
                  {a.targetType ? `${a.targetType} · ` : ""}
                  {a.details ?? ""}
                </span>
                <span className="ms-auto shrink-0 text-[10px] text-clay-text-secondary">
                  {new Date(a.createdAt).toLocaleString("ar-EG")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
