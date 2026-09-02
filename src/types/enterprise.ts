// ============================================================
// CRIM-SYS Enterprise — Shared Types & Zod Validation
// All entities use UUID IDs, ISO dates, and Arabic-first fields.
// ============================================================

import { z } from "zod";

// ---- Enums & Literals ----

export const UserRole = z.enum(["admin", "lawyer", "assistant", "readonly"]);
export type UserRoleType = z.infer<typeof UserRole>;

export const UserRoleLabels: Record<UserRoleType, string> = {
  admin: "مدير النظام",
  lawyer: "محامٍ / مشرف قانوني",
  assistant: "مساعد قانوني",
  readonly: "مستخدم للقراءة فقط",
};

export const ProceduralStatus = z.enum([
  "جديدة",
  "قيد المحاكمة",
  "محدد لها جلسة",
  "تأجلت الجلسة",
  "صدر الحكم بالبراءة",
  "صدر الحكم بالإدانة",
  "جاري الاستئناف",
  "انتهت",
]);
export type ProceduralStatusType = z.infer<typeof ProceduralStatus>;

export const CaseType = z.enum(["جنح", "جناية", "مخالفات", "إدارية", "أخرى"]);
export type CaseTypeValue = z.infer<typeof CaseType>;

export const ConfidenceStatus = z.enum(["غير مؤكد", "مراجع", "معتمد"]);
export type ConfidenceStatusType = z.infer<typeof ConfidenceStatus>;

export const LegalNoteStatus = z.enum(["مسودة", "بانتظار المراجعة", "معتمد"]);
export type LegalNoteStatusType = z.infer<typeof LegalNoteStatus>;

export const DocumentType = z.enum([
  "محضر جلسة",
  "حكم",
  "استمارة كفالة",
  "توكيل رسمي",
  "مذكرة دفاع",
  "مستند آخر",
]);
export type DocumentTypeValue = z.infer<typeof DocumentType>;

export const ReviewStatus = z.enum(["بانتظار المراجعة", "تمت المراجعة", "مرفوض"]);
export type ReviewStatusType = z.infer<typeof ReviewStatus>;

export const SessionType = z.enum([
  "نظر القضية",
  "إعلان الحكم",
  "جراحة",
  "استئناف",
  "معارضة",
  "أخرى",
]);
export type SessionTypeValue = z.infer<typeof SessionType>;

export const ActionType = z.enum([
  "توكيل",
  "نصح",
  "_usi",
  "🅳 linked",
  " إعادة المحاكمة",
  "تنقيح",
  "أخرى",
]);
export type ActionTypeValue = z.infer<typeof ActionType>;

export const ProposedStatus = z.enum(["مقترح", "مكتمل"]);
export type ProposedStatusType = z.infer<typeof ProposedStatus>;

export const AttendanceStatus = z.enum(["حاضر", "غائب", "يحدد لاحقاً"]);
export type AttendanceStatusType = z.infer<typeof AttendanceStatus>;

// ============================================================
// Entity Schemas — Zod Validation
// ============================================================

// ---- Person ----
export const PersonSchema = z.object({
  id: z.string().uuid(),
  person_code: z.string().min(1, "كود الشخص مطلوب"),
  legal_full_name: z.string().min(2, "الاسم القانوني مطلوب"),
  name_as_recorded: z.string().optional(),
  national_id_encrypted: z.string().optional(),
  national_id_display: z.string().optional(),
  phone_optional: z.string().optional(),
  email: z.string().email("بريد غير صحيح").optional().or(z.literal("")),
  notes: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PersonRow = z.infer<typeof PersonSchema>;

export const PersonInsertSchema = PersonSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  national_id_display: true,
});
export type PersonInsert = z.infer<typeof PersonInsertSchema>;

// ---- Case ----
export const CaseSchema = z.object({
  id: z.string().uuid(),
  case_code: z.string().min(1, "كود القضية مطلوب"),
  case_number: z.string().min(1, "رقم القضية مطلوب"),
  case_year: z.number().int().min(1950).max(2100),
  case_type: CaseType,
  court_name: z.string().min(1, "اسم المحكمة مطلوب"),
  police_station_or_prosecution: z.string().optional(),
  jurisdiction: z.string().optional(),
  person_id: z.string().uuid("معرف الشخص غير صحيح"),
  linked_case_group_id: z.string().uuid().nullable().optional(),
  procedural_status: ProceduralStatus.default("جديدة"),
  source_document_id: z.string().uuid().nullable().optional(),
  confidence_status: ConfidenceStatus.default("غير مؤكد"),
  legal_note_status: LegalNoteStatus.default("مسودة"),
  next_action: z.string().optional(),
  next_action_due_at: z.string().nullable().optional(),
  created_by: z.string().nullable(),
  updated_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CaseRow = z.infer<typeof CaseSchema>;

export const CaseInsertSchema = CaseSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,
});
export type CaseInsert = z.infer<typeof CaseInsertSchema>;

// ---- Session / Hearing ----
export const SessionSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  session_date_time: z.string().min(1, "موعد الجلسة مطلوب"),
  session_type: SessionType.default("نظر القضية"),
  courtroom_optional: z.string().optional(),
  required_action: z.string().optional(),
  reminder_enabled: z.boolean().default(true),
  attendance_status: AttendanceStatus.default("يحدد لاحقاً"),
  outcome_note: z.string().optional(),
  source_document_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SessionRow = z.infer<typeof SessionSchema>;

export const SessionInsertSchema = SessionSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type SessionInsert = z.infer<typeof SessionInsertSchema>;

// ---- Document ----
export const DocumentSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  document_type: DocumentType.default("مستند آخر"),
  original_file_name: z.string().min(1, "اسم الملف مطلوب"),
  secure_storage_key: z.string(),
  mime_type: z.string(),
  file_size: z.number().int().min(0),
  checksum: z.string().optional(),
  uploaded_by: z.string().nullable(),
  uploaded_at: z.string(),
  review_status: ReviewStatus.default("بانتظار المراجعة"),
  document_date: z.string().nullable().optional(),
  notes: z.string().optional(),
});
export type DocumentRow = z.infer<typeof DocumentSchema>;

export const DocumentInsertSchema = DocumentSchema.omit({
  id: true,
  uploaded_at: true,
});
export type DocumentInsert = z.infer<typeof DocumentInsertSchema>;

// ---- Action / Task ----
export const ActionSchema = z.object({
  id: z.string().uuid(),
  case_id: z.string().uuid(),
  action_type: ActionType.default("أخرى"),
  description: z.string().min(1, "وصف الإجراء مطلوب"),
  proposed_or_completed: ProposedStatus.default("مقترح"),
  legal_review_status: LegalNoteStatus.default("مسودة"),
  assigned_to: z.string().optional(),
  due_date: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  source_reference: z.string().optional(),
  created_by: z.string().nullable(),
  created_at: z.string(),
});
export type ActionRow = z.infer<typeof ActionSchema>;

export const ActionInsertSchema = ActionSchema.omit({
  id: true,
  created_at: true,
  created_by: true,
});
export type ActionInsert = z.infer<typeof ActionInsertSchema>;

// ---- Audit Log ----
export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().nullable(),
  entity_type: z.string(),
  entity_id: z.string().uuid(),
  action: z.string(),
  previous_value_hash: z.string().nullable(),
  new_value_hash: z.string().nullable(),
  timestamp: z.string(),
  device_metadata_limited: z.string().optional(),
});
export type AuditLogRow = z.infer<typeof AuditLogSchema>;

// ---- Defense Catalog (Reference) ----
export const DefenseCatalogSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});
export type DefenseCatalogRow = z.infer<typeof DefenseCatalogSchema>;

// ---- Legal Deadlines Reference ----
export const LegalDeadlineSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  procedure_name: z.string(),
  duration_value: z.number().nullable(),
  duration_unit: z.enum(["يوم", "شهر", "سنة"]).nullable(),
  legal_basis: z.string(),
  editable_by_role: z.string().default("admin"),
});
export type LegalDeadlineRow = z.infer<typeof LegalDeadlineSchema>;

// ---- Legal Precedent ----
export const LegalPrecedentSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  court: z.string(),
  ruling_date: z.string(),
  principle_summary: z.string(),
  full_text: z.string().nullable(),
  defense_category_id: z.string().uuid().nullable(),
  crime_type: z.string().nullable(),
  created_at: z.string(),
});
export type LegalPrecedentRow = z.infer<typeof LegalPrecedentSchema>;

// ---- OCR Log ----
export const OCRLogSchema = z.object({
  id: z.string().uuid(),
  attachment_id: z.string().uuid(),
  extracted_text: z.string(),
  confidence_score: z.number().nullable(),
  processed_at: z.string(),
});
export type OCRLogRow = z.infer<typeof OCRLogSchema>;

// ---- Entity Link ----
export const EntityLinkSchema = z.object({
  id: z.string().uuid(),
  source_case_id: z.string().uuid(),
  target_case_id: z.string().uuid(),
  match_reason: z.string(),
  confidence: z.number().nullable(),
  created_at: z.string(),
});
export type EntityLinkRow = z.infer<typeof EntityLinkSchema>;

// ============================================================
// Extended Types (with joins)
// ============================================================

export interface PersonWithCases extends PersonRow {
  cases?: CaseRow[];
}

export interface CaseWithPerson extends CaseRow {
  person?: PersonRow;
}

export interface CaseWithAll extends CaseRow {
  person?: PersonRow;
  sessions?: SessionRow[];
  documents?: DocumentRow[];
  actions?: ActionRow[];
}

export interface DashboardStats {
  totalCases: number;
  totalPersons: number;
  upcomingSessions: number;
  overdueActions: number;
  unreviewedDocuments: number;
  lastUpdated: string;
}

// ============================================================
// Excel Import Types
// ============================================================

export interface ExcelImportRow {
  case_number?: string;
  case_year?: number;
  court_name?: string;
  person_name?: string;
  national_id?: string;
  session_date?: string;
  status?: string;
  notes?: string;
}

export interface ImportResult {
  totalRows: number;
  imported: number;
  skipped: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

// ============================================================
// Permission Helpers (client-side checks — server enforces RLS)
// ============================================================

export const RolePermissions = {
  admin: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canViewAll: true,
    canManageUsers: true,
    canViewAuditLog: true,
    canExport: true,
    canImport: true,
    canManageSettings: true,
  },
  lawyer: {
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canViewAll: true,
    canManageUsers: false,
    canViewAuditLog: false,
    canExport: true,
    canImport: false,
    canManageSettings: false,
  },
  assistant: {
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canViewAll: true,
    canManageUsers: false,
    canViewAuditLog: false,
    canExport: false,
    canImport: false,
    canManageSettings: false,
  },
  readonly: {
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canViewAll: true,
    canManageUsers: false,
    canViewAuditLog: false,
    canExport: false,
    canImport: false,
    canManageSettings: false,
  },
} as const;

export function hasPermission(
  role: UserRoleType,
  permission: keyof (typeof RolePermissions)["admin"],
): boolean {
  return RolePermissions[role]?.[permission] ?? false;
}

// ============================================================
// Design Tokens (shared between client & server)
// ============================================================

export const ThemeTokens = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  primary: "#1B365D",
  confirm: "#2E8B57",
  warning: "#C88719",
  error: "#B23A3A",
  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
} as const;

// ============================================================
// Audit Action Types
// ============================================================

export const AuditActions = {
  CREATE: "إنشاء",
  UPDATE: "تعديل",
  DELETE: "حذف",
  VIEW: "عرض",
  EXPORT: "تصدير",
  IMPORT: "استيراد",
  DOWNLOAD: "تنزيل",
  LOGIN: "دخول",
  LOGOUT: "خروج",
} as const;

export type AuditActionType = keyof typeof AuditActions;

// ============================================================
// Notification Types
// ============================================================

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface ReminderSchedule {
  sessionId: string;
  caseCode: string;
  sessionDate: string;
  sessionType: string;
  daysBefore: number;
}
