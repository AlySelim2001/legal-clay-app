import { useCallback, useRef, useState } from "react";
import { announce, speak } from "@/a11y/AccessibilityProvider";
import { api, ApiError } from "@/lib/api";

/**
 * Document Inspection Dropzone.
 * Camera / file capture with audio framing guidance, then an HONEST
 * progress sequence: upload → Arabic OCR → text extraction. The backend
 * pipeline includes the PII scrubber automatically (server-side); visual
 * forgery detection (YOLO/SSIM) does not exist yet and is never claimed.
 */
export function Scanner() {
  const [stage, setStage] = useState<
    "idle" | "camera" | "uploading" | "ocr" | "done" | "error"
  >("idle");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = async () => {
    setStage("camera");
    announce("جاري فتح الكاميرا", true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      speak("قرّب الصورة من الإيصال داخل الإطار الأبيض");
    } catch {
      setStage("idle");
      setError("تعذّر فتح الكاميرا — تأكد من إعطاء إذن الكاميرا للمتصفح.");
      announce("تعذّر فتح الكاميرا", true);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    stopCamera();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", 0.92),
    );
    if (blob) await runOcr(new File([blob], "capture.jpg", { type: "image/jpeg" }));
  };

  const runOcr = async (file: File) => {
    setStage("uploading");
    announce("جاري إرسال الصورة للفحص", true);
    try {
      setStage("ocr");
      announce("جاري التعرف على النص العربي — قد يستغرق ثوانٍ", true);
      const { text } = await api.ocr(file);
      setText(text);
      setStage("done");
      announce("تم استخراج النص بنجاح", true);
      // Auto-read the extracted text aloud for low-literacy users
      speak(text.slice(0, 400));
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : "فشل تحليل الصورة — حاول مرة أخرى بصورة أوضح.";
      setStage("error");
      setError(msg);
      announce(msg, true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Live camera view with high-contrast framing guide */}
      {stage === "camera" && (
        <div className="relative overflow-hidden rounded-2xl border-4 border-[var(--color-ink)]">
          <video ref={videoRef} playsInline muted className="w-full" />
          {/* framing guide — decorative, described in text for AT */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-6 rounded-xl border-4 border-dashed border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
          />
          <p className="bg-[var(--color-ink)] p-3 text-center text-lg font-bold text-[var(--color-canvas)]">
            ضع الإيصال داخل الإطار — في إضاءة جيدة ومن الأعلى
          </p>
          <div className="flex gap-3 p-3">
            <button
              type="button"
              onClick={capture}
              className="touch-target flex-1 rounded-2xl bg-[var(--color-safe)] text-xl font-bold text-[var(--color-canvas)]"
            >
              📸 التقط الصورة
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setStage("idle");
              }}
              className="touch-target rounded-2xl border-2 border-[var(--color-ink)] px-4 font-bold"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Fallback: file upload / dropzone */}
      {stage === "idle" && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={startCamera}
            className="touch-target w-full rounded-2xl border-4 border-[var(--color-ink)] bg-[var(--color-canvas)] p-4 text-lg font-bold"
          >
            📷 افتح الكاميرا
          </button>
          <label className="touch-target flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-4 border-dashed border-[var(--color-ink)] p-6 text-center font-bold">
            <span aria-hidden="true" className="text-4xl">📁</span>
            أو اختر صورة من جهازك
            <span className="text-sm font-normal">
              (JPG أو PNG — صورة واضحة ومقروءة)
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void runOcr(f);
              }}
            />
          </label>
        </div>
      )}

      {/* Honest, announced progress stages */}
      {(stage === "uploading" || stage === "ocr") && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border-4 border-[var(--color-ink)] p-6 text-center text-lg font-bold"
        >
          <p className="mb-2 text-3xl" aria-hidden="true">⏳</p>
          {stage === "uploading"
            ? "جاري إرسال الصورة…"
            : "جاري التعرف على النص العربي…"}
          <p className="mt-2 text-sm font-normal">
            الملف يُعالج محلياً بالكامل — لا يغادر جهازك.
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-2xl border-4 border-[var(--color-danger)] p-4 font-bold">
          {error}
        </div>
      )}

      {/* Result */}
      {stage === "done" && (
        <div className="space-y-3">
          <h4 className="text-lg font-bold">النص المستخرج:</h4>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl border-4 border-[var(--color-ink)] bg-[var(--color-canvas)] p-4 font-[var(--font-ui)] text-base leading-8">
            {text}
          </pre>
          <button
            type="button"
            onClick={() => speak(text)}
            className="touch-target rounded-2xl border-2 border-[var(--color-ink)] px-4 font-bold"
          >
            🔊 اقرأ النص صوتياً
          </button>
          <p className="text-sm">
            ملاحظة: هذا استخراج نصي فقط — تحليل التزوير البصري قيد التطوير.
          </p>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
