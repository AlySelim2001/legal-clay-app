-- ============================================================
-- Migration: 010_fix_security_and_rls.sql
-- Purpose: harden Supabase security, enforce role-based RLS, and
--          remove permissive access patterns that allow broad reads/writes.
-- ============================================================

BEGIN;

-- Ensure the role is evaluated consistently from JWT claims.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() ->> 'role', ''),
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'role', ''),
    NULLIF(auth.jwt() -> 'custom_claims' ->> 'role', '')
  );
$$;

COMMENT ON FUNCTION public.get_current_user_role() IS
  'Returns the effective user role from JWT claims, used by RLS policies.';

-- Optional helper: allows role checks without repeating JWT logic.
CREATE OR REPLACE FUNCTION public.has_role(p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.get_current_user_role() = p_role;
$$;

COMMENT ON FUNCTION public.has_role(text) IS
  'Checks whether the current authenticated user matches the given role.';

-- ----------------------------------------------------------------
-- Harden access at the table level.
-- ----------------------------------------------------------------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defenses_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_deadlines_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedural_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;
ALTER TABLE public.defenses_catalog FORCE ROW LEVEL SECURITY;
ALTER TABLE public.legal_deadlines_reference FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.procedural_stages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.external_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attachments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.schedule FORCE ROW LEVEL SECURITY;

ALTER TABLE public.persons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_cases FORCE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_actions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_audit_log FORCE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- Remove any broad public access that may have been created earlier.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "admin_full_access_clients" ON public.clients;
DROP POLICY IF EXISTS "admin_full_access_defenses_catalog" ON public.defenses_catalog;
DROP POLICY IF EXISTS "admin_full_access_legal_deadlines_reference" ON public.legal_deadlines_reference;
DROP POLICY IF EXISTS "admin_full_access_cases" ON public.cases;
DROP POLICY IF EXISTS "admin_full_access_procedural_stages" ON public.procedural_stages;
DROP POLICY IF EXISTS "admin_full_access_external_records" ON public.external_records;
DROP POLICY IF EXISTS "admin_full_access_attachments" ON public.attachments;
DROP POLICY IF EXISTS "admin_full_access_schedule" ON public.schedule;
DROP POLICY IF EXISTS "assistant_crud_clients" ON public.clients;
DROP POLICY IF EXISTS "assistant_select_insert_update_cases" ON public.cases;
DROP POLICY IF EXISTS "assistant_insert_cases" ON public.cases;
DROP POLICY IF EXISTS "assistant_update_cases" ON public.cases;
DROP POLICY IF EXISTS "assistant_crud_procedural_stages" ON public.procedural_stages;
DROP POLICY IF EXISTS "assistant_crud_schedule" ON public.schedule;
DROP POLICY IF EXISTS "assistant_crud_attachments" ON public.attachments;
DROP POLICY IF EXISTS "assistant_select_legal_deadlines_reference" ON public.legal_deadlines_reference;
DROP POLICY IF EXISTS "assistant_select_defenses_catalog" ON public.defenses_catalog;

DROP POLICY IF EXISTS "admin_all_persons" ON public.persons;
DROP POLICY IF EXISTS "admin_all_cases" ON public.enterprise_cases;
DROP POLICY IF EXISTS "admin_all_sessions" ON public.enterprise_sessions;
DROP POLICY IF EXISTS "admin_all_documents" ON public.enterprise_documents;
DROP POLICY IF EXISTS "admin_all_actions" ON public.enterprise_actions;
DROP POLICY IF EXISTS "admin_all_audit" ON public.enterprise_audit_log;
DROP POLICY IF EXISTS "lawyer_all_cases" ON public.enterprise_cases;
DROP POLICY IF EXISTS "lawyer_all_sessions" ON public.enterprise_sessions;
DROP POLICY IF EXISTS "lawyer_all_documents" ON public.enterprise_documents;
DROP POLICY IF EXISTS "lawyer_all_actions" ON public.enterprise_actions;
DROP POLICY IF EXISTS "lawyer_select_persons" ON public.persons;
DROP POLICY IF EXISTS "lawyer_insert_persons" ON public.persons;
DROP POLICY IF EXISTS "lawyer_update_persons" ON public.persons;
DROP POLICY IF EXISTS "assistant_select_cases" ON public.enterprise_cases;
DROP POLICY IF EXISTS "assistant_insert_cases" ON public.enterprise_cases;
DROP POLICY IF EXISTS "assistant_update_cases" ON public.enterprise_cases;
DROP POLICY IF EXISTS "assistant_all_sessions" ON public.enterprise_sessions;
DROP POLICY IF EXISTS "assistant_all_documents" ON public.enterprise_documents;
DROP POLICY IF EXISTS "assistant_all_actions" ON public.enterprise_actions;
DROP POLICY IF EXISTS "assistant_select_persons" ON public.persons;
DROP POLICY IF EXISTS "assistant_insert_persons" ON public.persons;
DROP POLICY IF EXISTS "readonly_select_persons" ON public.persons;
DROP POLICY IF EXISTS "readonly_select_cases" ON public.enterprise_cases;
DROP POLICY IF EXISTS "readonly_select_sessions" ON public.enterprise_sessions;
DROP POLICY IF EXISTS "readonly_select_documents" ON public.enterprise_documents;
DROP POLICY IF EXISTS "readonly_select_actions" ON public.enterprise_actions;
DROP POLICY IF EXISTS "readonly_select_audit" ON public.enterprise_audit_log;

-- ----------------------------------------------------------------
-- Deny anonymous / unauthenticated access.
-- ----------------------------------------------------------------
CREATE POLICY "deny_anonymous_access_clients"
  ON public.clients FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "deny_anonymous_access_defenses_catalog"
  ON public.defenses_catalog FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "deny_anonymous_access_legal_deadlines_reference"
  ON public.legal_deadlines_reference FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "deny_anonymous_access_cases"
  ON public.cases FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "deny_anonymous_access_procedural_stages"
  ON public.procedural_stages FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "deny_anonymous_access_external_records"
  ON public.external_records FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "deny_anonymous_access_attachments"
  ON public.attachments FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "deny_anonymous_access_schedule"
  ON public.schedule FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "deny_anonymous_access_persons"
  ON public.persons FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "deny_anonymous_access_enterprise_cases"
  ON public.enterprise_cases FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "deny_anonymous_access_enterprise_sessions"
  ON public.enterprise_sessions FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "deny_anonymous_access_enterprise_documents"
  ON public.enterprise_documents FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "deny_anonymous_access_enterprise_actions"
  ON public.enterprise_actions FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "deny_anonymous_access_enterprise_audit_log"
  ON public.enterprise_audit_log FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------------
-- Admin: full access.
-- ----------------------------------------------------------------
CREATE POLICY "admin_all_clients"
  ON public.clients FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "admin_all_defenses_catalog"
  ON public.defenses_catalog FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "admin_all_legal_deadlines_reference"
  ON public.legal_deadlines_reference FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "admin_all_cases"
  ON public.cases FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "admin_all_procedural_stages"
  ON public.procedural_stages FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "admin_all_external_records"
  ON public.external_records FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "admin_all_attachments"
  ON public.attachments FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "admin_all_schedule"
  ON public.schedule FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "admin_all_persons"
  ON public.persons FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "admin_all_enterprise_cases"
  ON public.enterprise_cases FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "admin_all_enterprise_sessions"
  ON public.enterprise_sessions FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "admin_all_enterprise_documents"
  ON public.enterprise_documents FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "admin_all_enterprise_actions"
  ON public.enterprise_actions FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

CREATE POLICY "admin_all_enterprise_audit_log"
  ON public.enterprise_audit_log FOR ALL
  USING (public.has_role('admin'))
  WITH CHECK (public.has_role('admin'));

-- ----------------------------------------------------------------
-- Lawyer: full access to case workflow records, read-only persons.
-- ----------------------------------------------------------------
CREATE POLICY "lawyer_case_read_write"
  ON public.cases FOR ALL
  USING (public.has_role('lawyer'))
  WITH CHECK (public.has_role('lawyer'));

CREATE POLICY "lawyer_stage_read_write"
  ON public.procedural_stages FOR ALL
  USING (public.has_role('lawyer'))
  WITH CHECK (public.has_role('lawyer'));

CREATE POLICY "lawyer_record_read_write"
  ON public.external_records FOR ALL
  USING (public.has_role('lawyer'))
  WITH CHECK (public.has_role('lawyer'));

CREATE POLICY "lawyer_attachment_read_write"
  ON public.attachments FOR ALL
  USING (public.has_role('lawyer'))
  WITH CHECK (public.has_role('lawyer'));

CREATE POLICY "lawyer_schedule_read_write"
  ON public.schedule FOR ALL
  USING (public.has_role('lawyer'))
  WITH CHECK (public.has_role('lawyer'));

CREATE POLICY "lawyer_select_persons"
  ON public.persons FOR SELECT
  USING (public.has_role('lawyer'));

CREATE POLICY "lawyer_insert_persons"
  ON public.persons FOR INSERT
  WITH CHECK (public.has_role('lawyer'));

CREATE POLICY "lawyer_update_persons"
  ON public.persons FOR UPDATE
  USING (public.has_role('lawyer'))
  WITH CHECK (public.has_role('lawyer'));

CREATE POLICY "lawyer_enterprise_case_access"
  ON public.enterprise_cases FOR ALL
  USING (public.has_role('lawyer'))
  WITH CHECK (public.has_role('lawyer'));

CREATE POLICY "lawyer_enterprise_session_access"
  ON public.enterprise_sessions FOR ALL
  USING (public.has_role('lawyer'))
  WITH CHECK (public.has_role('lawyer'));

CREATE POLICY "lawyer_enterprise_document_access"
  ON public.enterprise_documents FOR ALL
  USING (public.has_role('lawyer'))
  WITH CHECK (public.has_role('lawyer'));

CREATE POLICY "lawyer_enterprise_action_access"
  ON public.enterprise_actions FOR ALL
  USING (public.has_role('lawyer'))
  WITH CHECK (public.has_role('lawyer'));

CREATE POLICY "lawyer_reference_read_only"
  ON public.legal_deadlines_reference FOR SELECT
  USING (public.has_role('lawyer'));

CREATE POLICY "lawyer_catalog_read_only"
  ON public.defenses_catalog FOR SELECT
  USING (public.has_role('lawyer'));

CREATE POLICY "lawyer_clients_read_only"
  ON public.clients FOR SELECT
  USING (public.has_role('lawyer'));

-- ----------------------------------------------------------------
-- Assistant: restricted workflow access (no delete on core data).
-- ----------------------------------------------------------------
CREATE POLICY "assistant_client_select_insert_update"
  ON public.clients FOR SELECT
  USING (public.has_role('assistant'));

CREATE POLICY "assistant_client_insert"
  ON public.clients FOR INSERT
  WITH CHECK (public.has_role('assistant'));

CREATE POLICY "assistant_client_update"
  ON public.clients FOR UPDATE
  USING (public.has_role('assistant'))
  WITH CHECK (public.has_role('assistant'));

CREATE POLICY "assistant_case_select"
  ON public.cases FOR SELECT
  USING (public.has_role('assistant'));

CREATE POLICY "assistant_case_insert"
  ON public.cases FOR INSERT
  WITH CHECK (public.has_role('assistant'));

CREATE POLICY "assistant_case_update"
  ON public.cases FOR UPDATE
  USING (public.has_role('assistant'))
  WITH CHECK (public.has_role('assistant'));

CREATE POLICY "assistant_stage_all"
  ON public.procedural_stages FOR ALL
  USING (public.has_role('assistant'))
  WITH CHECK (public.has_role('assistant'));

CREATE POLICY "assistant_schedule_all"
  ON public.schedule FOR ALL
  USING (public.has_role('assistant'))
  WITH CHECK (public.has_role('assistant'));

CREATE POLICY "assistant_attachment_all"
  ON public.attachments FOR ALL
  USING (public.has_role('assistant'))
  WITH CHECK (public.has_role('assistant'));

CREATE POLICY "assistant_reference_read_only"
  ON public.legal_deadlines_reference FOR SELECT
  USING (public.has_role('assistant'));

CREATE POLICY "assistant_catalog_read_only"
  ON public.defenses_catalog FOR SELECT
  USING (public.has_role('assistant'));

CREATE POLICY "assistant_select_persons"
  ON public.persons FOR SELECT
  USING (public.has_role('assistant'));

CREATE POLICY "assistant_insert_persons"
  ON public.persons FOR INSERT
  WITH CHECK (public.has_role('assistant'));

CREATE POLICY "assistant_enterprise_case_access"
  ON public.enterprise_cases FOR ALL
  USING (public.has_role('assistant'))
  WITH CHECK (public.has_role('assistant'));

CREATE POLICY "assistant_enterprise_session_access"
  ON public.enterprise_sessions FOR ALL
  USING (public.has_role('assistant'))
  WITH CHECK (public.has_role('assistant'));

CREATE POLICY "assistant_enterprise_document_access"
  ON public.enterprise_documents FOR ALL
  USING (public.has_role('assistant'))
  WITH CHECK (public.has_role('assistant'));

CREATE POLICY "assistant_enterprise_action_access"
  ON public.enterprise_actions FOR ALL
  USING (public.has_role('assistant'))
  WITH CHECK (public.has_role('assistant'));

-- ----------------------------------------------------------------
-- Read-only users: selects only, no writes.
-- ----------------------------------------------------------------
CREATE POLICY "readonly_clients_select"
  ON public.clients FOR SELECT
  USING (public.has_role('readonly'));

CREATE POLICY "readonly_defenses_select"
  ON public.defenses_catalog FOR SELECT
  USING (public.has_role('readonly'));

CREATE POLICY "readonly_deadlines_select"
  ON public.legal_deadlines_reference FOR SELECT
  USING (public.has_role('readonly'));

CREATE POLICY "readonly_cases_select"
  ON public.cases FOR SELECT
  USING (public.has_role('readonly'));

CREATE POLICY "readonly_stage_select"
  ON public.procedural_stages FOR SELECT
  USING (public.has_role('readonly'));

CREATE POLICY "readonly_records_select"
  ON public.external_records FOR SELECT
  USING (public.has_role('readonly'));

CREATE POLICY "readonly_attachments_select"
  ON public.attachments FOR SELECT
  USING (public.has_role('readonly'));

CREATE POLICY "readonly_schedule_select"
  ON public.schedule FOR SELECT
  USING (public.has_role('readonly'));

CREATE POLICY "readonly_persons_select"
  ON public.persons FOR SELECT
  USING (public.has_role('readonly'));

CREATE POLICY "readonly_enterprise_cases_select"
  ON public.enterprise_cases FOR SELECT
  USING (public.has_role('readonly'));

CREATE POLICY "readonly_enterprise_sessions_select"
  ON public.enterprise_sessions FOR SELECT
  USING (public.has_role('readonly'));

CREATE POLICY "readonly_enterprise_documents_select"
  ON public.enterprise_documents FOR SELECT
  USING (public.has_role('readonly'));

CREATE POLICY "readonly_enterprise_actions_select"
  ON public.enterprise_actions FOR SELECT
  USING (public.has_role('readonly'));

CREATE POLICY "readonly_enterprise_audit_log_select"
  ON public.enterprise_audit_log FOR SELECT
  USING (public.has_role('readonly'));

-- ----------------------------------------------------------------
-- Security: ensure table ownership/permissions are not overly permissive.
-- Note: service_role is intentionally excluded from RLS restrictions and
--       is expected to be used only by trusted server-side code.
-- ----------------------------------------------------------------
REVOKE ALL ON TABLE public.clients FROM public;
REVOKE ALL ON TABLE public.defenses_catalog FROM public;
REVOKE ALL ON TABLE public.legal_deadlines_reference FROM public;
REVOKE ALL ON TABLE public.cases FROM public;
REVOKE ALL ON TABLE public.procedural_stages FROM public;
REVOKE ALL ON TABLE public.external_records FROM public;
REVOKE ALL ON TABLE public.attachments FROM public;
REVOKE ALL ON TABLE public.schedule FROM public;
REVOKE ALL ON TABLE public.persons FROM public;
REVOKE ALL ON TABLE public.enterprise_cases FROM public;
REVOKE ALL ON TABLE public.enterprise_sessions FROM public;
REVOKE ALL ON TABLE public.enterprise_documents FROM public;
REVOKE ALL ON TABLE public.enterprise_actions FROM public;
REVOKE ALL ON TABLE public.enterprise_audit_log FROM public;

-- The following grants are intentionally minimal; grant additional access
-- only to the authenticated role when required by the application.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.defenses_catalog TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.legal_deadlines_reference TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.procedural_stages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.external_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.schedule TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.persons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enterprise_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enterprise_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enterprise_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enterprise_actions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.enterprise_audit_log TO authenticated;

-- Service role has unrestricted access for trusted backend logic.
GRANT ALL ON TABLE public.clients TO service_role;
GRANT ALL ON TABLE public.defenses_catalog TO service_role;
GRANT ALL ON TABLE public.legal_deadlines_reference TO service_role;
GRANT ALL ON TABLE public.cases TO service_role;
GRANT ALL ON TABLE public.procedural_stages TO service_role;
GRANT ALL ON TABLE public.external_records TO service_role;
GRANT ALL ON TABLE public.attachments TO service_role;
GRANT ALL ON TABLE public.schedule TO service_role;
GRANT ALL ON TABLE public.persons TO service_role;
GRANT ALL ON TABLE public.enterprise_cases TO service_role;
GRANT ALL ON TABLE public.enterprise_sessions TO service_role;
GRANT ALL ON TABLE public.enterprise_documents TO service_role;
GRANT ALL ON TABLE public.enterprise_actions TO service_role;
GRANT ALL ON TABLE public.enterprise_audit_log TO service_role;

COMMIT;
