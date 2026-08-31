-- ============================================================
-- CRIM-SYS 2026 — Migration 002: Storage + Additional RPCs
-- ============================================================

-- Create Storage bucket for case documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'case-attachments',
  'case-attachments',
  false,
  20971520, -- 20 MB limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
-- Admin: full access to all files in case-attachments
CREATE POLICY "admin_full_access_storage"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'case-attachments'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'case-attachments'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    )
  );

-- Assistant: read + write to case-attachments (no delete)
CREATE POLICY "assistant_read_write_storage"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'case-attachments'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
      OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
    )
  );

CREATE POLICY "assistant_insert_storage"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'case-attachments'
    AND (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
      OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
    )
  );

-- RPC: batch compute deadlines for a list of codes
CREATE OR REPLACE FUNCTION public.compute_deadlines_batch(
  start_date date,
  deadline_codes text[]
)
RETURNS TABLE (code text, deadline_date date)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.code,
    public.compute_deadline(start_date, d.code) AS deadline_date
  FROM unnest(deadline_codes) AS d(code);
$$;

COMMENT ON FUNCTION public.compute_deadlines_batch(date, text[])
  IS 'Batch-computes multiple deadlines from a single start_date. Returns code + deadline_date pairs.';

-- RPC: get all deadlines for a case with urgency
CREATE OR REPLACE FUNCTION public.get_case_deadlines(p_case_id uuid)
RETURNS TABLE (
  code text,
  procedure_name text,
  deadline_date date,
  days_remaining integer,
  urgency text,
  legal_basis text,
  duration_value integer,
  duration_unit text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ldr.code,
    ldr.procedure_name,
    public.compute_deadline(c.filing_date, ldr.code) AS deadline_date,
    (public.compute_deadline(c.filing_date, ldr.code) - CURRENT_DATE)::integer AS days_remaining,
    public.classify_urgency(public.compute_deadline(c.filing_date, ldr.code)) AS urgency,
    ldr.legal_basis,
    ldr.duration_value,
    ldr.duration_unit
  FROM public.cases c
  CROSS JOIN public.legal_deadlines_reference ldr
  WHERE c.id = p_case_id
    AND ldr.duration_value IS NOT NULL
  ORDER BY deadline_date ASC;
$$;

COMMENT ON FUNCTION public.get_case_deadlines(uuid)
  IS 'Returns all computed deadlines for a given case with urgency classification.';

-- RPC: appeal deadlines from opposition_ruling_date (DL-02: 10 days, DL-03: extended)
CREATE OR REPLACE FUNCTION public.get_appeal_deadlines(p_case_id uuid)
RETURNS TABLE (
  deadline_type text,
  deadline_date date,
  days_remaining integer,
  urgency text,
  legal_basis text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE d.code
      WHEN 'DL-02' THEN 'مدة تقديم صحيفة الدعوى المدنية (10 أيام)'
      WHEN 'DL-03' THEN 'مدة الاستئناف على الحكم'
      ELSE ldr.procedure_name
    END AS deadline_type,
    public.compute_deadline(ps.opposition_ruling_date, d.code) AS deadline_date,
    (public.compute_deadline(ps.opposition_ruling_date, d.code) - CURRENT_DATE)::integer AS days_remaining,
    public.classify_urgency(public.compute_deadline(ps.opposition_ruling_date, d.code)) AS urgency,
    ldr.legal_basis
  FROM public.procedural_stages ps
  CROSS JOIN (VALUES ('DL-02'), ('DL-03')) AS d(code)
  JOIN public.legal_deadlines_reference ldr ON ldr.code = d.code
  WHERE ps.case_id = p_case_id
    AND ps.opposition_ruling_date IS NOT NULL
  ORDER BY deadline_date ASC;
$$;

COMMENT ON FUNCTION public.get_appeal_deadlines(uuid)
  IS 'Computes appeal deadlines from opposition_ruling_date using DL-02 (10 days) and DL-03 (extended window).';

-- RPC: dashboard stats
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE (
  total_cases bigint,
  active_cases bigint,
  total_clients bigint,
  urgent_deadlines bigint,
  total_bail_unpaid numeric,
  nearest_prescription_date date,
  nearest_prescription_case text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (SELECT count(*) FROM public.cases) AS total_cases,
    (SELECT count(*) FROM public.cases
     WHERE procedural_status NOT IN ('صدر الحكم بالبراءة', 'أخرى')) AS active_cases,
    (SELECT count(*) FROM public.clients) AS total_clients,
    (SELECT count(*) FROM public.schedule
     WHERE session_date >= CURRENT_DATE
       AND session_date <= CURRENT_DATE + INTERVAL '3 days') AS urgent_deadlines,
    (SELECT COALESCE(SUM(ps.bail_amount_paid - c.bail_amount_egp), 0)
     FROM public.cases c
     JOIN public.procedural_stages ps ON ps.case_id = c.id
     WHERE ps.bail_payment_status = 'غير مسدد'
       AND c.bail_amount_egp > 0) AS total_bail_unpaid,
    (SELECT MIN(ps.prescription_date)
     FROM public.procedural_stages ps
     WHERE ps.prescription_date >= CURRENT_DATE) AS nearest_prescription_date,
    (SELECT c.case_code
     FROM public.procedural_stages ps
     JOIN public.cases c ON c.id = ps.case_id
     WHERE ps.prescription_date >= CURRENT_DATE
     ORDER BY ps.prescription_date ASC
     LIMIT 1) AS nearest_prescription_case;
$$;

COMMENT ON FUNCTION public.get_dashboard_stats()
  IS 'Returns aggregated dashboard KPIs: case counts, urgent deadlines, unpaid bail, nearest prescription.';
