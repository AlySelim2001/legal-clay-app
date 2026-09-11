import { useA11y, announce } from "@/a11y/AccessibilityProvider";
import type { ThemeMode, FontScale } from "@/a11y/AccessibilityProvider";

const THEMES: { id: ThemeMode; label: string }[] = [
  { id: "base", label: "عادي" },
  { id: "contrast", label: "تباين عالٍ" },
  { id: "deuteranopia", label: "عمى الأحمر والأخضر" },
  { id: "tritanopia", label: "عمى الأزرق والأصفر" },
];

const SCALES: { id: FontScale; label: string; short: string }[] = [
  { id: "normal", label: "خط عادي", short: "أ" },
  { id: "large", label: "خط كبير 125%", short: "أ+" },
  { id: "xl", label: "خط كبير جداً 200%", short: "أ++" },
];

export function TopBar() {
  const a11y = useA11y();

  return (
    <header
      role="banner"
      className="border-b-4 border-[var(--color-ink)] bg-[var(--color-canvas)]"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 p-3">
        <h1 className="me-auto text-xl font-bold">
          🛡️ الدرع القانوني — CRIM-SYS 2026
        </h1>

        {/* Theme modes */}
        <div
          role="group"
          aria-label="وضع الألوان"
          className="flex items-center gap-1"
        >
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`touch-target rounded-2xl border-2 px-3 text-sm font-bold ${
                a11y.theme === t.id
                  ? "bg-[var(--color-brand)] text-[var(--color-canvas)]"
                  : "border-[var(--color-ink)] bg-[var(--color-canvas)]"
              }`}
              aria-pressed={a11y.theme === t.id}
              onClick={() => {
                a11y.setTheme(t.id);
                announce(`تم تفعيل وضع الألوان: ${t.label}`);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Font scale */}
        <div
          role="group"
          aria-label="حجم الخط"
          className="flex items-center gap-1"
        >
          {SCALES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`touch-target rounded-2xl border-2 px-3 text-base font-bold ${
                a11y.fontScale === s.id
                  ? "bg-[var(--color-brand)] text-[var(--color-canvas)]"
                  : "border-[var(--color-ink)] bg-[var(--color-canvas)]"
              }`}
              aria-pressed={a11y.fontScale === s.id}
              onClick={() => {
                a11y.setFontScale(s.id);
                announce(`حجم الخط: ${s.label}`);
              }}
            >
              <span aria-hidden="true">{s.short}</span>
              <span className="sr-only">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Voice output toggle */}
        <button
          type="button"
          className={`touch-target rounded-2xl border-2 px-3 font-bold ${
            a11y.voiceOut
              ? "bg-[var(--color-brand)] text-[var(--color-canvas)]"
              : "border-[var(--color-ink)] bg-[var(--color-canvas)]"
          }`}
          aria-pressed={a11y.voiceOut}
          onClick={() => {
            a11y.setVoiceOut(!a11y.voiceOut);
            announce(
              a11y.voiceOut ? "تم إيقاف القراءة الصوتية" : "تم تفعيل القراءة الصوتية",
            );
          }}
        >
          🔊 القراءة الصوتية
        </button>
      </div>
    </header>
  );
}
