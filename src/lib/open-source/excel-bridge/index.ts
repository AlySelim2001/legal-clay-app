// ============================================================
// CRIM-SYS 2026 — Excel Bridge Module
// Bidirectional Excel import/export using xlsx (SheetJS)
// For legacy workbook compatibility and data portability
// ============================================================

import * as XLSX from "xlsx";
import type {
  CaseRow,
  ClientRow,
  ScheduleRow,
} from "@/types/database";
import type { ExcelExportTarget, ExcelExportConfig } from "@/lib/open-source";

// ---- Export Configurations ----

const exportConfigs: Record<ExcelExportTarget, ExcelExportConfig> = {
  cases: {
    target: "cases",
    sheetName: "القضايا",
    filename: "crim-sys-cases",
  },
  clients: {
    target: "clients",
    sheetName: "العملاء",
    filename: "crim-sys-clients",
  },
  deadlines: {
    target: "deadlines",
    sheetName: "المواعيد النهائية",
    filename: "crim-sys-deadlines",
  },
  schedule: {
    target: "schedule",
    sheetName: "الجلسات",
    filename: "crim-sys-schedule",
  },
};

// ---- Column Mappings (Arabic → English for Excel headers) ----

const caseColumns = [
  { header: "كود القضية", key: "case_code", width: 15 },
  { header: "رقم القضية", key: "case_no", width: 25 },
  { header: "العميل", key: "client_name", width: 20 },
  { header: "المحكمة", key: "court_name", width: 25 },
  { header: "تاريخ التقديم", key: "filing_date", width: 15 },
  { header: "حالة القضية", key: "procedural_status", width: 20 },
  { header: "الكفالة (ج.م)", key: "bail_amount_egp", width: 15 },
  { header: "التصنيف", key: "tactical_classification", width: 20 },
  { header: "حكم أول درجة", key: "first_instance_ruling", width: 20 },
  { header: "ملاحظات", key: "memo_notes", width: 30 },
];

const clientColumns = [
  { header: "كود العميل", key: "client_code", width: 15 },
  { header: "الاسم الكامل", key: "full_name", width: 25 },
  { header: "الرقم القومي", key: "national_id", width: 18 },
  { header: "الهاتف", key: "phone", width: 18 },
  { header: "البريد الإلكتروني", key: "email", width: 25 },
  { header: "تاريخ التسجيل", key: "created_at", width: 15 },
];

const scheduleColumns = [
  { header: "كود القضية", key: "case_code", width: 15 },
  { header: "نوع الجلسة", key: "session_type", width: 20 },
  { header: "تاريخ الجلسة", key: "session_date", width: 15 },
  { header: "الإجراء المطلوب", key: "required_action", width: 30 },
  { header: "تنبيه 7 أيام", key: "notified_7d", width: 12 },
  { header: "تنبيه يوم واحد", key: "notified_1d", width: 12 },
  { header: "تنبيه اليوم", key: "notified_today", width: 12 },
];

// ---- Export Functions ----

function prepareCaseRows(cases: CaseRow[], clients?: ClientRow[]): Record<string, unknown>[] {
  const clientMap = new Map<string, string>();
  clients?.forEach((c) => clientMap.set(c.id, c.full_name));

  return cases.map((c) => ({
    case_code: c.case_code,
    case_no: c.case_no,
    client_name: clientMap.get(c.client_id) ?? c.client_id,
    court_name: c.court_name,
    filing_date: c.filing_date,
    procedural_status: c.procedural_status ?? "",
    bail_amount_egp: c.bail_amount_egp,
    tactical_classification: c.tactical_classification ?? "",
    first_instance_ruling: c.first_instance_ruling ?? "",
    memo_notes: c.memo_notes ?? "",
  }));
}

function prepareClientRows(clients: ClientRow[]): Record<string, unknown>[] {
  return clients.map((c) => ({
    client_code: c.client_code,
    full_name: c.full_name,
    national_id: c.national_id,
    phone: c.phone ?? "",
    email: c.email ?? "",
    created_at: c.created_at.split("T")[0],
  }));
}

function prepareScheduleRows(
  schedules: ScheduleRow[],
  cases?: CaseRow[]
): Record<string, unknown>[] {
  const caseCodeMap = new Map<string, string>();
  cases?.forEach((c) => caseCodeMap.set(c.id, c.case_code));

  return schedules.map((s) => ({
    case_code: caseCodeMap.get(s.case_id) ?? s.case_id,
    session_type: s.session_type,
    session_date: s.session_date,
    required_action: s.required_action ?? "",
    notified_7d: s.notified_7d ? "نعم" : "لا",
    notified_1d: s.notified_1d ? "نعم" : "لا",
    notified_today: s.notified_today ? "نعم" : "لا",
  }));
}

/**
 * Export data to an Excel file
 */
export function exportToExcel(
  target: ExcelExportTarget,
  data: Record<string, unknown>[]
): void {
  const config = exportConfigs[target];

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  const cols = target === "cases"
    ? caseColumns
    : target === "clients"
    ? clientColumns
    : scheduleColumns;

  ws["!cols"] = cols.map((c) => ({ wch: c.width }));

  // Add header row with Arabic labels
  const headers = cols.map((c) => c.header);
  XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A1" });

  // Re-add data starting from row 2
  XLSX.utils.sheet_add_json(ws, data, {
    origin: "A2",
    skipHeader: true,
  });

  XLSX.utils.book_append_sheet(wb, ws, config.sheetName);

  // Download
  const today = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `${config.filename}-${today}.xlsx`);
}

/**
 * Export cases with client names resolved
 */
export function exportCases(
  cases: CaseRow[],
  clients?: ClientRow[]
): void {
  exportToExcel("cases", prepareCaseRows(cases, clients));
}

/**
 * Export clients
 */
export function exportClients(clients: ClientRow[]): void {
  exportToExcel("clients", prepareClientRows(clients));
}

/**
 * Export schedule
 */
export function exportSchedule(
  schedules: ScheduleRow[],
  cases?: CaseRow[]
): void {
  exportToExcel("schedule", prepareScheduleRows(schedules, cases));
}

// ---- Import Functions ----

/**
 * Import an Excel file and parse rows
 */
export interface ExcelImportResult<T> {
  data: T[];
  errors: string[];
  totalRows: number;
  validRows: number;
}

export function importFromExcel<T extends Record<string, unknown>>(
  file: File,
  columnMap: Record<string, keyof T>
): Promise<ExcelImportResult<T>> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        const errors: string[] = [];
        const parsedData: T[] = [];

        jsonData.forEach((row, index) => {
          try {
            const mapped = {} as Record<string, unknown>;
            Object.entries(columnMap).forEach(([excelCol, dbCol]) => {
              mapped[dbCol as string] = row[excelCol] ?? null;
            });
            parsedData.push(mapped as T);
          } catch {
            errors.push(`صف ${index + 2}: خطأ في التحليل`);
          }
        });

        resolve({
          data: parsedData,
          errors,
          totalRows: jsonData.length,
          validRows: parsedData.length,
        });
      } catch {
        resolve({
          data: [],
          errors: ["فشل في قراءة ملف Excel"],
          totalRows: 0,
          validRows: 0,
        });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Common column maps for importing
 */
export const importColumnMaps = {
  cases: {
    "كود القضية": "case_code" as const,
    "رقم القضية": "case_no" as const,
    "المحكمة": "court_name" as const,
    "تاريخ التقديم": "filing_date" as const,
    "الكفالة (ج.م)": "bail_amount_egp" as const,
  },
  clients: {
    "كود العميل": "client_code" as const,
    "الاسم الكامل": "full_name" as const,
    "الرقم القومي": "national_id" as const,
    "الهاتف": "phone" as const,
    "البريد الإلكتروني": "email" as const,
  },
};
