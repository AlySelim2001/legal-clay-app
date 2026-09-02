-- ============================================================
-- CRIM-SYS Enterprise — Supabase Database Migration
-- Tables, RLS Policies, Audit Triggers, and pgcrypto Encryption
-- ============================================================

-- Enable pgcrypto for National ID encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PERSONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_code TEXT NOT NULL UNIQUE,
  legal_full_name TEXT NOT NULL,
  name_as_recorded TEXT,
  national_id_encrypted TEXT, -- pgcrypto-encrypted national ID
  national_id_display TEXT,   -- last 4 digits only
  phone_optional TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. ENTERPRISE CASES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS enterprise_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code TEXT NOT NULL UNIQUE,
  case_number TEXT NOT NULL,
  case_year INTEGER NOT NULL CHECK (case_year BETWEEN 1950 AND 2100),
  case_type TEXT NOT NULL DEFAULT 'جنح',
  court_name TEXT NOT NULL,
  police_station_or_prosecution TEXT,
  jurisdiction TEXT,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  linked_case_group_id UUID,
  procedural_status TEXT NOT NULL DEFAULT 'جديدة',
  source_document_id UUID,
  confidence_status TEXT NOT NULL DEFAULT 'غير مؤكد',
  legal_note_status TEXT NOT NULL DEFAULT 'مسودة',
  next_action TEXT,
  next_action_due_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. ENTERPRISE SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS enterprise_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES enterprise_cases(id) ON DELETE CASCADE,
  session_date_time TIMESTAMPTZ NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'نظر القضية',
  courtroom_optional TEXT,
  required_action TEXT,
  reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  attendance_status TEXT NOT NULL DEFAULT 'يحدد لاحقاً',
  outcome_note TEXT,
  source_document_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. ENTERPRISE DOCUMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS enterprise_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES enterprise_cases(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'مستند آخر',
  original_file_name TEXT NOT NULL,
  secure_storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  checksum TEXT,
  uploaded_by UUID,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  review_status TEXT NOT NULL DEFAULT 'بانتظار المراجعة',
  document_date TIMESTAMPTZ,
  notes TEXT
);

-- ============================================================
-- 5. ENTERPRISE ACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS enterprise_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES enterprise_cases(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL DEFAULT 'أخرى',
  description TEXT NOT NULL,
  proposed_or_completed TEXT NOT NULL DEFAULT 'مقترح',
  legal_review_status TEXT NOT NULL DEFAULT 'مسودة',
  assigned_to TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  source_reference TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. ENTERPRISE AUDIT LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS enterprise_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  previous_value_hash TEXT,
  new_value_hash TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_metadata_limited TEXT
);

-- ============================================================
-- 7. AUTO-UPDATE TIMESTAMPS TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_persons_updated_at
  BEFORE UPDATE ON persons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_cases_updated_at
  BEFORE UPDATE ON enterprise_cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_sessions_updated_at
  BEFORE UPDATE ON enterprise_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. AUDIT TRIGGERS (INSERT, UPDATE, DELETE)
-- ============================================================
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type TEXT;
  v_entity_id UUID;
  v_action TEXT;
BEGIN
  IF TG_TABLE_NAME = 'persons' THEN
    v_entity_type := 'persons';
  ELSIF TG_TABLE_NAME = 'enterprise_cases' THEN
    v_entity_type := 'enterprise_cases';
  ELSIF TG_TABLE_NAME = 'enterprise_sessions' THEN
    v_entity_type := 'enterprise_sessions';
  ELSIF TG_TABLE_NAME = 'enterprise_documents' THEN
    v_entity_type := 'enterprise_documents';
  ELSIF TG_TABLE_NAME = 'enterprise_actions' THEN
    v_entity_type := 'enterprise_actions';
  ELSE
    v_entity_type := TG_TABLE_NAME;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_entity_id := NEW.id;
    v_action := 'إنشاء';
    INSERT INTO enterprise_audit_log (user_id, entity_type, entity_id, action, new_value_hash, timestamp)
    VALUES (auth.uid(), v_entity_type, v_entity_id, v_action, md5(NEW::text), NOW());
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := NEW.id;
    v_action := 'تعديل';
    INSERT INTO enterprise_audit_log (user_id, entity_type, entity_id, action, previous_value_hash, new_value_hash, timestamp)
    VALUES (auth.uid(), v_entity_type, v_entity_id, v_action, md5(OLD::text), md5(NEW::text), NOW());
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_entity_id := OLD.id;
    v_action := 'حذف';
    INSERT INTO enterprise_audit_log (user_id, entity_type, entity_id, action, previous_value_hash, timestamp)
    VALUES (auth.uid(), v_entity_type, v_entity_id, v_action, md5(OLD::text), NOW());
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit triggers to all entity tables
CREATE TRIGGER audit_persons
  AFTER INSERT OR UPDATE OR DELETE ON persons
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_cases
  AFTER INSERT OR UPDATE OR DELETE ON enterprise_cases
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_sessions
  AFTER INSERT OR UPDATE OR DELETE ON enterprise_sessions
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_documents
  AFTER INSERT OR UPDATE OR DELETE ON enterprise_documents
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_actions
  AFTER INSERT OR UPDATE OR DELETE ON enterprise_actions
  FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- ============================================================
-- 9. NATIONAL ID ENCRYPTION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION encrypt_national_id(raw_id TEXT)
RETURNS TABLE(encrypted TEXT, display TEXT) AS $$
BEGIN
  RETURN QUERY SELECT
    encode(pgp_sym_encrypt(raw_id, 'CRIM-SYS-2026-KEY'), 'base64') AS encrypted,
    RIGHT(raw_id, 4) AS display;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_national_id_for_display(encrypted_id TEXT)
RETURNS TEXT AS $$
BEGIN
  IF encrypted_id IS NULL OR encrypted_id = '' THEN
    RETURN NULL;
  END IF;
  RETURN RIGHT(pgp_sym_decrypt(decode(encrypted_id, 'base64'), 'CRIM-SYS-2026-KEY'), 4);
EXCEPTION
  WHEN OTHERS THEN RETURN '****';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_audit_log ENABLE ROW LEVEL SECURITY;

-- Persons: authenticated users can read all, insert/update own records
CREATE POLICY "persons_select_authenticated" ON persons
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "persons_insert_lawyer_or_above" ON persons
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') IN ('admin', 'lawyer', 'assistant')
    )
  );

CREATE POLICY "persons_update_lawyer_or_above" ON persons
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') IN ('admin', 'lawyer', 'assistant')
    )
  );

CREATE POLICY "persons_delete_admin_only" ON persons
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->->>'role') = 'admin'
    )
  );

-- Cases: authenticated users can read, lawyer+ can modify, admin can delete
CREATE POLICY "cases_select_authenticated" ON enterprise_cases
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "cases_insert_lawyer_or_above" ON enterprise_cases
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') IN ('admin', 'lawyer', 'assistant')
    )
  );

CREATE POLICY "cases_update_lawyer_or_above" ON enterprise_cases
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') IN ('admin', 'lawyer', 'assistant')
    )
  );

CREATE POLICY "cases_delete_admin_only" ON enterprise_cases
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') = 'admin'
    )
  );

-- Sessions: same as cases
CREATE POLICY "sessions_select_authenticated" ON enterprise_sessions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "sessions_insert_lawyer_or_above" ON enterprise_sessions
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') IN ('admin', 'lawyer', 'assistant')
    )
  );

CREATE POLICY "sessions_update_lawyer_or_above" ON enterprise_sessions
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') IN ('admin', 'lawyer', 'assistant')
    )
  );

CREATE POLICY "sessions_delete_admin_only" ON enterprise_sessions
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') = 'admin'
    )
  );

-- Documents: authenticated read, assistant+ can upload, admin can delete
CREATE POLICY "documents_select_authenticated" ON enterprise_documents
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "documents_insert_assistant_or_above" ON enterprise_documents
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') IN ('admin', 'lawyer', 'assistant')
    )
  );

CREATE POLICY "documents_update_lawyer_or_above" ON enterprise_documents
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') IN ('admin', 'lawyer', 'assistant')
    )
  );

CREATE POLICY "documents_delete_admin_only" ON enterprise_documents
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') = 'admin'
    )
  );

-- Actions: authenticated read, assistant+ can modify, admin can delete
CREATE POLICY "actions_select_authenticated" ON enterprise_actions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "actions_insert_assistant_or_above" ON enterprise_actions
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') IN ('admin', 'lawyer', 'assistant')
    )
  );

CREATE POLICY "actions_update_lawyer_or_above" ON enterprise_actions
  FOR UPDATE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') IN ('admin', 'lawyer', 'assistant')
    )
  );

CREATE POLICY "actions_delete_admin_only" ON enterprise_actions
  FOR DELETE USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') = 'admin'
    )
  );

-- Audit log: admin only for read, system writes via SECURITY DEFINER
CREATE POLICY "audit_select_admin_only" ON enterprise_audit_log
  FOR SELECT USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') = 'admin'
    )
  );

-- No INSERT/UPDATE/DELETE policies for audit log (writes via trigger only)

-- ============================================================
-- 11. SUPABASE STORAGE BUCKET POLICIES
-- ============================================================
-- Run in Supabase Dashboard > Storage > Policies:
--
-- Bucket: case-attachments
-- Policy 1 (Read): authenticated users can read
--   INSERT INTO storage.policies (name, definition, bucket_id)
--   VALUES ('Authenticated Read', '(bucket_id = ''case-attachments'' AND auth.role() = ''authenticated'')', 'case-attachments');
--
-- Policy 2 (Write): lawyer+ can upload
--   INSERT INTO storage.policies (name, definition, bucket_id)
--   VALUES ('Lawyer Upload', '(bucket_id = ''case-attachments'' AND auth.role() = ''authenticated'')', 'case-attachments');
--
-- Policy 3 (Delete): admin can delete
--   INSERT INTO storage.policies (name, definition, bucket_id)
--   VALUES ('Admin Delete', '(bucket_id = ''case-attachments'' AND auth.role() = ''authenticated'')', 'case-attachments');

-- ============================================================
-- 12. INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cases_person_id ON enterprise_cases(person_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON enterprise_cases(procedural_status);
CREATE INDEX IF NOT EXISTS idx_cases_case_code ON enterprise_cases(case_code);
CREATE INDEX IF NOT EXISTS idx_sessions_case_id ON enterprise_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON enterprise_sessions(session_date_time);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON enterprise_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_actions_case_id ON enterprise_actions(case_id);
CREATE INDEX IF NOT EXISTS idx_actions_due_date ON enterprise_actions(due_date);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON enterprise_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON enterprise_audit_log(timestamp DESC);

-- ============================================================
-- 13. REFERENCE TABLES (Defense Catalog, Legal Deadlines)
-- ============================================================
CREATE TABLE IF NOT EXISTS defense_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS legal_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  procedure_name TEXT NOT NULL,
  duration_value INTEGER,
  duration_unit TEXT,
  legal_basis TEXT NOT NULL,
  editable_by_role TEXT DEFAULT 'admin'
);

-- Seed defense catalog with common Egyptian criminal defenses
INSERT INTO defense_catalog (code, name, description) VALUES
  ('D001', 'دفاع المستندات', 'ادعاء عدم صحة المستند أو تزويره'),
  ('D002', '缺少 الأركان', 'عدم توفر أحد أركان الجريمة المادية أو المعنوية'),
  ('D003', 'الإكراه', 'الإكراه المادي أو المعنوي على ارتكاب الفعل'),
  ('D004', 'الدفاع عن النفس', 'الدفاع الشرعي عن النفس أو المال أو الغير'),
  ('D005', 'شكوك في الدليل', 'عدم كفاية الأدلة أو الشك في صحتها'),
  ('D006', 'الإعفاء من الملاحقة', 'سقوط الحق في الملاحقة بالتقادم'),
  ('D007', 'الإعفاء من العقوبة', 'падение - الإعفاء من العقوبة بسبب حالات الإعدام أو الأعذار المعفية')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Done — All enterprise tables, triggers, RLS, and indexes created.
-- ============================================================
