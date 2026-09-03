import { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * In-App Update Checker
 *
 * Periodically fetches a version manifest from the deployed site to detect
 * new releases.  Shows a non-intrusive banner at the top of the screen
 * prompting the user to refresh for the latest version.
 *
 * The manifest is expected at `/{BASE_PATH}/version.json` containing
 * `{ "version": "2.0.0", "buildTime": "2026-09-03T00:00:00Z" }`.
 *
 * Check interval: every 30 minutes.
 */

const CURRENT_VERSION = "2.0.0";
const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

interface VersionManifest {
  version: string;
  buildTime?: string;
}

export function UpdateChecker() {
  const [showBanner, setShowBanner] = useState(false);
  const [newVersion, setNewVersion] = useState("");

  useEffect(() => {
    async function checkForUpdate() {
      try {
        const res = await fetch("/version.json", {
          cache: "no-store",
          headers: { "Cache-Control": "no-cache" },
        });
        if (!res.ok) return;

        const manifest: VersionManifest = await res.json();
        if (
          manifest.version &&
          manifest.version !== CURRENT_VERSION
        ) {
          setNewVersion(manifest.version);
          setShowBanner(true);
        }
      } catch {
        // Silent fail — network may be down, or manifest not deployed yet
      }
    }

    // Check on mount
    checkForUpdate();

    // Check periodically
    const interval = setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!showBanner) return null;

  return (
    <div
      dir="rtl"
      className="fixed top-0 inset-x-0 z-[9999] bg-clay-blue text-white px-4 py-2.5 flex items-center justify-between shadow-lg"
    >
      <div className="flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        <span className="text-sm font-semibold">
          إصدار جديد متاح: {newVersion}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleRefresh}
          className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-xs font-bold transition-colors"
        >
          تحديث الآن
        </button>
        <button
          onClick={() => setShowBanner(false)}
          className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
