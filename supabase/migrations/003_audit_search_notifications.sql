-- ============================================================
-- CRIM-SYS 2026 — Migration 003: Audit, Search, Notifications
-- ============================================================

-- =================== AUDIT LOG TABLE ========================
CREATE TABLE public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  text NOT NULL,
  record_id   uuid NOT NULL,
  changed_by  uuid REFERENCES auth.users(id),
  changed_at  timestamptz NOT NULL DEFAULT now(),
  old_values  jsonb,
  new_values  jsonb
);

CREATE INDEX idx_audit_log_table_name ON public.audit_log (table_name);
CREATE INDEX idx_audit_log_record_id ON public.audit_log (record_id);
CREATE INDEX idx_audit_log_changed_at ON public.audit_log (changed_at DESC);
CREATE INDEX idx_audit_log_table_record ON public.audit_log (table_name, record_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "admin_full_access_audit_log"
  ON public.audit_log FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Assistant: read-only
CREATE POLICY "assistant_select_audit_log"
  ON public.audit_log FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'assistant'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'assistant'
  );

-- ============== GENERIC AUDIT TRIGGER FUNCTION ===============
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.audit_log (
    table_name,
    record_id,
    changed_by,
    old_values,
    new_values
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.audit_trigger_fn()
  IS 'Generic audit trigger — logs old/new values for INSERT, UPDATE, DELETE on audited tables.';

-- Attach to cases
CREATE TRIGGER trg_cases_audit
  AFTER INSERT OR UPDATE ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_fn();

-- Attach to procedural_stages
CREATE TRIGGER trg_procedural_stages_audit
  AFTER INSERT OR UPDATE ON public.procedural_stages
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger_fn();

-- ============ RPC: GET AUDIT TRAIL FOR A RECORD ==============
CREATE OR REPLACE FUNCTION public.get_audit_trail(
  p_table_name text,
  p_record_id uuid
)
RETURNS TABLE (
  id uuid,
  changed_by uuid,
  changed_at timestamptz,
  old_values jsonb,
  new_values jsonb,
  changed_by_email text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    al.id,
    al.changed_by,
    al.changed_at,
    al.old_values,
    al.new_values,
    au.email AS changed_by_email
  FROM public.audit_log al
  LEFT JOIN auth.users au ON au.id = al.changed_by
  WHERE al.table_name = p_table_name
    AND al.record_id = p_record_id
  ORDER BY al.changed_at DESC;
$$;

COMMENT ON FUNCTION public.get_audit_trail(text, uuid)
  IS 'Returns the full audit trail for a specific table record with user emails.';

-- ============ RPC: UNIFIED FULL-TEXT SEARCH ==================
CREATE OR REPLACE FUNCTION public.global_search(
  p_query text
)
RETURNS TABLE (
  result_type text,
  id uuid,
  title text,
  subtitle text,
  code text
)
LANGUAGE sql
STABLE
AS $$
  -- Search cases
  SELECT
    'case'::text AS result_type,
    c.id,
    c.case_no AS title,
    c.court_name AS subtitle,
    c.case_code AS code
  FROM public.cases c
  WHERE c.case_no ILIKE '%' || p_query || '%'
     OR c.case_code ILIKE '%' || p_query || '%'
     OR c.memo_notes ILIKE '%' || p_query || '%'
     OR c.tactical_classification ILIKE '%' || p_query || '%'

  UNION ALL

  -- Search clients
  SELECT
    'client'::text AS result_type,
    cl.id,
    cl.full_name AS title,
    cl.phone AS subtitle,
    cl.client_code AS code
  FROM public.clients cl
  WHERE cl.full_name ILIKE '%' || p_query || '%'
     OR cl.client_code ILIKE '%' || p_query || '%'
     OR cl.national_id ILIKE '%' || p_query || '%'

  ORDER BY result_type, title
  LIMIT 20;
$$;

COMMENT ON FUNCTION public.global_search(text)
  IS 'Unified search across cases and clients. Returns grouped results for the top bar search.';

-- ============ RPC: GET UPCOMING NOTIFICATIONS =================
CREATE OR REPLACE FUNCTION public.get_pending_notifications()
RETURNS TABLE (
  schedule_id uuid,
  case_code text,
  case_no text,
  session_type text,
  session_date date,
  days_until integer,
  notification_type text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id AS schedule_id,
    c.case_code,
    c.case_no,
    s.session_type,
    s.session_date,
    (s.session_date - CURRENT_DATE)::integer AS days_until,
    CASE
      WHEN s.session_date - CURRENT_DATE = 0 THEN 'today'
      WHEN s.session_date - CURRENT_DATE = 1 THEN '1d'
      WHEN s.session_date - CURRENT_DATE = 7 THEN '7d'
      ELSE 'none'
    END AS notification_type
  FROM public.schedule s
  JOIN public.cases c ON c.id = s.case_id
  WHERE s.session_date >= CURRENT_DATE
    AND s.session_date <= CURRENT_DATE + INTERVAL '7 days'
    AND (
      (s.session_date - CURRENT_DATE = 7 AND s.notified_7d = false)
      OR (s.session_date - CURRENT_DATE = 1 AND s.notified_1d = false)
      OR (s.session_date - CURRENT_DATE = 0 AND s.notified_today = false)
    )
  ORDER BY s.session_date ASC;
$$;

-- ============ RPC: MARK NOTIFICATIONS SENT ====================
CREATE OR REPLACE FUNCTION public.mark_notification_sent(
  p_schedule_id uuid,
  p_notification_type text
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.schedule
  SET
    notified_7d = CASE WHEN p_notification_type = '7d' THEN true ELSE notified_7d END,
    notified_1d = CASE WHEN p_notification_type = '1d' THEN true ELSE notified_1d END,
    notified_today = CASE WHEN p_notification_type = 'today' THEN true ELSE notified_today END
  WHERE id = p_schedule_id;
$$;

-- ============ SEED: pg_cron extension ========================
-- NOTE: pg_cron must be enabled by the Supabase admin.
-- Run: CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Then schedule the daily notification job:
--
-- SELECT cron.schedule(
--   'crimsys-daily-notifications',
--   '0 4 * * *',  -- 06:00 Cairo = 04:00 UTC
--   $$
--   -- This would call a Supabase Edge Function via HTTP
--   -- For now, we log pending notifications in a staging table
--   INSERT INTO public.notification_queue (schedule_id, notification_type, message, sent)
--   SELECT
--     schedule_id,
--     notification_type,
--     '⏰ تذكير: جلسة ' || session_type || ' خلال ' || days_until || ' يوم للقضية ' || case_no,
--     false
--   FROM public.get_pending_notifications()
--   ON CONFLICT DO NOTHING;
--   $$
-- );
