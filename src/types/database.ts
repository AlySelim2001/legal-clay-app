// ============================================================
// CRIM-SYS 2026 — Database TypeScript Types
// Maps 1:1 to the PostgreSQL schema defined in supabase/migrations
// ============================================================

export type UserRole = 'admin' | 'assistant';

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: ClientRow;
        Insert: ClientInsert;
        Update: Partial<ClientInsert>;
      };
      defenses_catalog: {
        Row: DefenseCatalogRow;
        Insert: DefenseCatalogInsert;
        Update: Partial<DefenseCatalogInsert>;
      };
      legal_deadlines_reference: {
        Row: LegalDeadlineRow;
        Insert: LegalDeadlineInsert;
        Update: Partial<LegalDeadlineInsert>;
      };
      cases: {
        Row: CaseRow;
        Insert: CaseInsert;
        Update: Partial<CaseInsert>;
      };
      procedural_stages: {
        Row: ProceduralStageRow;
        Insert: ProceduralStageInsert;
        Update: Partial<ProceduralStageInsert>;
      };
      external_records: {
        Row: ExternalRecordRow;
        Insert: ExternalRecordInsert;
        Update: Partial<ExternalRecordInsert>;
      };
      attachments: {
        Row: AttachmentRow;
        Insert: AttachmentInsert;
        Update: Partial<AttachmentInsert>;
      };
      schedule: {
        Row: ScheduleRow;
        Insert: ScheduleInsert;
        Update: Partial<ScheduleInsert>;
      };
    };
  };
}

// ---- clients ----
export interface ClientRow {
  id: string;
  client_code: string;
  full_name: string;
  national_id: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  created_by: string | null;
}

export type ClientInsert = Omit<ClientRow, 'id' | 'created_at'>;

// ---- defenses_catalog ----
export interface DefenseCatalogRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

export type DefenseCatalogInsert = Omit<DefenseCatalogRow, 'id'>;

// ---- legal_deadlines_reference ----
export interface LegalDeadlineRow {
  id: string;
  code: string;
  procedure_name: string;
  duration_value: number | null;
  duration_unit: 'يوم' | 'شهر' | 'سنة' | null;
  legal_basis: string;
  editable_by_role: string;
}

export type LegalDeadlineInsert = Omit<LegalDeadlineRow, 'id'>;

// ---- cases ----
export type ProceduralStatus =
  | 'محدد لها جلسة معارضة'
  | 'تم قبول المعارضة'
  | 'تم رفض المعارضة'
  | 'صدر الحكم بالبراءة'
  | 'صدر الحكم بالإدانة'
  | 'تأجلت الجلسة'
  | 'جاري تنفيذ الحكم'
  | 'أخرى';

export interface CaseRow {
  id: string;
  case_code: string;
  case_no: string;
  client_id: string;
  court_name: string;
  filing_date: string;
  first_instance_ruling: string | null;
  bail_amount_egp: number;
  opposition_hearing_date: string | null;
  procedural_status: ProceduralStatus | null;
  tactical_classification: string | null;
  primary_defense_id: string | null;
  memo_notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CaseInsert = Omit<CaseRow, 'id' | 'created_at' | 'updated_at'>;

// ---- procedural_stages ----
export type BailPaymentStatus = 'مسدد' | 'غير مسدد' | 'معفى';
export type AppealFeeStatus = 'غير مطلوب بعد' | 'مسدد' | 'غير مسدد';
export type AppealStatus = 'لم يُستأنف بعد' | 'مستأنف' | 'تنازل عن الاستئناف';
export type CassationStatus = 'غير مطروح' | 'مطروح' | 'مرفوض' | 'مقبول';

export interface ProceduralStageRow {
  id: string;
  case_id: string;
  prescription_date: string | null;
  bail_payment_status: BailPaymentStatus;
  bail_payment_date: string | null;
  bail_amount_paid: number | null;
  appeal_fee_status: AppealFeeStatus;
  opposition_ruling_date: string | null;
  appeal_status: AppealStatus;
  appeal_reference: string | null;
  next_appeal_session: string | null;
  cassation_status: CassationStatus;
  updated_at: string;
}

export type ProceduralStageInsert = Omit<ProceduralStageRow, 'id' | 'updated_at'>;

// ---- external_records ----
export interface ExternalRecordRow {
  id: string;
  case_id: string;
  record_no: string;
  department: string;
  counterpart_no: string | null;
  session_or_decision_date: string | null;
  notes: string | null;
}

export type ExternalRecordInsert = Omit<ExternalRecordRow, 'id'>;

// ---- attachments ----
export type DocumentType =
  | 'صورة محضر الجلسة'
  | 'صورة حكم أول درجة'
  | 'صورة استمارة/إيصال الكفالة'
  | 'توكيل رسمي عام'
  | 'حافظة مستندات ومذكرة دفاع'
  | 'صورة حكم البراءة السابق'
  | 'أخرى';

export interface AttachmentRow {
  id: string;
  case_id: string;
  document_type: DocumentType | null;
  storage_path: string;
  uploaded_by: string | null;
  uploaded_at: string;
  notes: string | null;
}

export type AttachmentInsert = Omit<AttachmentRow, 'id' | 'uploaded_at'>;

// ---- schedule ----
export interface ScheduleRow {
  id: string;
  case_id: string;
  session_date: string;
  session_type: string;
  required_action: string | null;
  notified_7d: boolean;
  notified_1d: boolean;
  notified_today: boolean;
}

export type ScheduleInsert = Omit<ScheduleRow, 'id'>;

// ---- Extended types for joined queries ----
export interface CaseWithClient extends CaseRow {
  client?: ClientRow;
}

export interface CaseWithRelations extends CaseRow {
  client?: ClientRow;
  defense?: DefenseCatalogRow;
  procedural_stage?: ProceduralStageRow;
  schedules?: ScheduleRow[];
  attachments?: AttachmentRow[];
}

// ---- audit_log (Migration 003) ----
export interface AuditLogRow {
  id: string;
  table_name: string;
  record_id: string;
  changed_by: string | null;
  changed_at: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
}

// ---- legal_precedents (Migration 005) ----
export interface LegalPrecedentRow {
  id: string;
  title: string;
  court: string;
  ruling_date: string;
  principle_summary: string;
  full_text: string | null;
  defense_category_id: string | null;
  crime_type: string | null;
  created_at: string;
}

export type LegalPrecedentInsert = Omit<LegalPrecedentRow, 'id' | 'created_at'>;

// ---- ocr_logs (Migration 005) ----
export interface OCRLogRow {
  id: string;
  attachment_id: string;
  extracted_text: string;
  confidence_score: number | null;
  processed_at: string;
}

// ---- entity_links (Migration 005) ----
export interface EntityLinkRow {
  id: string;
  source_case_id: string;
  target_case_id: string;
  match_reason: string;
  confidence: number | null;
  created_at: string;
}
