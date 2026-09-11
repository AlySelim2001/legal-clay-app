import { useEffect, useRef, useState } from "react";
import {
  announce,
  listenOnce,
  speak,
  stopSpeaking,
  sttSupport,
} from "@/a11y/AccessibilityProvider";
import { api, ApiError, type AnalyzeResponse } from "@/lib/api";

/**
 * Egyptian Legal Assistant Chat.
 * Voice or typed question → backend /analyze → dual-tab answer:
 *   🇪🇬 تبسيط بالعامية (with audio player + synced captions)
 *   🏛️ النداء القانوني الرسمي (statutes / rulings / review status)
 * Blocked/low-faithfulness answers surface the pre-approved legal hold
 * message — the UI never hides a "blocked" status from the user.
 */
export function LegalChatPanel({ onClose }: { onClose: () => void }) {
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<
    "idle" | "thinking" | "answered" | "error"
  >("idle");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [tab, setTab] = useState<"ammiya" | "formal">("ammiya");
  const stopListenRef = useRef<(() => void) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus management on open (a11y) + listen for voice-routed questions
  useEffect(() => {
    inputRef.current?.focus();
    const onAsk = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      setQuestion(text);
      void submit(text);
    };
    window.addEventListener("crimsys:ask", onAsk);
    return () => {
      window.removeEventListener("crimsys:ask", onAsk);
      stopSpeaking();
    };
  }, []);

  const submit = async (q: string) => {
    if (!q.trim()) {
      announce("اكتب سؤالك أولاً", true);
      return;
    }
    setStatus("thinking");
    announce("جاري تحليل سؤالك", true);
    try {
      const res = await api.analyze(q.trim());
      setResult(res);
      setStatus("answered");
      setTab("ammiya");
      announce(
        res.status === "ok"
          ? "تم الوصول للإجابة"
          : "تم حجب الإجابة — راجع الرسالة المعروضة",
        true,
      );
      if (res.status === "ok") speak(res.answer);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : "حدث خطأ غير متوقع — حاول مرة أخرى.";
      setStatus("error");
      setError(msg);
      announce(msg, true);
    }
  };

  const startListening = () => {
    const support = sttSupport();
    if (!support.supported) {
      announce(support.reason, true);
      return;
    }
    setRecording(true);
    stopListenRef.current = listenOnce(
      (text) => {
        setRecording(false);
        setQuestion(text);
        void submit(text);
      },
      (msg) => {
        setRecording(false);
        announce(msg, true);
      },
    );
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-label="المساعد القانوني"
      className="mt-6 rounded-3xl border-4 border-[var(--color-ink)] bg-[var(--color-canvas)] p-6"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-bold">🏛️ المساعد القانوني</h3>
        <button
          type="button"
          onClick={onClose}
          className="touch-target rounded-2xl border-2 border-[var(--color-ink)] px-4 font-bold"
        >
          إغلاق
        </button>
      </div>

      {/* Question input row */}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(question);
        }}
      >
        <label htmlFor="q-input" className="sr-only">
          اكتب سؤالك القانوني
        </label>
        <input
          id="q-input"
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="مثال: عملولي إيصال أمانة مزور — أعمل إيه؟"
          className="touch-target min-w-64 flex-1 rounded-2xl border-2 border-[var(--color-ink)] px-4 text-lg"
        />
        <button
          type="button"
          onClick={startListening}
          aria-pressed={recording}
          aria-label="التحدث بصوتك"
          className={`touch-target rounded-2xl border-2 border-[var(--color-ink)] px-4 text-2xl ${
            recording ? "bg-[var(--color-danger)] text-[var(--color-canvas)]" : ""
          }`}
        >
          🎤
        </button>
        <button
          type="submit"
          className="touch-target rounded-2xl bg-[var(--color-brand)] px-6 text-lg font-bold text-[var(--color-canvas)]"
        >
          اسأل
        </button>
      </form>

      {status === "thinking" && (
        <p role="status" aria-live="polite" className="mt-4 text-lg font-bold">
          ⏳ جاري تحليل سؤالك محلياً — قد يستغرق حتى دقيقة…
        </p>
      )}

      {error && (
        <div role="alert" className="mt-4 border-4 border-[var(--color-danger)] p-4 font-bold">
          {error}
        </div>
      )}

      {/* Dual-tab result */}
      {result && status === "answered" && (
        <div className="mt-4">
          {/* Blocked state is surfaced honestly, never hidden */}
          {result.status !== "ok" && (
            <div
              role="alert"
              className="mb-4 border-4 border-[var(--color-danger)] p-4 font-bold leading-8"
            >
              {result.answer}
            </div>
          )}

          <div role="tablist" aria-label="عرض الإجابة" className="flex gap-2">
            <TabButton
              active={tab === "ammiya"}
              onClick={() => setTab("ammiya")}
              label="🇪🇬 تبسيط بالعامية"
            />
            <TabButton
              active={tab === "formal"}
              onClick={() => setTab("formal")}
              label="🏛️ النداء القانوني الرسمي"
            />
          </div>

          {tab === "ammiya" && (
            <CaptionedAnswer
              answer={result.answer}
              faithfulness={result.faithfulness}
              traceId={result.trace_id}
            />
          )}

          {tab === "formal" && (
            <div className="rounded-2xl border-4 border-[var(--color-ink)] p-4 leading-8">
              <p className="mb-2 font-bold">النص القانوني:</p>
              <p className="whitespace-pre-wrap">{result.answer}</p>
              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="font-bold">حالة التحقق:</dt>
                  <dd>
                    {result.status === "ok"
                      ? "✅ اجتاز بوابة الدقة (Ragas)"
                      : "⛔ محجوب — لا تعتمد على هذه النتيجة"}
                  </dd>
                </div>
                {result.faithfulness !== null && (
                  <div className="flex gap-2">
                    <dt className="font-bold">درجة الموثوقية:</dt>
                    <dd>{(result.faithfulness * 100).toFixed(0)}%</dd>
                  </div>
                )}
                <div className="flex gap-2">
                  <dt className="font-bold">رقم التتبع:</dt>
                  <dd dir="ltr" className="font-mono">{result.trace_id}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`touch-target rounded-2xl border-2 border-[var(--color-ink)] px-4 font-bold ${
        active ? "bg-[var(--color-brand)] text-[var(--color-canvas)]" : ""
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Sentence-synced captions: splits the answer into sentences, highlights
 * each while its TTS audio plays (karaoke pattern), independent of TTS
 * availability — highlighting also advances on a timer fallback.
 */
function CaptionedAnswer({
  answer,
  faithfulness,
  traceId,
}: {
  answer: string;
  faithfulness: number | null;
  traceId: string;
}) {
  const [activeIdx, setActiveIdx] = useState(-1);
  const sentences = answer
    .split(/(?<=[.!؟\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const playSynced = () => {
    setActiveIdx(0);
    speak(answer, () => setActiveIdx(-1));
    // Timer-synced highlight advance (~ words/2.5 per second heuristic)
    let i = 0;
    const tick = () => {
      i += 1;
      if (i >= sentences.length) return;
      setActiveIdx(i);
      const words = sentences[i].split(/\s+/).length;
      setTimeout(tick, Math.max(1800, (words / 2.5) * 1000));
    };
    setTimeout(tick, Math.max(1800, (sentences[0].split(/\s+/).length / 2.5) * 1000));
  };

  return (
    <div className="rounded-2xl border-4 border-[var(--color-ink)] p-4">
      <p className="leading-9" aria-live="polite">
        {sentences.map((s, i) => (
          <span
            key={i}
            className={i === activeIdx ? "caption-active" : undefined}
          >
            {s}{" "}
          </span>
        ))}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={playSynced}
          className="touch-target rounded-2xl border-2 border-[var(--color-ink)] px-4 font-bold"
        >
          ▶️ استمع مع متابعة النص
        </button>
        <button
          type="button"
          onClick={stopSpeaking}
          className="touch-target rounded-2xl border-2 border-[var(--color-ink)] px-4 font-bold"
        >
          ⏹ إيقاف
        </button>
      </div>
      <p className="mt-3 text-sm">
        درجة الموثوقية:{" "}
        {faithfulness !== null ? `${(faithfulness * 100).toFixed(0)}%` : "—"} ·
        رقم التتبع: <span dir="ltr" className="font-mono">{traceId}</span>
      </p>
    </div>
  );
}
