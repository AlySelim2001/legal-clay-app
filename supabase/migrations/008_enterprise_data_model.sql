-- ============================================================
-- CRIM-SYS Enterprise Migration: Persons, Actions, Audit Log
-- Extends existing schema with enterprise data model.
-- ============================================================

-- 1. PERSONS TABLE (replaces clients with richer model)
CREATE TABLE IF NOT EXISTS public.persons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_code TEXT UNIQUE NOT NULL,
  legal_full_name TEXT NOT NULL,
  name_as_recorded TEXT,
  national_id_encrypted TEXT,
  national_id_display TEXT,
  phone_optional TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index for search
CREATE INDEX IF NOT EXISTS idx_persons_name ON public.persons (legal_full_name);
CREATE INDEX IF NOT EXISTS idx_persons_code ON public.persons (person_code);
CREATE INDEX IF NOT EXISTS idx_persons_national ON public.persons (national_id_display);

-- 2. CASES TABLE (extended)
CREATE TABLE IF NOT EXISTS public.enterprise_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code TEXT UNIQUE NOT NULL,
  case_number TEXT NOT NULL,
  case_year INTEGER NOT NULL CHECK (case_year >= 1950 AND case_year <= 2100),
  case_type TEXT NOT NULL DEFAULT 'جنح',
  court_name TEXT NOT NULL,
  police_station_or_prosecution TEXT,
  jurisdiction TEXT,
  person_id UUID NOT NULL REFERENCES public.persons(id),
  linked_case_group_id UUID REFERENCES public.enterprise_cases(id),
  procedural_status TEXT DEFAULT 'جديدة',
  source_document_id UUID,
  confidence_status TEXT DEFAULT 'غير مؤكد',
  legal_note_status TEXT DEFAULT 'مسودة',
  next_action TEXT,
  next_action_due_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cases_number ON public.enterprise_cases (case_number);
CREATE INDEX IF NOT EXISTS idx_cases_person ON public.enterprise_cases (person_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.enterprise_cases (procedural_status);
CREATE INDEX IF NOT EXISTS idx_cases_court ON public.enterprise_cases (court_name);

-- 3. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.enterprise_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.enterprise_cases(id) ON DELETE CASCADE,
  session_date_time TIMESTAMPTZ NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'نظر القضية',
  courtroom_optional TEXT,
  required_action TEXT,
  reminder_enabled BOOLEAN DEFAULT true,
  attendance_status TEXT DEFAULT 'يحدد لاحقاً',
  outcome_note TEXT,
  source_document_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_case ON public.enterprise_sessions (case_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON public.enterprise_sessions (session_date_time);

-- 4. DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.enterprise_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.enterprise_cases(id) ON DELETE CASCADE,
  document_type TEXT DEFAULT 'مستند آخر',
  original_file_name TEXT NOT NULL,
  secure_storage_key TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size >= 0),
  checksum TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  review_status TEXT DEFAULT 'بانتظار المراجعة',
  document_date TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_documents_case ON public.enterprise_documents (case_id);

-- 5. ACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.enterprise_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.enterprise_cases(id) ON DELETE CASCADE,
  action_type TEXT DEFAULT 'أخرى',
  description TEXT NOT NULL,
  proposed_or_completed TEXT DEFAULT 'مقترح',
  legal_review_status TEXT DEFAULT 'مسودة',
  assigned_to TEXT,
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  source_reference TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actions_case ON public.enterprise_actions (case_id);
CREATE INDEX IF NOT EXISTS idx_actions_due ON public.enterprise_actions (due_date);
CREATE INDEX IF NOT EXISTS idx_actions_status ON public.enterprise_actions (proposed_or_completed);

-- 6. AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS public.enterprise_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  previous_value_hash TEXT,
  new_value_hash TEXT,
  timestamp TIMESTAMPTZ DEFAULT now(),
  device_metadata_limited TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.enterprise_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.enterprise_audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.enterprise_audit_log (timestamp);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_audit_log ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_all_persons" ON public.persons FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_cases" ON public.enterprise_cases FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_sessions" ON public.enterprise_sessions FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_documents" ON public.enterprise_documents FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_actions" ON public.enterprise_actions FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
CREATE POLICY "admin_all_audit" ON public.enterprise_audit_log FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Lawyer: full CRUD on cases/sessions/documents/actions, read-only on persons
CREATE POLICY "lawyer_all_cases" ON public.enterprise_cases FOR ALL USING (auth.jwt() ->> 'role' = 'lawyer');
CREATE POLICY "lawyer_all_sessions" ON public.enterprise_sessions FOR ALL USING (auth.jwt() ->> 'role' = 'lawyer');
CREATE POLICY "lawyer_all_documents" ON public.enterprise_documents FOR ALL USING (auth.jwt() ->> 'role' = 'lawyer');
CREATE POLICY "lawyer_all_actions" ON public.enterprise_actions FOR ALL USING (auth.jwt() ->> 'role' = 'lawyer');
CREATE POLICY "lawyer_select_persons" ON public.persons FOR SELECT USING (auth.jwt() ->> 'role' = 'lawyer');
CREATE POLICY "lawyer_insert_persons" ON public.persons FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'lawyer');
CREATE POLICY "lawyer_update_persons" ON public.persons FOR UPDATE USING (auth.jwt() ->> 'role' = 'lawyer');

-- Assistant: CRUD on cases/sessions/documents/actions, read-only persons, no delete
CREATE POLICY "assistant_select_cases" ON public.enterprise_cases FOR SELECT USING (auth.jwt() ->> 'role' = 'assistant');
CREATE POLICY "assistant_insert_cases" ON public.enterprise_cases FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'assistant');
CREATE POLICY "assistant_update_cases" ON public.enterprise_cases FOR UPDATE USING (auth.jwt() ->> 'role' = 'assistant');
CREATE POLICY "assistant_all_sessions" ON public.enterprise_sessions FOR ALL USING (auth.jwt() ->> 'role' = 'assistant');
CREATE POLICY "assistant_all_documents" ON public.enterprise_documents FOR ALL USING (auth.jwt() ->> 'role' = 'assistant');
CREATE POLICY "assistant_all_actions" ON public.enterprise_actions FOR ALL USING (auth.jwt() ->> 'role' = 'assistant');
CREATE POLICY "assistant_select_persons" ON public.persons FOR SELECT USING (auth.jwt() ->> 'role' = 'assistant');
CREATE POLICY "assistant_insert_persons" ON public.persons FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'assistant');

-- Readonly: SELECT only on everything
CREATE POLICY "readonly_select_persons" ON public.persons FOR SELECT USING (auth.jwt() ->> 'role' = 'readonly');
CREATE POLICY "readonly_select_cases" ON public.enterprise_cases FOR SELECT USING (auth.jwt() ->> 'role' = 'readonly');
CREATE POLICY "readonly_select_sessions" ON public.enterprise_sessions FOR SELECT USING (auth.jwt() ->> 'role' = 'readonly');
CREATE POLICY "readonly_select_documents" ON public.enterprise_documents FOR SELECT USING (auth.jwt() ->> 'role' = 'readonly');
CREATE POLICY "readonly_select_actions" ON public.enterprise_actions FOR SELECT USING (auth.jwt() ->> 'role' = 'readonly');
CREATE POLICY "readonly_select_audit" ON public.enterprise_audit_log FOR SELECT USING (auth.jwt() ->> 'role' = 'readonly');

-- ============================================================
-- Audit Trigger Function
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_audit_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.enterprise_audit_log (user_id, entity_type, entity_id, action, previous_value_hash, new_value_hash)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::text ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::text ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit triggers
CREATE TRIGGER audit_cases
  AFTER INSERT OR UPDATE OR DELETE ON public.enterprise_cases
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

CREATE TRIGGER audit_sessions
  AFTER INSERT OR UPDATE OR DELETE ON public.enterprise_sessions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

CREATE TRIGGER audit_actions
  AFTER INSERT OR UPDATE OR DELETE ON public.enterprise_actions
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

-- ============================================================
-- Updated_at Trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cases_updated
  BEFORE UPDATE ON public.enterprise_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_sessions_updated
  BEFORE UPDATE ON public.enterprise_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
