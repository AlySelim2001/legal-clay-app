import {
  mockCases as rawMockCases,
  mockClients as rawMockClients,
  mockHearings as rawMockHearings,
  mockDeadlines as rawMockDeadlines,
  mockDocuments as rawMockDocuments,
} from "@/data/mock";
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
  ProceduralStatusType,
  CaseTypeValue,
} from "@/types/enterprise";

const STORAGE_KEY_PREFIX = "crimsys_enterprise_";

function loadFromStorage<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return defaultVal;
}

function saveToStorage<T>(key: string, val: T): void {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(val));
  } catch {
    // ignore
  }
}

// Generate valid UUIDs from string seed
function makeUuid(prefix: string, seed: string | number): string {
  const hexSeed = String(seed).padStart(12, "0").slice(-12);
  const p = prefix.padStart(8, "0").slice(-8);
  return `${p}-0000-4000-8000-${hexSeed}`;
}

// Initial seed data
const initialPersons: PersonRow[] = rawMockClients.map((c, i) => ({
  id: makeUuid("11111111", i + 1),
  person_code: c.clientCode,
  legal_full_name: c.name,
  name_as_recorded: c.name,
  national_id_encrypted: undefined,
  national_id_display: c.nationalId,
  phone_optional: c.phone,
  email: c.email,
  notes: `${c.occupation} — ${c.address}`,
  created_at: `${c.joinDate}T09:00:00.000Z`,
  updated_at: new Date().toISOString(),
}));

const initialCases: CaseRow[] = rawMockCases.map((c, i) => {
  const person = initialPersons.find((p) => p.person_code === c.clientCode) || initialPersons[0];
  const caseType: CaseTypeValue = c.caseCode.startsWith("ج") ? "جناية" : "جنح";
  const proceduralStatus: ProceduralStatusType =
    c.status === "منتهي"
      ? "انتهت"
      : c.status === "معلق"
        ? "تأجلت الجلسة"
        : c.status === "طعن"
          ? "جاري الاستئناف"
          : "قيد المحاكمة";

  return {
    id: makeUuid("22222222", i + 1),
    case_code: c.caseCode,
    case_number: c.caseCode.replace(/[^0-9]/g, "") || `${800 + i}`,
    case_year: 2026,
    case_type: caseType,
    court_name: c.court,
    police_station_or_prosecution: "نيابة أمن الدولة / قسم أول",
    jurisdiction: "القاهرة والجيزة",
    person_id: person.id,
    linked_case_group_id: null,
    procedural_status: proceduralStatus,
    source_document_id: null,
    confidence_status: "معتمد",
    legal_note_status: "معتمد",
    next_action: c.notes,
    next_action_due_at: c.deadline ? `${c.deadline}T10:00:00.000Z` : null,
    created_by: "المستشار القانوني",
    updated_by: "المستشار القانوني",
    created_at: `${c.filingDate}T08:00:00.000Z`,
    updated_at: new Date().toISOString(),
  };
});

const initialSessions: SessionRow[] = rawMockHearings.map((h, i) => {
  const foundCase = initialCases.find((cs) => cs.case_code === h.caseCode) || initialCases[0];
  return {
    id: makeUuid("33333333", i + 1),
    case_id: foundCase.id,
    session_date_time: `${h.date}T${h.time}:00.000Z`,
    session_type: "نظر القضية",
    courtroom_optional: `${h.court} — القاعة 4`,
    required_action: h.notes,
    reminder_enabled: true,
    attendance_status: "يحدد لاحقاً",
    outcome_note: h.type,
    source_document_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
});

const initialActions: ActionRow[] = rawMockDeadlines.map((d, i) => {
  const foundCase = initialCases.find((cs) => cs.case_code === d.caseCode) || initialCases[0];
  return {
    id: makeUuid("44444444", i + 1),
    case_id: foundCase.id,
    action_type: "تنقيح",
    description: `${d.description} (${d.type})`,
    proposed_or_completed: d.status === "مكتمل" ? "مكتمل" : "مقترح",
    legal_review_status: "معتمد",
    assigned_to: "أحمد سليم",
    due_date: `${d.dueDate}T12:00:00.000Z`,
    completed_at: d.status === "مكتمل" ? new Date().toISOString() : null,
    source_reference: d.caseTitle,
    created_by: "مدير النظام",
    created_at: new Date().toISOString(),
  };
});

const initialDocuments: DocumentRow[] = rawMockDocuments.map((doc, i) => {
  const foundCase = initialCases[i % initialCases.length];
  return {
    id: makeUuid("55555555", i + 1),
    case_id: foundCase.id,
    document_type: "مذكرة دفاع",
    original_file_name: doc.name,
    secure_storage_key: `mock_docs/${doc.id}.pdf`,
    mime_type: "application/pdf",
    file_size: 1024 * 450,
    checksum: "sha256_mock_valid",
    uploaded_by: doc.uploadedBy,
    uploaded_at: `${doc.uploadDate}T10:00:00.000Z`,
    review_status: "تمت المراجعة",
    document_date: doc.uploadDate,
    notes: `تم رفعه بواسطة ${doc.uploadedBy}`,
  };
});

const initialAuditLogs: AuditLogRow[] = [
  {
    id: makeUuid("66666666", 1),
    user_id: "demo-user-1",
    entity_type: "case",
    entity_id: initialCases[0]?.id || makeUuid("22222222", 1),
    action: "تحديث قرار الجلسة وحفظ المذكرة",
    previous_value_hash: null,
    new_value_hash: "hash_v2",
    timestamp: new Date().toISOString(),
    device_metadata_limited: "المتصفح — نظام المحاماة",
  },
  {
    id: makeUuid("66666666", 2),
    user_id: "demo-user-1",
    entity_type: "session",
    entity_id: initialSessions[0]?.id || makeUuid("33333333", 1),
    action: "تحديد موعد جلسة المحاكمة القادمة",
    previous_value_hash: null,
    new_value_hash: "hash_v1",
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    device_metadata_limited: "تطبيق الويب الجنائي",
  },
];

// Persistent reactive storage
let personsStore = loadFromStorage("persons", initialPersons);
let casesStore = loadFromStorage("cases", initialCases);
let sessionsStore = loadFromStorage("sessions", initialSessions);
let actionsStore = loadFromStorage("actions", initialActions);
let documentsStore = loadFromStorage("documents", initialDocuments);
const auditStore = loadFromStorage("audit", initialAuditLogs);

export const MockEnterpriseStore = {
  // Persons
  getPersons(): PersonRow[] {
    return [...personsStore];
  },
  getPerson(personCode: string): PersonWithCases {
    const person = personsStore.find((p) => p.person_code === personCode || p.id === personCode);
    if (!person) throw new Error("لم يتم العثور على الشخص المطلوب");
    const cases = casesStore.filter((c) => c.person_id === person.id);
    return { ...person, cases };
  },
  addPerson(input: PersonInsert): PersonRow {
    const newPerson: PersonRow = {
      ...input,
      id: makeUuid("11111111", Date.now()),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    personsStore = [newPerson, ...personsStore];
    saveToStorage("persons", personsStore);
    return newPerson;
  },
  updatePerson(id: string, input: Partial<PersonInsert>): PersonRow {
    const idx = personsStore.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("الشخص غير موجود");
    const updated = {
      ...personsStore[idx],
      ...input,
      updated_at: new Date().toISOString(),
    };
    personsStore[idx] = updated;
    saveToStorage("persons", personsStore);
    return updated;
  },
  deletePerson(id: string): void {
    personsStore = personsStore.filter((p) => p.id !== id);
    saveToStorage("persons", personsStore);
  },

  // Cases
  getCases(): CaseWithPerson[] {
    return casesStore.map((c) => {
      const person = personsStore.find((p) => p.id === c.person_id) || null;
      return { ...c, person };
    });
  },
  getCase(caseCode: string): CaseWithAll {
    const foundCase = casesStore.find((c) => c.case_code === caseCode || c.id === caseCode);
    if (!foundCase) throw new Error("لم يتم العثور على القضية المطلوبة");
    const person = personsStore.find((p) => p.id === foundCase.person_id) || null;
    const sessions = sessionsStore.filter((s) => s.case_id === foundCase.id);
    const documents = documentsStore.filter((d) => d.case_id === foundCase.id);
    const actions = actionsStore.filter((a) => a.case_id === foundCase.id);
    return {
      ...foundCase,
      person,
      sessions,
      documents,
      actions,
    };
  },
  addCase(input: CaseInsert): CaseRow {
    const newCase: CaseRow = {
      ...input,
      id: makeUuid("22222222", Date.now()),
      created_by: "مدير النظام",
      updated_by: "مدير النظام",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    casesStore = [newCase, ...casesStore];
    saveToStorage("cases", casesStore);
    return newCase;
  },
  updateCase(id: string, input: Partial<CaseInsert>): CaseRow {
    const idx = casesStore.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("القضية غير موجودة");
    const updated = {
      ...casesStore[idx],
      ...input,
      updated_at: new Date().toISOString(),
    };
    casesStore[idx] = updated;
    saveToStorage("cases", casesStore);
    return updated;
  },
  deleteCase(id: string): void {
    casesStore = casesStore.filter((c) => c.id !== id);
    saveToStorage("cases", casesStore);
  },

  // Sessions
  getSessions(caseId?: string): SessionRow[] {
    if (caseId) {
      return sessionsStore.filter((s) => s.case_id === caseId);
    }
    return [...sessionsStore];
  },
  getUpcomingSessions(): (SessionRow & { case?: { case_code: string; case_number: string; court_name: string } })[] {
    return sessionsStore.slice(0, 10).map((s) => {
      const foundCase = casesStore.find((c) => c.id === s.case_id);
      return {
        ...s,
        case: foundCase
          ? {
              case_code: foundCase.case_code,
              case_number: foundCase.case_number,
              court_name: foundCase.court_name,
            }
          : undefined,
      };
    });
  },
  addSession(input: SessionInsert): SessionRow {
    const newSession: SessionRow = {
      ...input,
      id: makeUuid("33333333", Date.now()),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    sessionsStore = [newSession, ...sessionsStore];
    saveToStorage("sessions", sessionsStore);
    return newSession;
  },
  updateSession(id: string, input: Partial<SessionInsert>): SessionRow {
    const idx = sessionsStore.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("الجلسة غير موجودة");
    const updated = {
      ...sessionsStore[idx],
      ...input,
      updated_at: new Date().toISOString(),
    };
    sessionsStore[idx] = updated;
    saveToStorage("sessions", sessionsStore);
    return updated;
  },
  deleteSession(id: string): void {
    sessionsStore = sessionsStore.filter((s) => s.id !== id);
    saveToStorage("sessions", sessionsStore);
  },

  // Documents
  getDocuments(caseId?: string): DocumentRow[] {
    if (caseId) return documentsStore.filter((d) => d.case_id === caseId);
    return [...documentsStore];
  },
  addDocument(input: DocumentInsert): DocumentRow {
    const newDoc: DocumentRow = {
      ...input,
      id: makeUuid("55555555", Date.now()),
      uploaded_at: new Date().toISOString(),
    };
    documentsStore = [newDoc, ...documentsStore];
    saveToStorage("documents", documentsStore);
    return newDoc;
  },
  updateDocument(id: string, input: Partial<DocumentInsert>): DocumentRow {
    const idx = documentsStore.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error("المستند غير موجود");
    const updated = { ...documentsStore[idx], ...input };
    documentsStore[idx] = updated;
    saveToStorage("documents", documentsStore);
    return updated;
  },
  deleteDocument(id: string): void {
    documentsStore = documentsStore.filter((d) => d.id !== id);
    saveToStorage("documents", documentsStore);
  },

  // Actions
  getActions(caseId?: string): ActionRow[] {
    if (caseId) return actionsStore.filter((a) => a.case_id === caseId);
    return [...actionsStore];
  },
  getOverdueActions(): (ActionRow & { case?: { case_code: string; case_number: string } })[] {
    return actionsStore.slice(0, 5).map((a) => {
      const foundCase = casesStore.find((c) => c.id === a.case_id);
      return {
        ...a,
        case: foundCase
          ? { case_code: foundCase.case_code, case_number: foundCase.case_number }
          : undefined,
      };
    });
  },
  addAction(input: ActionInsert): ActionRow {
    const newAction: ActionRow = {
      ...input,
      id: makeUuid("44444444", Date.now()),
      created_by: "مدير النظام",
      created_at: new Date().toISOString(),
    };
    actionsStore = [newAction, ...actionsStore];
    saveToStorage("actions", actionsStore);
    return newAction;
  },
  updateAction(id: string, input: Partial<ActionInsert>): ActionRow {
    const idx = actionsStore.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("الإجراء غير موجود");
    const updated = { ...actionsStore[idx], ...input };
    actionsStore[idx] = updated;
    saveToStorage("actions", actionsStore);
    return updated;
  },
  deleteAction(id: string): void {
    actionsStore = actionsStore.filter((a) => a.id !== id);
    saveToStorage("actions", actionsStore);
  },

  // Audit Logs
  getAuditLog(entityType?: string, entityId?: string): AuditLogRow[] {
    let result = [...auditStore];
    if (entityType) result = result.filter((l) => l.entity_type === entityType);
    if (entityId) result = result.filter((l) => l.entity_id === entityId);
    return result;
  },

  // Dashboard Stats
  getDashboardStats(): DashboardStats {
    return {
      totalCases: casesStore.length,
      totalPersons: personsStore.length,
      upcomingSessions: sessionsStore.length,
      overdueActions: actionsStore.filter((a) => a.proposed_or_completed === "مقترح").length,
      unreviewedDocuments: documentsStore.filter((d) => d.review_status === "بانتظار المراجعة").length,
      lastUpdated: new Date().toISOString(),
    };
  },
};
