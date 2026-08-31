import { useState } from "react";
import {
  Download,
  Upload,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  HardDrive,
  RefreshCw,
  FileJson,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  downloadBackup,
  restoreFromBackup,
  validateBackupStructure,
  sanitizeStorage,
  formatBytes,
  type RestoreResult,
  type SanitizeResult,
} from "@/lib/backup-engine";

export function BackupPanel() {
  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);

  // Restore state
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const [restoreProgress, setRestoreProgress] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);

  // Sanitize state
  const [sanitizing, setSanitizing] = useState(false);
  const [sanitizeResult, setSanitizeResult] = useState<SanitizeResult | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const result = await downloadBackup();
      setExportResult(result);
    } catch (err) {
      setExportResult(`خطأ في التصدير: ${err instanceof Error ? err.message : "خطأ"}`);
    } finally {
      setExporting(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoring(true);
    setRestoreResult(null);
    setFileError(null);
    setRestoreProgress("جاري قراءة الملف...");

    try {
      const text = await file.text();
      const validation = validateBackupStructure(text);

      if (!validation.valid) {
        setFileError(validation.error ?? "ملف غير صالح");
        setRestoring(false);
        return;
      }

      const result = await restoreFromBackup(text, (stage) => {
        setRestoreProgress(stage);
      });

      setRestoreResult(result);
    } catch (restoreErr) {
      setFileError(`خطأ في الاستعادة: ${restoreErr instanceof Error ? restoreErr.message : "خطأ"}`);
    } finally {
      setRestoring(false);
      // Reset file input
      e.target.value = "";
    }
  };

  const handleSanitize = async () => {
    setSanitizing(true);
    setSanitizeResult(null);
    try {
      const result = await sanitizeStorage();
      setSanitizeResult(result);
    } catch {
      setSanitizeResult({
        cleared: [],
        preserved: [],
        bytesFreed: 0,
      });
    } finally {
      setSanitizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-clay-blue/15">
          <HardDrive className="w-5 h-5 text-clay-blue" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">النسخ الاحتياطي والاستعادة</h3>
          <p className="text-xs text-muted-foreground">
            تصدير واستعادة البيانات المحلية وتنقية التخزين
          </p>
        </div>
      </div>

      {/* Export Section */}
      <div className="clay-card p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileJson className="w-4 h-4 text-clay-blue" />
            <h4 className="text-sm font-semibold text-foreground">تصدير نسخة احتياطية كاملة</h4>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className={cn(
              "clay-button flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl",
              "bg-clay-blue/10 text-clay-blue hover:bg-clay-blue/20",
              "disabled:opacity-50"
            )}
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {exporting ? "جاري التصدير..." : "تصدير JSON"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          يُصدر جميع البيانات المخزنة محلياً (القضايا، العملاء، الجلسات، السجلات) في ملف JSON مُعَرَّف بالوقت.
        </p>
        {exportResult && (
          <div className="flex items-center gap-2 mt-3 p-3 rounded-xl bg-urgency-normal/10 text-urgency-normal text-xs font-medium">
            <CheckCircle className="w-4 h-4 shrink-0" />
            {exportResult}
          </div>
        )}
      </div>

      {/* Restore Section */}
      <div className="clay-card p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-clay-purple" />
            <h4 className="text-sm font-semibold text-foreground">استعادة من نسخة احتياطية</h4>
          </div>
          <label
            className={cn(
              "clay-button flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl cursor-pointer",
              "bg-clay-purple/10 text-clay-purple hover:bg-clay-purple/20",
              "disabled:opacity-50"
            )}
          >
            {restoring ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {restoring ? "جاري الاستعادة..." : "اختيار ملف"}
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleRestore}
              disabled={restoring}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          استيراد ملف JSON احتياطي مع التحقق من سلامة البنية قبل الاستعادة.
        </p>

        {restoring && restoreProgress && (
          <div className="mt-3 p-3 rounded-xl bg-clay-purple/5 text-clay-purple text-xs font-medium flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            {restoreProgress}
          </div>
        )}

        {fileError && (
          <div className="mt-3 p-3 rounded-xl bg-urgency-critical/10 text-urgency-critical text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {fileError}
          </div>
        )}

        {restoreResult && (
          <div className={cn(
            "mt-3 p-3 rounded-xl text-xs font-medium flex items-start gap-2",
            restoreResult.success
              ? "bg-urgency-normal/10 text-urgency-normal"
              : "bg-urgency-high/10 text-urgency-high"
          )}>
            {restoreResult.success ? (
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div>
              <p>
                {restoreResult.success
                  ? `تمت الاستعادة بنجاح — ${restoreResult.tablesRestored} جداول، ${restoreResult.recordsRestored} سجل`
                  : "اكتملت الاستعادة مع بعض الأخطاء"}
              </p>
              {restoreResult.errors.length > 0 && (
                <ul className="mt-1 text-[10px] opacity-80">
                  {restoreResult.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sanitize Section */}
      <div className="clay-card p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-urgency-high" />
            <h4 className="text-sm font-semibold text-foreground">تنقية التخزين المحلي</h4>
          </div>
          <button
            onClick={handleSanitize}
            disabled={sanitizing}
            className={cn(
              "clay-button flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl",
              "bg-urgency-high/10 text-urgency-high hover:bg-urgency-high/20",
              "disabled:opacity-50"
            )}
          >
            {sanitizing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {sanitizing ? "جاري التنقية..." : "تنقية التخزين"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          حذف ملفات PDF المؤقتة والروابط الموقتية منتهية الصلاحية مع الحفاظ على البيانات الأساسية.
        </p>

        {sanitizeResult && (
          <div className="mt-3 space-y-2">
            {sanitizeResult.cleared.length > 0 && (
              <div className="p-3 rounded-xl bg-urgency-normal/10 text-xs">
                <p className="font-semibold text-urgency-normal mb-1">تم حذف:</p>
                <ul className="text-muted-foreground">
                  {sanitizeResult.cleared.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {sanitizeResult.preserved.length > 0 && (
              <div className="p-3 rounded-xl bg-clay-blue/10 text-xs">
                <p className="font-semibold text-clay-blue mb-1">تم الحفاظ على:</p>
                <ul className="text-muted-foreground">
                  {sanitizeResult.preserved.map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {sanitizeResult.bytesFreed > 0 && (
              <p className="text-xs text-muted-foreground">
                تم تحرير {formatBytes(sanitizeResult.bytesFreed)} من مساحة التخزين
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
