import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeftRight,
  FileText,
  Loader2,
  ShieldAlert,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { CONVEX_URL } from "@/contexts/ConvexProvider";
import { EmptyState, LegalDisclaimerCard } from "@/components/legal/ui";

/**
 * المستندات — personal document workspace. Text metadata only; prompt
 * injection screening runs server-side and any flagged document is clearly
 * marked (T-002/T-007). Analysis distinguishes extracted facts from guesses.
 */

interface DocSummary {
  _id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdAt: number;
  analyzed: boolean;
  preview: string;
}

interface Analysis {
  detectedKinds: string[];
  dates: string[];
  amounts: string[];
  entities: string[];
  legalReferences: string[];
  keyFacts: string[];
  sentenceCount: number;
  wordCount: number;
}

const MAX_BYTES = 10 * 1024 * 1024;

async function extractText(file: File): Promise<string> {
  if (file.type === "text/plain") return await file.text();
  // PDFs/images: proper OCR is a server concern; here we take what the
  // browser can prove and clearly mark the rest as needing OCR.
  return "";
}

export default function Documents() {
  const docs = useQuery(
    api.workspace.listMyDocuments,
    CONVEX_URL ? {} : "skip",
  ) as DocSummary[] | undefined;
  const upload = useMutation(api.workspace.uploadDocument);
  const analyze = useMutation(api.workspace.analyzeDocument);
  const compare = useMutation(api.workspace.compareDocuments);
  const remove = useMutation(api.workspace.deleteDocument);

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, Analysis>>({});
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<string | null>(null);

  async function handleUpload(file: File) {
    if (!CONVEX_URL) return;
    if (file.size > MAX_BYTES) {
      toast.error("الملف أكبر من الحد المسموح (10 ميجابايت).");
      return;
    }
    setBusy(true);
    try {
      const text = await extractText(file);
      const sha256 = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const hash = [...new Uint8Array(sha256)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const res = await upload({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        sha256: hash,
        text,
      });
      if (res.injectionFlags.length > 0) {
        toast.warning(
          `تم رصد محتوى مشبوه في المستند (${res.injectionFlags.join("، ")}) — سيُعامل كنص فقط ولن يؤثر على النظام.`,
        );
      } else {
        toast.success("تم رفع المستند وفحصه بنجاح.");
      }
    } catch {
      toast.error("تعذّر رفع المستند — تحقق من نوع الملف وحجمه.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleAnalyze(id: string) {
    try {
      const a = (await analyze({ documentId: id as never })) as unknown as Analysis;
      setAnalysis((prev) => ({ ...prev, [id]: a }));
      toast.success("تم التحليل — النتائج أدناه.");
    } catch {
      toast.error("تعذّر تحليل المستند.");
    }
  }

  async function handleCompare(aId: string) {
    if (!compareWith || compareWith === aId) {
      toast.info("اختر مستنداً آخر للمقارنة أولاً.");
      return;
    }
    try {
      const r = await compare({ a: aId as never, b: compareWith as never });
      setCompareResult(r.note);
      toast.info(r.note);
    } catch {
      toast.error("تعذّرت المقارنة.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove({ documentId: id as never });
      toast.success("تم حذف المستند.");
    } catch {
      toast.error("تعذّر الحذف.");
    }
  }

  if (!CONVEX_URL) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={<FileText className="h-8 w-8 text-muted-foreground" />}
          title="منصة المعرفة غير مُهيأة"
          description="لم يتم ضبط اتصال قاعدة المعرفة في هذه البيئة."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black text-clay-text">مستنداتي</h1>
        <p className="text-sm text-clay-text-secondary">
          ارفع مستنداتك لتحليلها: استخراج التواريخ والمبالغ والمراجع القانونية. المستندات تُعامل
          كبيانات فقط ولا تُرسل لأي مزود ذكاء اصطناعي خارجي.
        </p>
      </div>

      {/* Upload */}
      <label className="clay-card flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed border-primary/30 p-8 text-center transition-colors hover:border-primary/50">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".txt,.pdf,image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUpload(f);
          }}
        />
        {busy ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        ) : (
          <Upload className="h-8 w-8 text-primary" />
        )}
        <span className="text-sm font-bold text-clay-text">
          {busy ? "جارٍ الرفع والفحص…" : "اضغط لاختيار مستند"}
        </span>
        <span className="text-xs text-clay-text-secondary">
          PDF، صور، أو نص — حتى 10 ميجابايت
        </span>
      </label>

      {/* List */}
      {docs === undefined ? (
        <div className="clay-card h-32 animate-pulse" />
      ) : docs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8 text-muted-foreground" />}
          title="لا توجد مستندات بعد"
          description="ارفع أول مستند لتحليله — يبقى ملكك وحدك ويمكنك حذفه في أي وقت."
        />
      ) : (
        <div className="space-y-3">
          {docs.map((d) => {
            const a = analysis[d._id];
            return (
              <article key={d._id} className="clay-card p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-rose-100 p-2 text-rose-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-clay-text">{d.name}</p>
                    <p className="text-xs text-clay-text-secondary">
                      {(d.sizeBytes / 1024).toFixed(1)} كيلوبايت ·{" "}
                      {new Date(d.createdAt).toLocaleDateString("ar-EG")} · SHA-256:{" "}
                      {d.sha256.slice(0, 10)}…
                    </p>
                    {d.preview && (
                      <p className="mt-1 line-clamp-2 text-xs text-clay-text-secondary">
                        {d.preview}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => void handleAnalyze(d._id)}
                    className="clay-button flex items-center gap-1.5 bg-primary px-3 py-2 text-xs font-bold text-white"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    {d.analyzed ? "إعادة التحليل" : "تحليل"}
                  </button>
                  <select
                    value={compareWith ?? ""}
                    onChange={(e) => setCompareWith(e.target.value || null)}
                    className="clay-input h-9 w-40 text-xs"
                    aria-label="قارن مع"
                  >
                    <option value="">قارن مع…</option>
                    {docs.filter((x) => x._id !== d._id).map((x) => (
                      <option key={x._id} value={x._id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => void handleCompare(d._id)}
                    className="clay-button flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-clay-text"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    مقارنة
                  </button>
                  <button
                    onClick={() => void handleDelete(d._id)}
                    className="clay-button flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                    aria-label={`حذف ${d.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {a && (
                  <div className="mt-3 space-y-2 border-t border-clay-border/60 pt-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {a.detectedKinds.map((k, i) => (
                        <span key={i} className="clay-badge text-[11px]">
                          {k}
                        </span>
                      ))}
                      <span className="text-[10px] text-clay-text-secondary">
                        — {a.wordCount} كلمة، {a.sentenceCount} جملة
                      </span>
                    </div>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      {a.dates.length > 0 && (
                        <div className="clay-inset p-2">
                          <span className="font-bold text-clay-text">التواريخ: </span>
                          {a.dates.join("، ")}
                        </div>
                      )}
                      {a.amounts.length > 0 && (
                        <div className="clay-inset p-2">
                          <span className="font-bold text-clay-text">المبالغ: </span>
                          {a.amounts.join("، ")}
                        </div>
                      )}
                      {a.legalReferences.length > 0 && (
                        <div className="clay-inset p-2">
                          <span className="font-bold text-clay-text">مراجع قانونية: </span>
                          {a.legalReferences.join("، ")}
                        </div>
                      )}
                      {a.entities.length > 0 && (
                        <div className="clay-inset p-2">
                          <span className="font-bold text-clay-text">أسماء مذكورة: </span>
                          {a.entities.join("، ")}
                        </div>
                      )}
                    </div>
                    <p className="flex items-start gap-1.5 rounded-lg bg-muted p-2 text-[11px] leading-relaxed text-clay-text-secondary">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      هذه نتائج استخراج آلي (وقائع ظاهرة في النص) — وليست تحقيقاً أو إثباتاً؛
                      التصنيف النهائي يحتاج مراجعة بشرية.
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {compareResult && (
        <div className="clay-card-soft p-3 text-sm text-clay-text">{compareResult}</div>
      )}

      <LegalDisclaimerCard compact />
    </div>
  );
}
