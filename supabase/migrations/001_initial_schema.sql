-- ============================================================
-- CRIM-SYS 2026 — Supabase Migration
-- Creates all tables, RLS policies, and seed data
-- ============================================================

-- ===================== TABLE: clients ========================
CREATE TABLE public.clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code text UNIQUE NOT NULL,
  full_name   text NOT NULL,
  national_id text UNIQUE NOT NULL
                CHECK (national_id ~ '^\d{14}$'),
  phone       text,
  email       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_clients_client_code ON public.clients (client_code);
CREATE INDEX idx_clients_national_id ON public.clients (national_id);
CREATE INDEX idx_clients_full_name ON public.clients USING gin (full_name gin_trgm_ops);

-- ===================== TABLE: defenses_catalog ================
CREATE TABLE public.defenses_catalog (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text
);

CREATE INDEX idx_defenses_catalog_code ON public.defenses_catalog (code);

-- =============== TABLE: legal_deadlines_reference =============
CREATE TABLE public.legal_deadlines_reference (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text UNIQUE NOT NULL,
  procedure_name  text NOT NULL,
  duration_value  integer,
  duration_unit   text CHECK (duration_unit IN ('يوم', 'شهر', 'سنة')),
  legal_basis     text NOT NULL,
  editable_by_role text NOT NULL DEFAULT 'admin'
);

CREATE INDEX idx_legal_deadlines_code ON public.legal_deadlines_reference (code);

-- ===================== TABLE: cases ===========================
CREATE TABLE public.cases (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_code               text UNIQUE NOT NULL,
  case_no                 text NOT NULL,
  client_id               uuid NOT NULL REFERENCES public.clients(id),
  court_name              text NOT NULL,
  filing_date             date NOT NULL,
  first_instance_ruling   text,
  bail_amount_egp         numeric(12,2) NOT NULL DEFAULT 0
                            CHECK (bail_amount_egp >= 0),
  opposition_hearing_date date,
  procedural_status       text CHECK (procedural_status IN (
                            'محدد لها جلسة معارضة',
                            'تم قبول المعارضة',
                            'تم رفض المعارضة',
                            'صدر الحكم بالبراءة',
                            'صدر الحكم بالإدانة',
                            'تأجلت الجلسة',
                            'جاري تنفيذ الحكم',
                            'أخرى'
                          )),
  tactical_classification text,
  primary_defense_id      uuid REFERENCES public.defenses_catalog(id),
  memo_notes              text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cases_case_code ON public.cases (case_code);
CREATE INDEX idx_cases_client_id ON public.cases (client_id);
CREATE INDEX idx_cases_filing_date ON public.cases (filing_date);
CREATE INDEX idx_cases_procedural_status ON public.cases (procedural_status);
CREATE INDEX idx_cases_updated_at ON public.cases (updated_at DESC);

-- =================== TABLE: procedural_stages =================
CREATE TABLE public.procedural_stages (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                uuid UNIQUE NOT NULL REFERENCES public.cases(id),
  prescription_date      date,
  bail_payment_status    text NOT NULL DEFAULT 'غير مسدد'
                           CHECK (bail_payment_status IN ('مسدد', 'غير مسدد', 'معفى')),
  bail_payment_date      date,
  bail_amount_paid       numeric(12,2),
  appeal_fee_status      text NOT NULL DEFAULT 'غير مطلوب بعد'
                           CHECK (appeal_fee_status IN ('غير مطلوب بعد', 'مسدد', 'غير مسدد')),
  opposition_ruling_date date,
  appeal_status          text NOT NULL DEFAULT 'لم يُستأنف بعد'
                           CHECK (appeal_status IN ('لم يُستأنف بعد', 'مستأنف', 'تنازل عن الاستئناف')),
  appeal_reference       text,
  next_appeal_session    date,
  cassation_status       text NOT NULL DEFAULT 'غير مطروح'
                           CHECK (cassation_status IN ('غير مطروح', 'مطروح', 'مرفوض', 'مقبول')),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_procedural_stages_case_id ON public.procedural_stages (case_id);

-- =================== TABLE: external_records ==================
CREATE TABLE public.external_records (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id                  uuid NOT NULL REFERENCES public.cases(id),
  record_no                text NOT NULL,
  department               text NOT NULL,
  counterpart_no           text,
  session_or_decision_date date,
  notes                    text
);

CREATE INDEX idx_external_records_case_id ON public.external_records (case_id);

-- =================== TABLE: attachments =======================
CREATE TABLE public.attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      uuid NOT NULL REFERENCES public.cases(id),
  document_type text CHECK (document_type IN (
                  'صورة محضر الجلسة',
                  'صورة حكم أول درجة',
                  'صورة استمارة/إيصال الكفالة',
                  'توكيل رسمي عام',
                  'حافظة مستندات ومذكرة دفاع',
                  'صورة حكم البراءة السابق',
                  'أخرى'
                )),
  storage_path text NOT NULL,
  uploaded_by  uuid REFERENCES auth.users(id),
  uploaded_at  timestamptz NOT NULL DEFAULT now(),
  notes        text
);

CREATE INDEX idx_attachments_case_id ON public.attachments (case_id);
CREATE INDEX idx_attachments_document_type ON public.attachments (document_type);

-- =================== TABLE: schedule ==========================
CREATE TABLE public.schedule (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id        uuid NOT NULL REFERENCES public.cases(id),
  session_date   date NOT NULL,
  session_type   text NOT NULL,
  required_action text,
  notified_7d    boolean NOT NULL DEFAULT false,
  notified_1d    boolean NOT NULL DEFAULT false,
  notified_today boolean NOT NULL DEFAULT false
);

CREATE INDEX idx_schedule_case_id ON public.schedule (case_id);
CREATE INDEX idx_schedule_session_date ON public.schedule (session_date);
CREATE INDEX idx_schedule_upcoming ON public.schedule (session_date) WHERE session_date >= CURRENT_DATE;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.clients                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defenses_catalog       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_deadlines_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedural_stages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule               ENABLE ROW LEVEL SECURITY;

-- =============== HELPER: extract role from JWT ================
-- The role is stored in auth.users.raw_user_meta_data -> 'role'
-- Supabase sets this via auth.users or custom claims.

-- ============================================================
-- RLS POLICIES — ADMIN: full access everywhere
-- ============================================================

-- clients
CREATE POLICY "admin_full_access_clients"
  ON public.clients FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- defenses_catalog
CREATE POLICY "admin_full_access_defenses_catalog"
  ON public.defenses_catalog FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- legal_deadlines_reference
CREATE POLICY "admin_full_access_legal_deadlines_reference"
  ON public.legal_deadlines_reference FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- cases
CREATE POLICY "admin_full_access_cases"
  ON public.cases FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- procedural_stages
CREATE POLICY "admin_full_access_procedural_stages"
  ON public.procedural_stages FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- external_records
CREATE POLICY "admin_full_access_external_records"
  ON public.external_records FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- attachments
CREATE POLICY "admin_full_access_attachments"
  ON public.attachments FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- schedule
CREATE POLICY "admin_full_access_schedule"
  ON public.schedule FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- ============================================================
-- RLS POLICIES — ASSISTANT: limited access
-- ============================================================

-- clients: full CRUD
CREATE POLICY "assistant_crud_clients"
  ON public.clients FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  );

-- cases: full CRUD (no delete)
CREATE POLICY "assistant_select_insert_update_cases"
  ON public.cases FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  );

CREATE POLICY "assistant_insert_cases"
  ON public.cases FOR INSERT
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  );

CREATE POLICY "assistant_update_cases"
  ON public.cases FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  );

-- procedural_stages: full CRUD
CREATE POLICY "assistant_crud_procedural_stages"
  ON public.procedural_stages FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  );

-- schedule: full CRUD
CREATE POLICY "assistant_crud_schedule"
  ON public.schedule FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  );

-- attachments: full CRUD
CREATE POLICY "assistant_crud_attachments"
  ON public.attachments FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  );

-- legal_deadlines_reference: SELECT only
CREATE POLICY "assistant_select_legal_deadlines_reference"
  ON public.legal_deadlines_reference FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  );

-- defenses_catalog: SELECT only
CREATE POLICY "assistant_select_defenses_catalog"
  ON public.defenses_catalog FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  );

-- ============================================================
-- SEED DATA: defenses_catalog (DF-01 to DF-06)
-- ============================================================
INSERT INTO public.defenses_catalog (code, name, description) VALUES
  ('DF-01', 'إسقاط الإجراءات',
   'الإثبات بأن الإجراءات الاستنادية قد أُخطئت فيها أو نُقصت، مما يُبطل الإجراءات الجزائية تبعًا للمادة 137 من قانون الإجراءات الجنائية.'),
  ('DF-02', 'الإنكار',
   'نفي التهمة مع التأكيد على عبء الإثبات على النيابة العامة، وعدم كفاية الدليل الدال على الجريمة.'),
  ('DF-03', 'الضرورة القصوى',
   'ادعاء الضرورة القصوى كمبرر للسلوك الإجرامي، حيث كان المتهم في خطر وشيك لا يمكن تفاديه بوسيلة أخرى.'),
  ('DF-04', 'نقص الصلاحية',
   'الاستناد إلى نقص في صلاحية الجهة المختصة أو عدم استيفاء شروط التصدي.'),
  ('DF-05', 'الأدلة الدامغة للبراءة',
   'اثبات وجود حجج دامغة تدل على براءة المتهم، مثل شهادة شهود الإثبات أو فيديو يثبت الحضور في مكان آخر.'),
  ('DF-06', 'تقادم الجريمة',
   'استنادًا إلى مرور مدة التقادم على الجريمة المنسوبة، مما يسقط الحق في مقاضاة المتهم.');

-- ============================================================
-- SEED DATA: legal_deadlines_reference (DL-01 to DL-08)
-- ============================================================
INSERT INTO public.legal_deadlines_reference (code, procedure_name, duration_value, duration_unit, legal_basis, editable_by_role) VALUES
  ('DL-01', 'مدة الطعن على الحكم الابتدائي',   40,  'يوم',  'المادة 403 من قانون الإجراءات الجنائية', 'admin'),
  ('DL-02', 'مدة تقديم صحيفة الدعوى المدنية',   30,  'يوم',  'المادة 216 من قانون الإجراءات الجنائية', 'admin'),
  ('DL-03', 'مدة الاستئناف على الحكم',           15,  'يوم',  'المادة 393 من قانون الإجراءات الجنائية', 'admin'),
  ('DL-04', 'مدة الطعن بالنقض',                   40,  'يوم',  'المادة 418 من قانون الإجراءات الجنائية', 'admin'),
  ('DL-05', 'مدة صلاحية أمر التفتيش',            NULL, NULL, 'المادة 98 من قانون الإجراءات الجنائية', 'admin'),
  ('DL-06', 'مدة حبس المتهم احتياطيًا',          45,  'يوم',  'المادة 134 من قانون الإجراءات الجنائية', 'admin'),
  ('DL-07', 'مدة سماع الدعوى أمام محكمة النقض',  NULL, NULL, 'المادة 422 من قانون الإجراءات الجنائية', 'admin'),
  ('DL-08', 'مدة تقديم التظلم على قرار الاحتباس', 3,   'يوم',  'المادة 134 مكرر من قانون الإجراءات الجنائية', 'admin');

-- ============================================================
-- PL/pgSQL FUNCTIONS & TRIGGERS
-- ============================================================

-- Dynamic Deadline Calculator
CREATE OR REPLACE FUNCTION public.compute_deadline(
  start_date date,
  deadline_code text
)
RETURNS date
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  ref RECORD;
BEGIN
  SELECT duration_value, duration_unit INTO ref
  FROM public.legal_deadlines_reference
  WHERE code = deadline_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'deadline code % not found', deadline_code;
  END IF;

  IF ref.duration_value IS NULL THEN
    RETURN NULL; -- open-ended, no fixed deadline
  ELSIF ref.duration_unit = 'يوم' THEN
    RETURN start_date + (ref.duration_value || ' days')::interval;
  ELSIF ref.duration_unit = 'شهر' THEN
    RETURN start_date + (ref.duration_value || ' months')::interval;
  ELSIF ref.duration_unit = 'سنة' THEN
    RETURN start_date + (ref.duration_value || ' years')::interval;
  ELSE
    RAISE EXCEPTION 'unknown duration unit: %', ref.duration_unit;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.compute_deadline(date, text)
  IS 'Computes a deadline date from a start_date using the legal_deadlines_reference table.';

-- Helper: classify urgency based on days remaining
CREATE OR REPLACE FUNCTION public.classify_urgency(
  target_date date
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN target_date IS NULL           THEN 'normal'
    WHEN target_date - CURRENT_DATE <= 3 THEN 'critical'
    WHEN target_date - CURRENT_DATE <= 7 THEN 'high'
    ELSE 'normal'
  END;
$$;

COMMENT ON FUNCTION public.classify_urgency(date)
  IS 'Returns urgency level: critical (<=3 days), high (<=7 days), normal (>7 days).';

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_procedural_stages_updated_at
  BEFORE UPDATE ON public.procedural_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Auto-create a procedural_stages row when a case is inserted
CREATE OR REPLACE FUNCTION public.auto_create_procedural_stage()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.procedural_stages (case_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cases_auto_stage
  AFTER INSERT ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_procedural_stage();

-- Auto-calculate prescription_date (3-year prescription DL-06) on procedural_stages
CREATE OR REPLACE FUNCTION public.auto_compute_prescription_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  filing_d date;
  presc_d date;
BEGIN
  SELECT c.filing_date INTO filing_d
  FROM public.cases c
  WHERE c.id = NEW.case_id;

  IF filing_d IS NULL THEN
    NEW.prescription_date := NULL;
    RETURN NEW;
  END IF;

  presc_d := public.compute_deadline(filing_d, 'DL-06');

  -- Fallback: 3-year misdemeanor prescription if DL-06 is missing
  IF presc_d IS NULL THEN
    presc_d := filing_d + INTERVAL '3 years';
  END IF;

  NEW.prescription_date := presc_d;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_procedural_stages_prescription
  BEFORE INSERT OR UPDATE ON public.procedural_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_compute_prescription_date();

COMMENT ON TRIGGER trg_procedural_stages_prescription ON public.procedural_stages
  IS 'Auto-computes prescription_date from cases.filing_date using DL-06 (3-year prescription).';

-- View: cases with computed days until next hearing
CREATE OR REPLACE VIEW public.cases_with_deadlines AS
SELECT
  c.*,
  cl.full_name AS client_name,
  cl.client_code,
  s.session_date AS next_hearing_date,
  (s.session_date - CURRENT_DATE) AS days_until_hearing,
  public.classify_urgency(s.session_date) AS hearing_urgency
FROM public.cases c
LEFT JOIN public.clients cl ON cl.id = c.client_id
LEFT JOIN LATERAL (
  SELECT session_date
  FROM public.schedule
  WHERE case_id = c.id
    AND session_date >= CURRENT_DATE
  ORDER BY session_date ASC
  LIMIT 1
) s ON true;
