// ============================================================
// CRIM-SYS 2026 — Open-Source Module Interfaces
// TypeScript contracts connecting open-source libraries to
// Supabase database schema types
// ============================================================

import type {
  CaseRow,
  ClientRow,
  ProceduralStageRow,
  AttachmentRow,
  DefenseCatalogRow,
  ScheduleRow,
} from "@/types/database";

// ---- PDF Generator Interfaces ----

export interface CasePDFData {
  case: CaseRow;
  client: ClientRow;
  defense?: DefenseCatalogRow | null;
  stage?: ProceduralStageRow | null;
  schedules?: ScheduleRow[];
}

export interface LegalMemoPDFData {
  case: CaseRow;
  client: ClientRow;
  defense?: DefenseCatalogRow | null;
  stage?: ProceduralStageRow | null;
  memoTitle: string;
  memoBody: string;
  authorName: string;
}

export interface BailReceiptPDFData {
  case: CaseRow;
  client: ClientRow;
  bailAmount: number;
  paidAmount: number;
  paymentDate: string;
  receiptNumber: string;
}

export type PDFGeneratorFormat =
  | "case-summary"
  | "bail-receipt"
  | "legal-memo"
  | "hearing-report";

// ---- OCR Scanner Interfaces ----

export interface OCRResult {
  text: string;
  confidence: number;
  language: string;
}

export interface ExtractedFields {
  nationalId: string | null;
  caseNo: string | null;
  bailAmount: number | null;
  judgeName: string | null;
  courtName: string | null;
  filingDate: string | null;
}

export interface OCRProcessingLog {
  attachmentId: string;
  extractedText: string;
  confidenceScore: number;
  extractedFields: ExtractedFields;
  processedAt: string;
}

// ---- Excel Bridge Interfaces ----

export type ExcelExportTarget = "cases" | "clients" | "deadlines" | "schedule";

export interface ExcelExportConfig {
  target: ExcelExportTarget;
  sheetName: string;
  filename: string;
}

export interface ExcelImportResult<T> {
  data: T[];
  errors: string[];
  totalRows: number;
  validRows: number;
}

// ---- FullCalendar Interfaces ----

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  color?: string;
  extendedProps: {
    caseId: string;
    caseCode: string;
    caseNo: string;
    clientName: string;
    sessionType: string;
    requiredAction: string;
    courtName: string;
    urgency: "critical" | "high" | "normal";
  };
}

export type CalendarViewType = "dayGridMonth" | "timeGridWeek" | "timeGridDay";

// ---- Offline Sync Interfaces ----

export type OfflineStoreName =
  | "cases"
  | "clients"
  | "schedules"
  | "attachments"
  | "defenses_catalog"
  | "legal_deadlines_reference"
  | "procedural_stages"
  | "external_records"
  | "audit_log";

export interface OfflineSyncConfig {
  storeName: OfflineStoreName;
  lastSyncedAt?: string;
  pendingChanges: number;
}

export interface CachedQuery<T> {
  data: T;
  timestamp: number;
  version: number;
}

// ---- Combined export ----
export type {
  CaseRow,
  ClientRow,
  ProceduralStageRow,
  AttachmentRow,
  DefenseCatalogRow,
  ScheduleRow,
};
