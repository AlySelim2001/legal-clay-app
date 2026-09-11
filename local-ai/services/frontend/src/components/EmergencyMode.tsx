import { useRef, useState } from "react";
import {
  announce,
  listenOnce,
  speak,
  sttSupport,
  stopSpeaking,
  useA11y,
} from "@/a11y/AccessibilityProvider";
import { Scanner } from "./DocumentScanner";
import { LegalChatPanel } from "./LegalChatPanel";

/**
 * One-Tap Emergency Action Mode (وضع الاستغاثة والطعن السريع).
 * Three massive buttons, AAA contrast, 112px+ touch targets, full
 * keyboard + screen-reader support, and Arabic voice guidance.
 */
export function EmergencyMode() {
  const [scanOpen, setScanOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const stopListenRef = useRef<(() => void) | null>(null);
  const a11y = useA11y();

  const openScan = () => {
    setScanOpen(true);
    announce("تم فتح الكاميرا — قرّب الصورة من الإيصال داخل الإطار", true);
    speak("قرّب الصورة من إيصال الأمانة أو المحضر داخل الإطار الأبيض");
  };

  const openChat = () => {
    setChatOpen(true);
    announce("اكتب سؤالك أو استخدم زر الميكروفون", true);
  };

  const openSteps = () => {
    setStepsOpen(true);
    announce("خطوات الطعن السريع معروضة الآن", true);
    speak(
      "خطوات الطعن السريع: أول خطوة، التقرير بالطعن بالتزوير في قلم كتاب المحكمة أو أمام النيابة. " +
        "ثاني خطوة، طلب إحالة الورقة لمصلحة الطب الشرعي قسم التزييف والتزوير. " +
        "ثالث خطوة، الدفع بانتفاء ركن التسليم، لأن مفيش إيصال أمانة من غير تسليم فعلي. " +
        "ورابع خطوة، قدم بلاغ عكسي بالابتزاز والبلاغ الكاذب. " +
        "واستشر المحامي قبل أي خطوة نهائية.",
    );
  };

  // Voice complaint: one-shot STT with honest fallbacks
  const startVoiceComplaint = () => {
    const support = sttSupport();
    if (!support.supported) {
      announce(support.reason, true);
      openChat(); // fall back to typed input
      return;
    }
    setListening(true);
    announce("بتكلم الآن — اضغط مرة أخرى للإرسال", true);
    stopListenRef.current = listenOnce(
      (text) => {
        setListening(false);
        stopSpeaking();
        openChat();
        window.dispatchEvent(new CustomEvent("crimsys:ask", { detail: text }));
        announce("تم إرسال سؤالك الصوتي للتحليل", true);
      },
      (msg) => {
        setListening(false);
        announce(msg, true);
      },
    );
  };

  return (
    <section aria-labelledby="emergency-heading" className="mx-auto max-w-5xl p-4">
      <h2 id="emergency-heading" className="mb-2 text-2xl font-bold">
        وضع الاستغاثة السريع
      </h2>
      <p className="mb-6 text-lg">
        ثلاث خطوات فقط — كل زر بيفتح خدمة كاملة. مفيش قوائم، مفيش تعقيد.
      </p>

      <div className="grid gap-6 sm:grid-cols-3">
        <button
          type="button"
          onClick={openScan}
          className="mega-button flex flex-col items-center gap-2 border-[var(--color-ink)] bg-[var(--color-safe)] p-8 text-[var(--color-canvas)] hover:brightness-110"
        >
          <span aria-hidden="true" className="text-5xl">📷</span>
          <span>صوّر الإيصال / المحضر</span>
          <span className="text-sm font-normal opacity-90">فحص فوري للمحرر</span>
        </button>

        <button
          type="button"
          onClick={startVoiceComplaint}
          disabled={listening}
          className="mega-button flex flex-col items-center gap-2 border-[var(--color-ink)] bg-[var(--color-brand-strong)] p-8 text-[var(--color-canvas)] hover:brightness-110 disabled:opacity-80"
        >
          <span aria-hidden="true" className="text-5xl">
            {listening ? "⏺" : "🎤"}
          </span>
          <span>{listening ? "بتكلم الآن…" : "احكي مشكلتك بصوتك"}</span>
          <span className="text-sm font-normal opacity-90">
            اضغط وتكلم — بنحلل فوراً
          </span>
        </button>

        <button
          type="button"
          onClick={openSteps}
          className="mega-button flex flex-col items-center gap-2 border-[var(--color-ink)] bg-[var(--color-danger)] p-8 text-[var(--color-canvas)] hover:brightness-110"
        >
          <span aria-hidden="true" className="text-5xl">🚨</span>
          <span>خطوات الطعن السريع</span>
          <span className="text-sm font-normal opacity-90">دليل صوتي مكتوب</span>
        </button>
      </div>

      {scanOpen && <DocumentScannerPanel onClose={() => setScanOpen(false)} />}
      {chatOpen && <LegalChatPanel onClose={() => setChatOpen(false)} />}
      {stepsOpen && <EmergencySteps onClose={() => setStepsOpen(false)} />}
    </section>
  );
}

function DocumentScannerPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="mt-6 rounded-3xl border-4 border-[var(--color-ink)] bg-[var(--color-canvas)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xl font-bold">📷 فحص المستند</h3>
        <button
          type="button"
          onClick={onClose}
          className="touch-target rounded-2xl border-2 border-[var(--color-ink)] px-4 font-bold"
        >
          إغلاق
        </button>
      </div>
      <Scanner />
    </div>
  );
}

function EmergencySteps({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="خطوات الطعن السريع"
      className="mt-6 rounded-3xl border-4 border-[var(--color-ink)] bg-[var(--color-canvas)] p-6"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xl font-bold">🚨 خطوات الطعن السريع</h3>
        <button
          type="button"
          onClick={onClose}
          className="touch-target rounded-2xl border-2 border-[var(--color-ink)] px-4 font-bold"
        >
          إغلاق
        </button>
      </div>
      <ol className="list-decimal space-y-3 ps-8 text-lg leading-8">
        <li>
          <strong>التقرير بالطعن بالتزوير</strong> — في قلم كتاب المحكمة أو
          أمام النيابة العامة، مع بيان أسباب التزوير كتابة.
        </li>
        <li>
          <strong>إحالة للطب الشرعي</strong> — اطلب إحالة المحرر لقسم أبحاث
          التزييف والتزوير (استكتاب + عمر الحبر).
        </li>
        <li>
          <strong>انتفاء ركن التسليم</strong> — الإيصال بدون تسليم فعلي مثبت لا
          يقوم؛ عبء الإثبات على المدعي.
        </li>
        <li>
          <strong>بلاغ عكسي بالابتزاز والبلاغ الكاذب</strong> — أرفق الرسائل
          والتسجيلات التي تثبت التهديد والطلب المادي.
        </li>
      </ol>
      <p className="mt-4 border-4 border-[var(--color-danger)] p-4 font-bold">
        ⚠️ هذه خطوات استرشادية — استشر المحامي قبل تنفيذ أي منها.
      </p>
    </div>
  );
}
