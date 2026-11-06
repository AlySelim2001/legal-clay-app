// ============================================================
// CRIM-SYS Enterprise — Service Layer
// All database operations go through here.
// Supports both remote Supabase and self-contained mock store.
// ============================================================

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { sanitizeForLocalStorage } from "@/lib/sanitize";
import { MockEnterpriseStore } from "@/lib/enterprise/mock-store";
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
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.getPersons();
  }
  try {
    const { data, error } = await supabase
      .from("persons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return sanitizeForLocalStorage(data as PersonRow[]);
  } catch (err) {
    console.warn("[CRIM-SYS] fetchPersons falling back to mock:", err);
    return MockEnterpriseStore.getPersons();
  }
}

export async function fetchPerson(personCode: string): Promise<PersonWithCases> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.getPerson(personCode);
  }
  try {
    const { data, error } = await supabase
      .from("persons")
      .select("*, cases:enterprise_cases(*)")
      .eq("person_code", personCode)
      .single();
    if (error) throw new Error(error.message);
    return sanitizeForLocalStorage(data as PersonWithCases);
  } catch (err) {
    console.warn("[CRIM-SYS] fetchPerson falling back to mock:", err);
    return MockEnterpriseStore.getPerson(personCode);
  }
}

export async function createPerson(input: PersonInsert): Promise<PersonRow> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.addPerson(input);
  }
  try {
    const { data, error } = await supabase
      .from("persons")
      .insert(input)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as PersonRow;
  } catch (err) {
    console.warn("[CRIM-SYS] createPerson falling back to mock:", err);
    return MockEnterpriseStore.addPerson(input);
  }
}

export async function updatePerson(
  id: string,
  input: Partial<PersonInsert>,
): Promise<PersonRow> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.updatePerson(id, input);
  }
  try {
    const { data, error } = await supabase
      .from("persons")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as PersonRow;
  } catch (err) {
    console.warn("[CRIM-SYS] updatePerson falling back to mock:", err);
    return MockEnterpriseStore.updatePerson(id, input);
  }
}

export async function deletePerson(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    MockEnterpriseStore.deletePerson(id);
    return;
  }
  try {
    const { error } = await supabase.from("persons").delete().eq("id", id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn("[CRIM-SYS] deletePerson falling back to mock:", err);
    MockEnterpriseStore.deletePerson(id);
  }
}

export async function searchPersons(query: string): Promise<PersonRow[]> {
  if (!isSupabaseConfigured) {
    const q = query.toLowerCase();
    return MockEnterpriseStore.getPersons().filter(
      (p) =>
        p.legal_full_name.toLowerCase().includes(q) ||
        p.person_code.toLowerCase().includes(q) ||
        (p.national_id_display && p.national_id_display.includes(q)),
    );
  }
  try {
    const { data, error } = await supabase
      .from("persons")
      .select("*")
      .or(`legal_full_name.ilike.%${query}%,person_code.ilike.%${query}%,national_id_display.ilike.%${query}%`)
      .limit(20);
    if (error) throw new Error(error.message);
    return sanitizeForLocalStorage(data as PersonRow[]);
  } catch {
    const q = query.toLowerCase();
    return MockEnterpriseStore.getPersons().filter(
      (p) =>
        p.legal_full_name.toLowerCase().includes(q) ||
        p.person_code.toLowerCase().includes(q),
    );
  }
}

// ============================================================
// Cases Service
// ============================================================

export async function fetchCases(): Promise<CaseWithPerson[]> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.getCases();
  }
  try {
    const { data, error } = await supabase
      .from("enterprise_cases")
      .select("*, person:persons(*)")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return sanitizeForLocalStorage(data as CaseWithPerson[]);
  } catch (err) {
    console.warn("[CRIM-SYS] fetchCases falling back to mock:", err);
    return MockEnterpriseStore.getCases();
  }
}

export async function fetchCase(caseCode: string): Promise<CaseWithAll> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.getCase(caseCode);
  }
  try {
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
    return sanitizeForLocalStorage(data as CaseWithAll);
  } catch (err) {
    console.warn("[CRIM-SYS] fetchCase falling back to mock:", err);
    return MockEnterpriseStore.getCase(caseCode);
  }
}

export async function createCase(input: CaseInsert): Promise<CaseRow> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.addCase(input);
  }
  try {
    const { data, error } = await supabase
      .from("enterprise_cases")
      .insert(input)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as CaseRow;
  } catch (err) {
    console.warn("[CRIM-SYS] createCase falling back to mock:", err);
    return MockEnterpriseStore.addCase(input);
  }
}

export async function updateCase(
  id: string,
  input: Partial<CaseInsert>,
): Promise<CaseRow> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.updateCase(id, input);
  }
  try {
    const { data, error } = await supabase
      .from("enterprise_cases")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as CaseRow;
  } catch (err) {
    console.warn("[CRIM-SYS] updateCase falling back to mock:", err);
    return MockEnterpriseStore.updateCase(id, input);
  }
}

export async function deleteCase(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    MockEnterpriseStore.deleteCase(id);
    return;
  }
  try {
    const { error } = await supabase.from("enterprise_cases").delete().eq("id", id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn("[CRIM-SYS] deleteCase falling back to mock:", err);
    MockEnterpriseStore.deleteCase(id);
  }
}

export async function searchCases(query: string): Promise<CaseWithPerson[]> {
  if (!isSupabaseConfigured) {
    const q = query.toLowerCase();
    return MockEnterpriseStore.getCases().filter(
      (c) =>
        c.case_number.toLowerCase().includes(q) ||
        c.case_code.toLowerCase().includes(q) ||
        c.court_name.toLowerCase().includes(q) ||
        (c.person && c.person.legal_full_name.toLowerCase().includes(q)),
    );
  }
  try {
    const { data, error } = await supabase
      .from("enterprise_cases")
      .select("*, person:persons(*)")
      .or(`case_number.ilike.%${query}%,case_code.ilike.%${query}%,court_name.ilike.%${query}%`)
      .limit(30);
    if (error) throw new Error(error.message);
    return sanitizeForLocalStorage(data as CaseWithPerson[]);
  } catch {
    const q = query.toLowerCase();
    return MockEnterpriseStore.getCases().filter(
      (c) =>
        c.case_number.toLowerCase().includes(q) ||
        c.case_code.toLowerCase().includes(q),
    );
  }
}

// ============================================================
// Sessions Service
// ============================================================

export async function fetchSessions(caseId?: string): Promise<SessionRow[]> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.getSessions(caseId);
  }
  try {
    let query = supabase
      .from("enterprise_sessions")
      .select("*")
      .order("session_date_time", { ascending: true });
    if (caseId) query = query.eq("case_id", caseId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as SessionRow[];
  } catch (err) {
    console.warn("[CRIM-SYS] fetchSessions falling back to mock:", err);
    return MockEnterpriseStore.getSessions(caseId);
  }
}

export async function fetchUpcomingSessions(): Promise<SessionRow[]> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.getUpcomingSessions() as unknown as SessionRow[];
  }
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("enterprise_sessions")
      .select("*, case:enterprise_cases(case_code, case_number, court_name)")
      .gte("session_date_time", now)
      .order("session_date_time", { ascending: true })
      .limit(20);
    if (error) throw new Error(error.message);
    return data as SessionRow[];
  } catch (err) {
    console.warn("[CRIM-SYS] fetchUpcomingSessions falling back to mock:", err);
    return MockEnterpriseStore.getUpcomingSessions() as unknown as SessionRow[];
  }
}

export async function createSession(input: SessionInsert): Promise<SessionRow> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.addSession(input);
  }
  try {
    const { data, error } = await supabase
      .from("enterprise_sessions")
      .insert(input)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as SessionRow;
  } catch (err) {
    console.warn("[CRIM-SYS] createSession falling back to mock:", err);
    return MockEnterpriseStore.addSession(input);
  }
}

export async function updateSession(
  id: string,
  input: Partial<SessionInsert>,
): Promise<SessionRow> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.updateSession(id, input);
  }
  try {
    const { data, error } = await supabase
      .from("enterprise_sessions")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as SessionRow;
  } catch (err) {
    console.warn("[CRIM-SYS] updateSession falling back to mock:", err);
    return MockEnterpriseStore.updateSession(id, input);
  }
}

export async function deleteSession(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    MockEnterpriseStore.deleteSession(id);
    return;
  }
  try {
    const { error } = await supabase.from("enterprise_sessions").delete().eq("id", id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn("[CRIM-SYS] deleteSession falling back to mock:", err);
    MockEnterpriseStore.deleteSession(id);
  }
}

// ============================================================
// Documents Service
// ============================================================

export async function fetchDocuments(caseId?: string): Promise<DocumentRow[]> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.getDocuments(caseId);
  }
  try {
    let query = supabase
      .from("enterprise_documents")
      .select("*")
      .order("uploaded_at", { ascending: false });
    if (caseId) query = query.eq("case_id", caseId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as DocumentRow[];
  } catch (err) {
    console.warn("[CRIM-SYS] fetchDocuments falling back to mock:", err);
    return MockEnterpriseStore.getDocuments(caseId);
  }
}

export async function createDocument(input: DocumentInsert): Promise<DocumentRow> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.addDocument(input);
  }
  try {
    const { data, error } = await supabase
      .from("enterprise_documents")
      .insert(input)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as DocumentRow;
  } catch (err) {
    console.warn("[CRIM-SYS] createDocument falling back to mock:", err);
    return MockEnterpriseStore.addDocument(input);
  }
}

export async function updateDocument(
  id: string,
  input: Partial<DocumentInsert>,
): Promise<DocumentRow> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.updateDocument(id, input);
  }
  try {
    const { data, error } = await supabase
      .from("enterprise_documents")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as DocumentRow;
  } catch (err) {
    console.warn("[CRIM-SYS] updateDocument falling back to mock:", err);
    return MockEnterpriseStore.updateDocument(id, input);
  }
}

export async function deleteDocument(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    MockEnterpriseStore.deleteDocument(id);
    return;
  }
  try {
    const { error } = await supabase.from("enterprise_documents").delete().eq("id", id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn("[CRIM-SYS] deleteDocument falling back to mock:", err);
    MockEnterpriseStore.deleteDocument(id);
  }
}

export async function getDocumentDownloadUrl(
  storageKey: string,
): Promise<string> {
  if (!isSupabaseConfigured) {
    return `data:text/plain;charset=utf-8,${encodeURIComponent("مستند تجريبي — " + storageKey)}`;
  }
  try {
    const { data, error } = await supabase.storage
      .from("case-attachments")
      .createSignedUrl(storageKey, 3600);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  } catch {
    return `data:text/plain;charset=utf-8,${encodeURIComponent("مستند تجريبي — " + storageKey)}`;
  }
}

// ============================================================
// Actions Service
// ============================================================

export async function fetchActions(caseId?: string): Promise<ActionRow[]> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.getActions(caseId);
  }
  try {
    let query = supabase
      .from("enterprise_actions")
      .select("*")
      .order("created_at", { ascending: false });
    if (caseId) query = query.eq("case_id", caseId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as ActionRow[];
  } catch (err) {
    console.warn("[CRIM-SYS] fetchActions falling back to mock:", err);
    return MockEnterpriseStore.getActions(caseId);
  }
}

export async function fetchOverdueActions(): Promise<ActionRow[]> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.getOverdueActions() as unknown as ActionRow[];
  }
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("enterprise_actions")
      .select("*, case:enterprise_cases(case_code, case_number)")
      .lte("due_date", now)
      .eq("proposed_or_completed", "مقترح")
      .order("due_date", { ascending: true });
    if (error) throw new Error(error.message);
    return data as ActionRow[];
  } catch (err) {
    console.warn("[CRIM-SYS] fetchOverdueActions falling back to mock:", err);
    return MockEnterpriseStore.getOverdueActions() as unknown as ActionRow[];
  }
}

export async function createAction(input: ActionInsert): Promise<ActionRow> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.addAction(input);
  }
  try {
    const { data, error } = await supabase
      .from("enterprise_actions")
      .insert(input)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as ActionRow;
  } catch (err) {
    console.warn("[CRIM-SYS] createAction falling back to mock:", err);
    return MockEnterpriseStore.addAction(input);
  }
}

export async function updateAction(
  id: string,
  input: Partial<ActionInsert>,
): Promise<ActionRow> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.updateAction(id, input);
  }
  try {
    const { data, error } = await supabase
      .from("enterprise_actions")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as ActionRow;
  } catch (err) {
    console.warn("[CRIM-SYS] updateAction falling back to mock:", err);
    return MockEnterpriseStore.updateAction(id, input);
  }
}

export async function deleteAction(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    MockEnterpriseStore.deleteAction(id);
    return;
  }
  try {
    const { error } = await supabase.from("enterprise_actions").delete().eq("id", id);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.warn("[CRIM-SYS] deleteAction falling back to mock:", err);
    MockEnterpriseStore.deleteAction(id);
  }
}

// ============================================================
// Audit Log Service
// ============================================================

export async function fetchAuditLog(
  entityType?: string,
  entityId?: string,
): Promise<AuditLogRow[]> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.getAuditLog(entityType, entityId);
  }
  try {
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
  } catch (err) {
    console.warn("[CRIM-SYS] fetchAuditLog falling back to mock:", err);
    return MockEnterpriseStore.getAuditLog(entityType, entityId);
  }
}

// ============================================================
// Dashboard Stats
// ============================================================

export async function fetchDashboardStats(): Promise<DashboardStats> {
  if (!isSupabaseConfigured) {
    return MockEnterpriseStore.getDashboardStats();
  }
  try {
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
  } catch (err) {
    console.warn("[CRIM-SYS] fetchDashboardStats falling back to mock:", err);
    return MockEnterpriseStore.getDashboardStats();
  }
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
