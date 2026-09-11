import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AccessibilityProvider,
  announce,
} from "@/a11y/AccessibilityProvider";
import { TopBar } from "@/components/TopBar";
import { EmergencyMode } from "@/components/EmergencyMode";
import { GovPortalsHub } from "@/components/GovPortalsHub";
import { api } from "@/lib/api";
import "./index.css";

function App() {
  const [backend, setBackend] = useState<"checking" | "up" | "down">(
    "checking",
  );

  useEffect(() => {
    api
      .health()
      .then(() => {
        setBackend("up");
        announce("الخدمة متاحة");
      })
      .catch(() => {
        setBackend("down");
        announce(
          "الخدمة المحلية غير متاحة — شغّل المنظومة بـ make up من مجلد local-ai",
          true,
        );
      });
  }, []);

  return (
    <AccessibilityProvider>
      <TopBar />
      <main id="main" tabIndex={-1}>
        {/* Backend status — announced, color-independent (icon + text) */}
        <div
          role="status"
          className={`border-b-4 p-3 text-center font-bold ${
            backend === "up"
              ? "bg-[var(--color-safe)] text-[var(--color-canvas)]"
              : backend === "down"
                ? "bg-[var(--color-danger)] text-[var(--color-canvas)]"
                : "bg-[var(--color-canvas)]"
          }`}
        >
          {backend === "up"
            ? "✅ الخدمة المحلية متاحة — بياناتك لا تغادر جهازك"
            : backend === "down"
              ? "⛔ الخدمة المحلية غير متاحة — شغّل: cd local-ai && make up"
              : "⏳ جاري التحقق من الخدمة…"}
        </div>

        <EmergencyMode />
        <GovPortalsHub />

        <footer className="border-t-4 border-[var(--color-ink)] p-6 text-center leading-8">
          <p className="font-bold">
            ⚠️ هذا النظام أداة تنظيمية مساعدة ولا يُغني عن الاستشارة القانونية
            المتخصصة.
          </p>
          <p className="mt-1 text-sm">
            CRIM-SYS 2026 — درع المواطن القانوني · يعمل محلياً 100% ·{" "}
            <a
              className="underline"
              href="https://github.com/AlySelim2001/legal-clay-app"
            >
              GitHub
            </a>
          </p>
        </footer>
      </main>
    </AccessibilityProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
