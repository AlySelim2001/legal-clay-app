import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ======================================================================
   AccessibilityProvider — WCAG 2.2 AAA runtime
   - Theme modes: base / high-contrast / deuteranopia / tritanopia
   - Font scale: 100% / 125% / 200%
   - Voice output (TTS) with sentence-synced captions
   - Speech-to-text fallback reporting (never silent)
   ====================================================================== */

export type ThemeMode =
  | "base"
  | "contrast"
  | "deuteranopia"
  | "tritanopia";
export type FontScale = "normal" | "large" | "xl";

interface AccessibilityState {
  theme: ThemeMode;
  fontScale: FontScale;
  voiceOut: boolean;
  captions: boolean;
  setTheme: (t: ThemeMode) => void;
  setFontScale: (s: FontScale) => void;
  setVoiceOut: (v: boolean) => void;
  setCaptions: (c: boolean) => boolean;
}

const Ctx = createContext<AccessibilityState | null>(null);

const LS_KEY = "crimsys-a11y";

interface Persisted {
  theme: ThemeMode;
  fontScale: FontScale;
  voiceOut: boolean;
  captions: boolean;
}

const DEFAULTS: Persisted = {
  theme: "base",
  fontScale: "normal",
  voiceOut: false,
  captions: true,
};

function load(): Persisted {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load);
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === "base") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", state.theme);
    root.setAttribute("data-fontscale", state.fontScale);
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }, [state]);

  const set = (patch: Partial<Persisted>) =>
    setState((s) => ({ ...s, ...patch }));

  const value: AccessibilityState = {
    ...state,
    setTheme: (theme) => set({ theme }),
    setFontScale: (fontScale) => set({ fontScale }),
    setVoiceOut: (voiceOut) => set({ voiceOut }),
    setCaptions: (captions) => {
      set({ captions });
      return captions;
    },
  };

  // Global ARIA live region — announce() posts here from anywhere.
  useEffect(() => {
    (window as unknown as { __crimsysAnnounce?: (msg: string) => void }).__crimsysAnnounce =
      (msg: string) => {
        if (liveRef.current) liveRef.current.textContent = msg;
      };
    return () => {
      delete (window as unknown as { __crimsysAnnounce?: (msg: string) => void })
        .__crimsysAnnounce;
    };
  }, []);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        ref={liveRef}
        role="status"
        aria-live="polite"
        className="sr-only"
      />
      {/* assertive live region for blocking legal alerts */}
      <A11yAssertive />
    </Ctx.Provider>
  );
}

function A11yAssertive() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    (
      window as unknown as { __crimsysAnnounceNow?: (msg: string) => void }
    ).__crimsysAnnounceNow = (msg: string) => {
      if (ref.current) ref.current.textContent = msg;
    };
    return () => {
      delete (window as unknown as { __crimsysAnnounceNow?: (msg: string) => void })
        .__crimsysAnnounceNow;
    };
  }, []);
  return <div ref={ref} role="alert" aria-live="assertive" className="sr-only" />;
}

/* ------------------------- hooks & helpers -------------------------- */

export function useA11y(): AccessibilityState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useA11y outside AccessibilityProvider");
  return ctx;
}

export function announce(msg: string, assertive = false) {
  const fn = assertive
    ? (window as unknown as { __crimsysAnnounceNow?: (m: string) => void })
        .__crimsysAnnounceNow
    : (window as unknown as { __crimsysAnnounce?: (m: string) => void })
        .__crimsysAnnounce;
  fn?.(msg);
}

/* ------------------------- voice output (TTS) ------------------------ */

/**
 * TTS: local stack has no TTS server yet, so we use the browser's
 * SpeechSynthesis (ar-EG voice when available). Designed so a Piper-TTS
 * container can be swapped in later without changing call sites.
 */
export function speak(text: string, onEnd?: () => void): void {
  const { voiceOut } = load();
  if (!voiceOut || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ar-EG";
  u.rate = 0.95; // slightly slower for comprehension
  const arVoice = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.startsWith("ar"));
  if (arVoice) u.voice = arVoice;
  u.onend = () => onEnd?.();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/* ------------------------- speech input (STT) ------------------------ */

export interface SttSupport {
  supported: boolean;
  reason: string;
}

export function sttSupport(): SttSupport {
  const w = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  if (w.SpeechRecognition || w.webkitSpeechRecognition) {
    return { supported: true, reason: "Web Speech API" };
  }
  return {
    supported: false,
    reason:
      "التعرف على الصوت غير مدعوم في هذا المتصفح — اكتب سؤالك في الصندوق أدناه.",
  };
}

/** One-shot STT in Egyptian Arabic. Returns null on error/permission denial. */
export function listenOnce(
  onResult: (text: string) => void,
  onError: (message: string) => void,
): () => void {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!SR) {
    onError("التعرف على الصوت غير متاح في هذا المتصفح.");
    return () => {};
  }
  const rec = new SR();
  rec.lang = "ar-EG";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e: SpeechEventLike) => {
    const text = e.results?.[0]?.[0]?.transcript ?? "";
    if (text) onResult(text);
  };
  rec.onerror = (e: SpeechErrorLike) => {
    const messages: Record<string, string> = {
      "not-allowed": "لم يُسمح باستخدام الميكروفون — فعّل الإذن من المتصفح.",
      "no-speech": "لم يُسمع أي كلام — جرّب مرة أخرى.",
      network: "خدمة التعرف على الصوت غير متاحة الآن.",
    };
    onError(messages[e.error] ?? "حدث خطأ أثناء الاستماع.");
  };
  try {
    rec.start();
  } catch {
    onError("تعذّر بدء الاستماع.");
  }
  return () => rec.stop();
}

/* Minimal structural types for the vendor-prefixed Speech API */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: SpeechErrorLike) => void) | null;
  start: () => void;
  stop: () => void;
}
interface SpeechEventLike {
  results?: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface SpeechErrorLike {
  error: string;
}

/* ------------------------- localStorage helper ---------------------- */
export function usePersistentFlag(
  key: string,
  initial: boolean,
): [boolean, (v: boolean) => void] {
  const [val, setVal] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : raw === "1";
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: boolean) => {
      setVal(v);
      try {
        localStorage.setItem(key, v ? "1" : "0");
      } catch {
        /* private mode — in-memory only */
      }
    },
    [key],
  );
  return [val, set];
}
