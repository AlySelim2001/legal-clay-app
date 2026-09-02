// ============================================================
// CRIM-SYS Enterprise — Service Layer
// All database operations go through here.
// No direct supabase calls from components.
// ============================================================

import { supabase } from "@/lib/supabase";
import type {
  PersonRow,
  PersonInsert,
  CaseRow,
  CaseInsert,
  SessionRow,
  SessionInsert,
  DocumentRow,
  DocumentInsert,
  ActionRow,
  ActionInsert,
  AuditLogRow,
  DashboardStats,
  CaseWithPerson,
  CaseWithAll,
  PersonWithCases,
} from "@/types/enterprise";

// ============================================================
// Persons Service
// ============================================================

export async function fetchPersons(): Promise<PersonRow[]> {
  const { data, error } = await supabase
    .from("persons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as PersonRow[];
}

export async function fetchPerson(personCode: string): Promise<PersonWithCases> {
  const { data, error } = await supabase
    .from("persons")
    .select("*, cases:enterprise_cases(*)")
    .eq("person_code", personCode)
    .single();
  if (error) throw new Error(error.message);
  return data as PersonWithCases;
}

export async function createPerson(input: PersonInsert): Promise<PersonRow> {
  const { data, error } = await supabase
    .from("persons")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PersonRow;
}

export async function updatePerson(
  id: string,
  input: Partial<PersonInsert>,
): Promise<PersonRow> {
  const { data, error } = await supabase
    .from("persons")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PersonRow;
}

export async function deletePerson(id: string): Promise<void> {
  const { error } = await supabase.from("persons").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function searchPersons(query: string): Promise<PersonRow[]> {
  const { data, error } = await supabase
    .from("persons")
    .select("*")
    .or(`legal_full_name.ilike.%${query}%,person_code.ilike.%${query}%,national_id_display.ilike.%${query}%`)
    .limit(20);
  if (error) throw new Error(error.message);
  return data as PersonRow[];
}

// ============================================================
// Cases Service
// ============================================================

export async function fetchCases(): Promise<CaseWithPerson[]> {
  const { data, error } = await supabase
    .from("enterprise_cases")
    .select("*, person:persons(*)")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as CaseWithPerson[];
}

export async function fetchCase(caseCode: string): Promise<CaseWithAll> {
  const { data, error } = await supabase
    .from("enterprise_cases")
    .select(`
      *,
      person:persons(*),
      sessions:enterprise_sessions(*),
      documents:enterprise_documents(*),
      actions:enterprise_actions(*)
    `)
    .eq("case_code", caseCode)
    .single();
  if (error) throw new Error(error.message);
  return data as CaseWithAll;
}

export async function createCase(input: CaseInsert): Promise<CaseRow> {
  const { data, error } = await supabase
    .from("enterprise_cases")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CaseRow;
}

export async function updateCase(
  id: string,
  input: Partial<CaseInsert>,
): Promise<CaseRow> {
  const { data, error } = await supabase
    .from("enterprise_cases")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as CaseRow;
}

export async function deleteCase(id: string): Promise<void> {
  const { error } = await supabase.from("enterprise_cases").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function searchCases(query: string): Promise<CaseWithPerson[]> {
  const { data, error } = await supabase
    .from("enterprise_cases")
    .select("*, person:persons(*)")
    .or(`case_number.ilike.%${query}%,case_code.ilike.%${query}%,court_name.ilike.%${query}%`)
    .limit(30);
  if (error) throw new Error(error.message);
  return data as CaseWithPerson[];
}

// ============================================================
// Sessions Service
// ============================================================

export async function fetchSessions(caseId?: string): Promise<SessionRow[]> {
  let query = supabase
    .from("enterprise_sessions")
    .select("*")
    .order("session_date_time", { ascending: true });
  if (caseId) query = query.eq("case_id", caseId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as SessionRow[];
}

export async function fetchUpcomingSessions(): Promise<SessionRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("enterprise_sessions")
    .select("*, case:enterprise_cases(case_code, case_number, court_name)")
    .gte("session_date_time", now)
    .order("session_date_time", { ascending: true })
    .limit(20);
  if (error) throw new Error(error.message);
  return data as SessionRow[];
}

export async function createSession(input: SessionInsert): Promise<SessionRow> {
  const { data, error } = await supabase
    .from("enterprise_sessions")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as SessionRow;
}

export async function updateSession(
  id: string,
  input: Partial<SessionInsert>,
): Promise<SessionRow> {
  const { data, error } = await supabase
    .from("enterprise_sessions")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as SessionRow;
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from("enterprise_sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================
// Documents Service
// ============================================================

export async function fetchDocuments(caseId?: string): Promise<DocumentRow[]> {
  let query = supabase
    .from("enterprise_documents")
    .select("*")
    .order("uploaded_at", { ascending: false });
  if (caseId) query = query.eq("case_id", caseId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as DocumentRow[];
}

export async function createDocument(input: DocumentInsert): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from("enterprise_documents")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as DocumentRow;
}

export async function updateDocument(
  id: string,
  input: Partial<DocumentInsert>,
): Promise<DocumentRow> {
  const { data, error } = await supabase
    .from("enterprise_documents")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as DocumentRow;
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from("enterprise_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Generate a signed URL for secure document download.
 * The URL expires after 3600 seconds (1 hour).
 */
export async function getDocumentDownloadUrl(
  storageKey: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("case-attachments")
    .createSignedUrl(storageKey, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

// ============================================================
// Actions Service
// ============================================================

export async function fetchActions(caseId?: string): Promise<ActionRow[]> {
  let query = supabase
    .from("enterprise_actions")
    .select("*")
    .order("created_at", { ascending: false });
  if (caseId) query = query.eq("case_id", caseId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as ActionRow[];
}

export async function fetchOverdueActions(): Promise<ActionRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("enterprise_actions")
    .select("*, case:enterprise_cases(case_code, case_number)")
    .lte("due_date", now)
    .eq("proposed_or_completed", "مقترح")
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data as ActionRow[];
}

export async function createAction(input: ActionInsert): Promise<ActionRow> {
  const { data, error } = await supabase
    .from("enterprise_actions")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ActionRow;
}

export async function updateAction(
  id: string,
  input: Partial<ActionInsert>,
): Promise<ActionRow> {
  const { data, error } = await supabase
    .from("enterprise_actions")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ActionRow;
}

export async function deleteAction(id: string): Promise<void> {
  const { error } = await supabase.from("enterprise_actions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ============================================================
// Audit Log Service
// ============================================================

export async function fetchAuditLog(
  entityType?: string,
  entityId?: string,
): Promise<AuditLogRow[]> {
  let query = supabase
    .from("enterprise_audit_log")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(100);
  if (entityType) query = query.eq("entity_type", entityType);
  if (entityId) query = query.eq("entity_id", entityId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as AuditLogRow[];
}

// ============================================================
// Dashboard Stats
// ============================================================

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const now = new Date().toISOString();
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString();

  const [casesRes, personsRes, sessionsRes, actionsRes, docsRes, recentRes] =
    await Promise.all([
      supabase.from("enterprise_cases").select("id", { count: "exact", head: true }),
      supabase.from("persons").select("id", { count: "exact", head: true }),
      supabase
        .from("enterprise_sessions")
        .select("id")
        .gte("session_date_time", now)
        .lte("session_date_time", in7Str),
      supabase
        .from("enterprise_actions")
        .select("id")
        .lte("due_date", now)
        .eq("proposed_or_completed", "مقترح"),
      supabase
        .from("enterprise_documents")
        .select("id")
        .eq("review_status", "بانتظار المراجعة"),
      supabase
        .from("enterprise_cases")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1),
    ]);

  return {
    totalCases: casesRes.count ?? 0,
    totalPersons: personsRes.count ?? 0,
    upcomingSessions: sessionsRes.data?.length ?? 0,
    overdueActions: actionsRes.data?.length ?? 0,
    unreviewedDocuments: docsRes.data?.length ?? 0,
    lastUpdated: recentRes.data?.[0]?.updated_at ?? new Date().toISOString(),
  };
}

// ============================================================
// Unified Search (across all entities)
// ============================================================

export async function unifiedSearch(query: string): Promise<{
  persons: PersonRow[];
  cases: CaseWithPerson[];
}> {
  if (!query || query.length < 2) return { persons: [], cases: [] };

  const [persons, cases] = await Promise.all([
    searchPersons(query),
    searchCases(query),
  ]);

  return { persons, cases };
}
