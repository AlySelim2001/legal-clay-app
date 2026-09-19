import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, Gavel, Loader2, Search, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { CONVEX_URL } from "@/contexts/ConvexProvider";
import {
  ABSTAIN_MESSAGE,
  CitationCard,
  ConfidenceMeter,
  EmptyState,
  LegalDisclaimerCard,
  StatusBadge,
  WarningStrip,
} from "@/components/legal/ui";

/**
 * اسأل القانون — the evidence-first Q&A experience.
 * The answer is composed server-side from retrieved evidence only; the client
 * renders claims with their citations and the "لماذا ظهرت هذه النتيجة؟" trail.
 */

interface PipelineResult {
  answer: string;
  claims: Array<{ text: string; status: string; chunkIds: string[] }>;
  citations: Array<{
    chunkId: string;
    sourceTitle: string;
    sourceType: string;
    officialUrl?: string;
    provenance: string;
    text: string;
    validity: string;
    verificationStatus: string;
  }>;
  evidenceStatus: string;
  confidence: {
    retrievalQuality: number;
    evidenceQuality: number;
    citationQuality: number;
    temporalValidity: number;
    answerSupport: number;
    overall: number;
  };
  warnings: string[];
  knowledgeVersion: string;
  retrievalVersion: string;
  modelName: string;
}

const EXAMPLES = [
  "كم مدة الطعن بالمعارضة في الأحكام الغيابية؟",
  "ما عقوبة الازدراء الديني؟",
  "ما هي الجهة المسؤولة عن شكاوى الإنترنت؟",
];

export default function Ask() {
  const [params, setParams] = useSearchParams();
  const answerId = params.get("answerId");
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const ask = useAction(api.legal.askLegal);
  const saved = useQuery(
    api.legal.answerWithCitations,
    answerId && CONVEX_URL ? { answerId: answerId as never } : "skip",
  );

  // Loading a saved answer from history
  useEffect(() => {
    if (saved) {
      queueMicrotask(() =>
        setResult({
          answer: saved.answer.answer,
          claims: saved.answer.claims,
          citations: [],
          evidenceStatus: saved.answer.evidenceStatus,
          confidence: saved.answer.confidence,
          warnings: saved.answer.warnings,
          knowledgeVersion: saved.answer.knowledgeVersion,
          retrievalVersion: saved.answer.retrievalVersion,
          modelName: saved.answer.modelName,
        }),
      );
    }
  }, [saved]);

  async function submit(q: string) {
    const text = q.trim();
    if (text.length < 5 || !CONVEX_URL) return;
    setPending(true);
    setError(null);
    try {
      const res = (await ask({ question: text })) as unknown as PipelineResult & {
        answerId?: string;
      };
      setResult(res);
      setParams(res.answerId ? { answerId: res.answerId } : {});
      requestAnimationFrame(() =>
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes("RATE_LIMIT")
          ? "تجاوزت حد الأسئلة المسموح مؤقتاً — انتظر دقيقة وأعد المحاولة."
          : "تعذّر تنفيذ الاستعلام — أعد المحاولة بعد قليل.",
      );
    } finally {
      setPending(false);
    }
  }

  if (!CONVEX_URL) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={<Search className="h-8 w-8 text-muted-foreground" />}
          title="منصة المعرفة غير مُهيأة"
          description="لم يتم ضبط اتصال قاعدة المعرفة في هذه البيئة."
        />
      </div>
    );
  }

  const isAbstain = result?.answer === ABSTAIN_MESSAGE;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-black text-clay-text">اسأل القانون</h1>
        <p className="text-sm text-clay-text-secondary">
          اسأل عن حقك أو إجراء ما — الإجابة تُبنى من المصادر المنشورة فقط مع إسناد كامل.
        </p>
      </div>

      {/* Composer */}
      <form
        className="clay-card flex items-end gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(question);
        }}
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit(question);
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder="مثال: ما مدة استئناف حكم جنائي؟"
          className="clay-input min-h-11 flex-1 resize-none text-sm"
          dir="rtl"
        />
        <button
          type="submit"
          disabled={pending || question.trim().length < 5}
          className="clay-button flex h-11 items-center gap-2 bg-primary px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          اسأل
        </button>
      </form>

      {/* Examples */}
      {!result && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setQuestion(ex);
                void submit(ex);
              }}
              className="clay-badge text-xs hover:bg-clay-surface"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Result */}
      <div ref={resultRef}>
        {result && (
          <div className="space-y-4">
            <div className="clay-card p-5">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={result.evidenceStatus} />
                <span className="text-[10px] text-clay-text-secondary">
                  {result.knowledgeVersion} · {result.retrievalVersion}
                </span>
              </div>
              <p
                className={
                  isAbstain
                    ? "text-sm font-bold leading-relaxed text-amber-800"
                    : "text-base leading-relaxed text-clay-text"
                }
              >
                {result.answer}
              </p>
            </div>

            <WarningStrip warnings={result.warnings} />

            {/* Claims with per-claim support status */}
            {result.claims.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-black text-clay-text">الادعاءات المستخرجة</h3>
                {result.claims.map((c, i) => (
                  <div key={i} className="clay-card-soft flex items-start gap-2 p-3">
                    <Gavel className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="flex-1 text-sm leading-relaxed text-clay-text">{c.text}</p>
                    <StatusBadge status={c.status} />
                  </div>
                ))}
              </div>
            )}

            {/* Evidence trail */}
            {result.citations.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-black text-clay-text">الأدلة والمصادر</h3>
                {result.citations.map((c, i) => (
                  <CitationCard
                    key={i}
                    sourceTitle={c.sourceTitle}
                    sourceType={c.sourceType}
                    officialUrl={c.officialUrl}
                    provenance={c.provenance}
                    excerpt={c.text}
                    status={c.validity === "CURRENT" ? c.verificationStatus : c.validity}
                  />
                ))}
              </div>
            )}

            <ConfidenceMeter confidence={result.confidence} />

            <p className="text-center text-[10px] leading-relaxed text-clay-text-secondary">
              نموذج التوليد: {result.modelName}
            </p>
          </div>
        )}
      </div>

      {/* History link */}
      <div className="flex justify-center">
        <Link
          to="/app/legal/history"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          سجل أسئلتك السابقة
        </Link>
      </div>

      <LegalDisclaimerCard />
    </div>
  );
}
