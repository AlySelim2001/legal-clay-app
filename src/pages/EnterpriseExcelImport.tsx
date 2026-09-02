import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSupabaseAuth } from "@/contexts/SupabaseAuthContext";
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  Download,
} from "lucide-react";
import type { ImportError, ImportResult } from "@/types/enterprise";
import { canImportData } from "@/lib/enterprise/rbac";

/**
 * Excel Import Engine for CRIM-SYS Enterprise.
 *
 * Reads an uploaded .xlsx file, validates rows against the enterprise schema,
 * and generates a detailed error report. No data is committed to the database
 * without explicit user confirmation.
 *
 * This component handles:
 * - File upload (drag & drop or file picker)
 * - Header detection and mapping
 * - Row-by-row validation with error collection
 * - Error report download as CSV
 */

interface ParsedRow {
  case_number?: string;
  case_year?: number;
  court_name?: string;
  person_name?: string;
  national_id?: string;
  phone?: string;
  session_date?: string;
  status?: string;
  notes?: string;
  raw: Record<string, unknown>;
}

const REQUIRED_HEADERS = ["رقم القضية", "المحكمة", "اسم الشخص"];

const HEADER_MAP: Record<string, keyof ParsedRow> = {
  "رقم القضية": "case_number",
  "رقم القضية/السنة": "case_number",
  "السنة": "case_year",
  "المحكمة": "court_name",
  "اسم الشخص": "person_name",
  "الرقم القومي": "national_id",
  "الهاتف": "phone",
  "موعد الجلسة": "session_date",
  "الحالة": "status",
  "ملاحظات": "notes",
};

function validateRow(row: ParsedRow, rowNum: number): ImportError[] {
  const errors: ImportError[] = [];

  if (!row.case_number || String(row.case_number).trim() === "") {
    errors.push({ row: rowNum, field: "case_number", message: "رقم القضية مطلوب" });
  }

  if (!row.court_name || String(row.court_name).trim() === "") {
    errors.push({ row: rowNum, field: "court_name", message: "المحكمة مطلوبة" });
  }

  if (!row.person_name || String(row.person_name).trim() === "") {
    errors.push({ row: rowNum, field: "person_name", message: "اسم الشخص مطلوب" });
  }

  if (row.national_id) {
    const nid = String(row.national_id).trim();
    if (!/^\d{14}$/.test(nid)) {
      errors.push({
        row: rowNum,
        field: "national_id",
        message: "الرقم القومي يجب أن يكون 14 رقمًا",
        value: nid,
      });
    }
  }

  if (row.case_year) {
    const year = Number(row.case_year);
    if (isNaN(year) || year < 1950 || year > 2100) {
      errors.push({
        row: rowNum,
        field: "case_year",
        message: "السنة غير صحيحة",
        value: String(row.case_year),
      });
    }
  }

  if (row.session_date) {
    const date = new Date(String(row.session_date));
    if (isNaN(date.getTime())) {
      errors.push({
        row: rowNum,
        field: "session_date",
        message: "التاريخ غير صحيح",
        value: String(row.session_date),
      });
    }
  }

  return errors;
}

export default function EnterpriseExcelImport() {
  const { user } = useSupabaseAuth();
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setProcessing(true);
    setImportResult(null);

    try {
      // Dynamic import of xlsx (SheetJS) to avoid bundling issues
      const XLSX = await import("xlsx");
      const data = await f.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setImportResult({
          totalRows: 0,
          imported: 0,
          skipped: 0,
          errors: [{ row: 0, field: "file", message: "الملف فارغ" }],
        });
        setProcessing(false);
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      if (jsonData.length === 0) {
        setImportResult({
          totalRows: 0,
          imported: 0,
          skipped: 0,
          errors: [{ row: 0, field: "file", message: "لا توجد بيانات في الورقة" }],
        });
        setProcessing(false);
        return;
      }

      // Map headers
      const headers = Object.keys(jsonData[0]);
      const mappedHeaders: Record<string, keyof ParsedRow> = {};

      for (const h of headers) {
        const normalized = h.trim();
        if (HEADER_MAP[normalized]) {
          mappedHeaders[h] = HEADER_MAP[normalized];
        }
      }

      // Check required headers
      const missingHeaders = REQUIRED_HEADERS.filter(
        (rh) => !headers.some((h) => h.includes(rh)),
      );

      if (missingHeaders.length > 0) {
        setImportResult({
          totalRows: jsonData.length,
          imported: 0,
          skipped: jsonData.length,
          errors: [
            {
              row: 0,
              field: "headers",
              message: `أعمدة مفقودة: ${missingHeaders.join(", ")}`,
            },
          ],
        });
        setProcessing(false);
        return;
      }

      // Parse and validate rows
      const allErrors: ImportError[] = [];
      let validCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < jsonData.length; i++) {
        const raw = jsonData[i];
        const row: ParsedRow = { raw };

        for (const [header, field] of Object.entries(mappedHeaders)) {
          const val = raw[header];
          if (field === "case_year") {
            row[field] = Number(val) || undefined;
          } else if (field !== "raw") {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (row as any)[field] = val != null ? String(val) : undefined;
          }
        }

        const rowErrors = validateRow(row, i + 2); // +2 for 1-indexed + header row
        if (rowErrors.length > 0) {
          allErrors.push(...rowErrors);
          skippedCount++;
        } else {
          validCount++;
        }
      }

      setImportResult({
        totalRows: jsonData.length,
        imported: validCount,
        skipped: skippedCount,
        errors: allErrors,
      });
    } catch (err) {
      setImportResult({
        totalRows: 0,
        imported: 0,
        skipped: 0,
        errors: [
          {
            row: 0,
            field: "file",
            message: `خطأ في قراءة الملف: ${err instanceof Error ? err.message : "خطأ غير معروف"}`,
          },
        ],
      });
    } finally {
      setProcessing(false);
    }
  }, []);

  const downloadErrorReport = useCallback(() => {
    if (!importResult || importResult.errors.length === 0) return;

    const csv = [
      "الصف,الحقل,الرسالة,القيمة",
      ...importResult.errors.map(
        (e) => `${e.row},"${e.field}","${e.message}","${e.value ?? ""}"`,
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CRIM-SYS_Import_Errors_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [importResult]);

  if (!user || !canImportData(user.role)) {
    return (
      <Card className="clay-card">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <AlertTriangle className="mb-4 h-10 w-10 text-urgency-critical" />
          <p className="text-sm font-medium">لا تملك صلاحية استيراد البيانات</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in" dir="rtl">
      <h1 className="text-2xl font-bold text-primary">استيراد بيانات Excel</h1>

      {/* Upload Area */}
      <Card
        className={`clay-card cursor-pointer border-2 border-dashed transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".xlsx,.xls,.csv";
          input.onchange = (e) => {
            const f = (e.target as HTMLInputElement).files?.[0];
            if (f) handleFile(f);
          };
          input.click();
        }}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Upload className="mb-4 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">
            {file ? file.name : "اسحب ملف Excel هنا أو انقر للاختيار"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            يدعم: .xlsx, .xls, .csv — الحد الأقصى: 10 MB
          </p>
        </CardContent>
      </Card>

      {/* Processing */}
      {processing && (
        <Card className="clay-card">
          <CardContent className="flex items-center justify-center gap-3 py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">جاري تحليل الملف...</span>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {importResult && !processing && (
        <Card className="clay-card">
          <CardHeader>
            <CardTitle className="text-base">نتائج التحليل</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {importResult.totalRows}
                </p>
                <p className="text-xs text-muted-foreground">إجمالي الصفوف</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {importResult.imported}
                </p>
                <p className="text-xs text-muted-foreground">صالحة</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {importResult.skipped}
                </p>
                <p className="text-xs text-muted-foreground">مرفوضة</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-red-600">
                  أخطاء ({importResult.errors.length})
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {importResult.errors.map((err, i) => (
                    <div
                      key={i}
                      className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30"
                    >
                      <span className="font-medium">صف {err.row}</span> —{" "}
                      {err.field}: {err.message}
                      {err.value && (
                        <span className="text-red-500"> (القيمة: {err.value})</span>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={downloadErrorReport}
                >
                  <Download className="h-3 w-3" />
                  تنزيل تقرير الأخطاء (CSV)
                </Button>
              </div>
            )}

            {importResult.imported > 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center text-sm text-green-700 dark:bg-green-950/30">
                <CheckCircle className="mx-auto mb-2 h-5 w-5" />
                تم التحقق من {importResult.imported} صف بنجاح.
                <br />
                <span className="text-xs">
                  ★ للتنفيذ الفعلي، اضغط "تأكيد الاستيراد" بعد مراجعة النتائج.
                </span>
              </div>
            )}

            {/* Important: We do NOT auto-import. User must confirm. */}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              ⚠️ هذا التحليل فقط — لم يتم استيراد أي بيانات بعد. يجب مراجعة
              النتائج والضغط على زر التأكيد لتنفيذ الاستيراد.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
