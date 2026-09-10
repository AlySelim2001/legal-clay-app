-- ============================================================
-- Migration 009 — Egyptian Legal Deadline Logic (P1)
--
-- Fixes three defects in the deadline engine:
--   1. classify_urgency was IMMUTABLE while depending on CURRENT_DATE.
--      IMMUTABLE promises the same output forever for the same input, so the
--      planner may inline/cache results across statements and even across
--      days — urgency silently rots. It is now STABLE (per-statement
--      consistency), the correct volatility for time-dependent SQL.
--   2. "Today" was UTC CURRENT_DATE. Egypt is UTC+2/+3, so between 00:00 and
--      02:00 Cairo time (03:00 in DST) the whole practice's deadlines were
--      classified one day too generously — a deadline falling "today" Cairo
--      time still reported "tomorrow". All "today" math now pins to
--      Africa/Cairo explicitly.
--   3. compute_deadline counted calendar days, ignoring the Egyptian weekend
--      (Friday/Saturday per the courts' schedule) and official holidays.
--      It now walks working days only, via is_working_day().
--
-- SAFETY: idempotent (CREATE OR REPLACE / CREATE TABLE IF NOT EXISTS) and
-- lossless: no existing rows or columns are touched; only functions are
-- replaced and one new table is added.
--
-- ⚠️ TODO(legal): the egyptian_holidays table ships EMPTY by design.
-- The official holiday calendar (Eid al-Fitr, Eid al-Adha, Coptic Christmas,
-- Sham El-Nessim, 25 Jan, 25 Apr, 1 May, 30 Jun, 23 Jul, 6 Oct, ...) moves
-- with the lunar/Hijri and Coptic calendars and MUST be entered or approved
-- by the practice's legal reviewer before is_working_day() can exclude it.
-- Until rows exist, compute_deadline still skips Fri/Sat correctly but does
-- NOT skip official holidays. The seed INSERT is intentionally commented out.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Egyptian holidays stub
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.egyptian_holidays (
  holiday_date date PRIMARY KEY,
  name_ar      text NOT NULL,
  -- 'official' = courts closed (moves deadline), 'observance' = informational only
  kind         text NOT NULL DEFAULT 'official'
                CHECK (kind IN ('official', 'observance')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.egyptian_holidays IS
  'Official Egyptian court holidays. ⚠️ MUST be filled/approved by legal review before compute_deadline() skips them. Empty = only Fri/Sat weekend is skipped.';

-- TODO(legal): uncomment and review before production use. Dates below are
-- EXAMPLES of the fixed-date civil holidays only — Hijri holidays must be
-- added per year:
-- INSERT INTO public.egyptian_holidays (holiday_date, name_ar, kind) VALUES
--   ('2026-01-07', 'عيد الميلاد الشرقي',   'official'),
--   ('2026-01-25', 'عيد الشرطة / ثورة يناير', 'official'),
--   ('2026-04-25', 'عيد تحرير سيناء',       'official'),
--   ('2026-05-01', 'عيد العمال',            'official'),
--   ('2026-06-30', 'ثورة 30 يونيو',         'official'),
--   ('2026-07-23', 'ثورة 23 يوليو',         'official'),
--   ('2026-10-06', 'عيد القوات المسلحة',    'official');

-- ------------------------------------------------------------
-- 2. is_working_day(date) — STABLE (reads a table, so it can't be IMMUTABLE)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_working_day(p_date date)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    -- Egyptian courts' weekend: Friday (6) and Saturday (7).
    EXTRACT(ISODOW FROM p_date)::int NOT IN (5, 6)
    AND NOT EXISTS (
      SELECT 1 FROM public.egyptian_holidays h
      WHERE h.holiday_date = p_date
        AND h.kind = 'official'
    );
$$;

COMMENT ON FUNCTION public.is_working_day(date)
  IS 'True when the date is neither an Egyptian court weekend (Fri/Sat) nor an official holiday. STABLE: depends on egyptian_holidays contents, not just its arguments.';

-- ------------------------------------------------------------
-- 3. compute_deadline — now advances over WORKING days
--    (was: start_date + N * interval, counting weekends as deadlines)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_deadline(
  start_date date,
  deadline_code text
)
RETURNS date
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  ref   RECORD;
  cur   date;
  added int;
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
    -- Procedural days in court practice = working days. Walk day by day,
    -- skipping Fri/Sat and (once populated) official holidays.
    cur   := start_date;
    added := 0;
    WHILE added < ref.duration_value LOOP
      cur := cur + 1;
      IF public.is_working_day(cur) THEN
        added := added + 1;
      END IF;
    END LOOP;
    RETURN cur;
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
  IS 'Computes a deadline from legal_deadlines_reference. Day-based deadlines advance over WORKING days (skips Egyptian Fri/Sat weekend + official holidays once egyptian_holidays is populated).';

-- ------------------------------------------------------------
-- 4. classify_urgency — STABLE (was IMMUTABLE + CURRENT_DATE = planner lie)
--    "Today" pinned to Africa/Cairo (was UTC CURRENT_DATE = 1-day error
--    for the first hours of the Cairo day).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.classify_urgency(
  target_date date
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN target_date IS NULL THEN 'normal'
    WHEN target_date - (now() AT TIME ZONE 'Africa/Cairo')::date <= 3 THEN 'critical'
    WHEN target_date - (now() AT TIME ZONE 'Africa/Cairo')::date <= 7 THEN 'high'
    ELSE 'normal'
  END;
$$;

COMMENT ON FUNCTION public.classify_urgency(date)
  IS 'Urgency vs. today in Africa/Cairo: critical (<=3 days), high (<=7), normal. STABLE (not IMMUTABLE): the result depends on the current Cairo date, so it must be re-evaluated per statement, never cached forever.';

-- ------------------------------------------------------------
-- 5. Rebuild dependent RPCs/views so they pick up the new function bodies
--    AND the same Cairo-pinned "today" for days_remaining (previously
--    CURRENT_DATE in UTC — same 1-day skew as #4).
-- ------------------------------------------------------------
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
    (public.compute_deadline(c.filing_date, ldr.code)
      - (now() AT TIME ZONE 'Africa/Cairo')::date)::integer AS days_remaining,
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
    (public.compute_deadline(ps.opposition_ruling_date, d.code)
      - (now() AT TIME ZONE 'Africa/Cairo')::date)::integer AS days_remaining,
    public.classify_urgency(public.compute_deadline(ps.opposition_ruling_date, d.code)) AS urgency,
    ldr.legal_basis
  FROM public.procedural_stages ps
  CROSS JOIN (VALUES ('DL-02'), ('DL-03')) AS d(code)
  JOIN public.legal_deadlines_reference ldr ON ldr.code = d.code
  WHERE ps.case_id = p_case_id
    AND ps.opposition_ruling_date IS NOT NULL;
$$;

-- Deadline engine audit note: run after applying to verify the volatility fix.
--   SELECT proname, provolatile FROM pg_proc
--   WHERE proname IN ('classify_urgency','compute_deadline','is_working_day');
-- Expected: classify_urgency → s, compute_deadline → s, is_working_day → s.
