/**
 * Open-Source Ecosystem Integrations — CRIM-SYS 2026
 *
 * Browser-safe adaptations of the pasted sketch
 * (`src/integrations/github-open-source.ts`): ArkCase case exchange,
 * OpenLawOffice billing/task sync, and Free Law Project (CourtListener)
 * research. The sketch assumed Node `process.env` and servers that are
 * unreachable from a browser SPA — every class below keeps the sketch's
 * contract but does something genuine inside a Vite + React 19 client:
 *
 *   • ArkCase CE is a self-hosted Java server, so instead of faking a
 *     `fetch('https://arkcase.example.com/...')` we implement portable
 *     **case-exchange payloads** (import → offline store, export → file)
 *     that round-trip with a real instance via its migration files.
 *   • OpenLawOffice billing/time + task records live in the app's
 *     offline-first IndexedDB layer and export to CSV for the office
 *     side.
 *   • CourtListener (Free Law Project) is a *real* public REST API
 *     (v4). It is US case law — genuinely useful for comparative /
 *     international research but NOT Egyptian authority — and its
 *     rate limits (free token: 5/min, 50/hr, 125/day) plus browser
 *     CORS mean the call can fail. When it fails, results degrade to
 *     the built-in Egyptian corpus with the source clearly labeled.
 *
 * Zero new dependencies; persistence reuses the app's offline layer.
 */

import type { Case } from "@/data/mock";
import { mockCases } from "@/data/mock";
import { RAGRetriever } from "@/rag/retriever";
import {
  cacheData,
  getCachedData,
  deleteCachedData,
} from "@/lib/open-source/offline-sync";

// ============================================================
// Shared record types (offline `attachments` store)
// ============================================================

type OSSyncRecord =
  | ArkCaseSyncedCaseRecord
  | OloTimeEntryRecord
  | OloTaskRecord;

export interface ArkCaseSyncedCaseRecord {
  id: string;
  type: "arkcase_synced_case";
  caseCode: string;
  title: string;
  clientName: string | null;
  clientCode: string | null;
  court: string | null;
  judge: string | null;
  status: string | null;
  priority: string | null;
  lawyer: string | null;
  crimeType: string | null;
  filingDate: string | null;
  nextHearing: string | null;
  deadline: string | null;
  notes: string | null;
  createdAt: string;
}

export interface OloTimeEntryRecord {
  id: string;
  type: "olo_time_entry";
  caseCode: string;
  description: string;
  date: string; // YYYY-MM-DD
  hours: number;
  rate: number; // EGP per hour
  lawyer: string;
  createdAt: string;
}

export interface OloTaskRecord {
  id: string;
  type: "olo_task";
  caseCode: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  assignee: string | null;
  status: "معلق" | "مكتمل";
  createdAt: string;
}

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// ============================================================
// CSV helpers (UTF-8 BOM so Excel opens Arabic correctly)
// ============================================================

const csvCell = (value: string | number | null | undefined): string => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCsv(rows: Array<Array<string | number | null>>): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

export function downloadTextFile(
  content: string,
  filename: string,
  mime = "text/csv;charset=utf-8",
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ============================================================
// ArkCase CE — portable case exchange
// ============================================================

export interface ArkCaseExchangeCase {
  caseCode: string;
  title: string;
  clientName?: string | null;
  clientCode?: string | null;
  court?: string | null;
  judge?: string | null;
  status?: string | null;
  priority?: string | null;
  lawyer?: string | null;
  crimeType?: string | null;
  filingDate?: string | null;
  nextHearing?: string | null;
  deadline?: string | null;
  notes?: string | null;
}

export interface SyncReport {
  source: "arkcase";
  imported: number;
  skipped: number;
  totalIncoming: number;
  skippedReasons: string[];
}

/**
 * Tolerant field resolver: ArkCase exports use varying key spellings
 * (case_number / caseNumber / number, subject / title, assignedTo /
 * lawyer …). Picks the first alias that exists on the row.
 */
function pick(row: Record<string, unknown>, ...aliases: string[]): string | null {
  for (const alias of aliases) {
    const value = row[alias];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function normalizeArkCaseRow(
  row: Record<string, unknown>,
): ArkCaseExchangeCase | null {
  const caseCode = pick(row, "caseCode", "case_code", "caseNumber", "case_number", "number");
  const title = pick(row, "title", "subject", "caseTitle", "case_title", "name");
  if (!caseCode || !title) return null;
  return {
    caseCode,
    title,
    clientName: pick(row, "clientName", "client_name", "client"),
    clientCode: pick(row, "clientCode", "client_code"),
    court: pick(row, "court", "courtName", "court_name"),
    judge: pick(row, "judge", "judgeName"),
    status: pick(row, "status", "caseStatus", "state"),
    priority: pick(row, "priority", "severity"),
    lawyer: pick(row, "lawyer", "assignedTo", "assigned_to", "attorney"),
    crimeType: pick(row, "crimeType", "crime_type", "type", "category"),
    filingDate: pick(row, "filingDate", "filing_date", "createdDate"),
    nextHearing: pick(row, "nextHearing", "next_hearing", "hearingDate"),
    deadline: pick(row, "deadline", "dueDate", "due_date"),
    notes: pick(row, "notes", "description", "summary"),
  };
}

export class ArkCaseIntegration {
  /** The sketch's `syncCases()`: consume an ArkCase export payload. */
  async syncCases(payload: unknown): Promise<SyncReport> {
    const rows: unknown[] = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { cases?: unknown[] })?.cases)
        ? (payload as { cases: unknown[] }).cases
        : Array.isArray((payload as { data?: unknown[] })?.data)
          ? (payload as { data: unknown[] }).data
          : [];

    const skippedReasons: string[] = [];
    const incoming: ArkCaseExchangeCase[] = [];

    for (const raw of rows) {
      if (!raw || typeof raw !== "object") {
        skippedReasons.push("صف غير صالح");
        continue;
      }
      const mapped = normalizeArkCaseRow(raw as Record<string, unknown>);
      if (!mapped) {
        skippedReasons.push("يفتقر إلى رقم القضية والعنوان");
        continue;
      }
      incoming.push(mapped);
    }

    let imported = 0;
    for (const c of incoming) {
      const record: ArkCaseSyncedCaseRecord = {
        id: `arkcase-${c.caseCode.replace(/[^a-zA-Z0-9\u0600-\u06FF-]/g, "_")}`,
        type: "arkcase_synced_case",
        caseCode: c.caseCode,
        title: c.title,
        clientName: c.clientName ?? null,
        clientCode: c.clientCode ?? null,
        court: c.court ?? null,
        judge: c.judge ?? null,
        status: c.status ?? null,
        priority: c.priority ?? null,
        lawyer: c.lawyer ?? null,
        crimeType: c.crimeType ?? null,
        filingDate: c.filingDate ?? null,
        nextHearing: c.nextHearing ?? null,
        deadline: c.deadline ?? null,
        notes: c.notes ?? null,
        createdAt: new Date().toISOString(),
      };
      try {
        await cacheData("attachments", record);
        imported++;
      } catch {
        skippedReasons.push(`${c.caseCode}: تعذر الحفظ محلياً`);
      }
    }

    return {
      source: "arkcase",
      imported,
      skipped: rows.length - incoming.length + (incoming.length - imported),
      totalIncoming: rows.length,
      skippedReasons: skippedReasons.slice(0, 5),
    };
  }

  /** Synced cases stored locally, newest first. */
  async getSyncedCases(): Promise<ArkCaseSyncedCaseRecord[]> {
    const all = (await getCachedData("attachments")) as OSSyncRecord[];
    return all
      .filter((r) => r.type === "arkcase_synced_case")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) as ArkCaseSyncedCaseRecord[];
  }

  async deleteSyncedCase(id: string): Promise<void> {
    await deleteCachedData("attachments", id);
  }

  /**
   * Build a portable ArkCase-style JSON payload from the app's current
   * case directory (demo corpus) — the file users upload into a
   * self-hosted ArkCase CE instance or keep as an offline backup.
   */
  buildExchangePayload(): { exportedAt: string; count: number; cases: ArkCaseExchangeCase[] } {
    const toExchange = (c: Case): ArkCaseExchangeCase => ({
      caseCode: c.caseCode,
      title: c.title,
      clientName: c.clientName,
      clientCode: c.clientCode,
      court: c.court,
      judge: c.judge,
      status: c.status,
      priority: c.priority,
      lawyer: c.lawyer,
      crimeType: c.crimeType,
      filingDate: c.filingDate,
      nextHearing: c.nextHearing,
      deadline: c.deadline,
      notes: c.notes,
    });
    return {
      exportedAt: new Date().toISOString(),
      count: mockCases.length,
      cases: mockCases.map(toExchange),
    };
  }
}

export function getArkCaseIntegration(): ArkCaseIntegration {
  return new ArkCaseIntegration();
}

// ============================================================
// OpenLawOffice — billing/time & task ledger sync
// ============================================================

export interface TimeEntryInput {
  caseCode: string;
  description: string;
  date: string; // YYYY-MM-DD
  hours: number;
  rate: number; // EGP/hour
  lawyer: string;
}

export interface TaskInput {
  caseCode: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  assignee?: string;
}

export class OpenLawOfficeIntegration {
  // ---- Billing / time tracking ----------------------------------

  /** The sketch's `syncBilling()`: bulk-import time entries. */
  async syncBilling(entries: TimeEntryInput[]): Promise<{ imported: number }> {
    for (const e of entries) {
      await this.addTimeEntry(e);
    }
    return { imported: entries.length };
  }

  async addTimeEntry(entry: TimeEntryInput): Promise<OloTimeEntryRecord> {
    const record: OloTimeEntryRecord = {
      id: newId("olo-time"),
      type: "olo_time_entry",
      caseCode: entry.caseCode,
      description: entry.description,
      date: entry.date,
      hours: entry.hours,
      rate: entry.rate,
      lawyer: entry.lawyer,
      createdAt: new Date().toISOString(),
    };
    await cacheData("attachments", record);
    return record;
  }

  async listTimeEntries(): Promise<OloTimeEntryRecord[]> {
    const all = (await getCachedData("attachments")) as OSSyncRecord[];
    return all
      .filter((r) => r.type === "olo_time_entry")
      .sort((a, b) => b.date.localeCompare(a.date)) as OloTimeEntryRecord[];
  }

  async deleteTimeEntry(id: string): Promise<void> {
    await deleteCachedData("attachments", id);
  }

  /** CSV for the office package (time sheet). */
  exportBillingCsv(entries: OloTimeEntryRecord[]): string {
    const rows: Array<Array<string | number | null>> = [
      ["رقم القضية", "الوصف", "التاريخ", "الساعات", "السعر/ساعة", "القيمة (ج.م)", "المحامي"],
      ...entries.map((e) => [
        e.caseCode,
        e.description,
        e.date,
        e.hours,
        e.rate,
        Math.round(e.hours * e.rate * 100) / 100,
        e.lawyer,
      ]),
    ];
    return toCsv(rows);
  }

  // ---- Tasks -----------------------------------------------------

  /** The sketch's `syncTasks()`: bulk-import task/deadline items. */
  async syncTasks(tasks: TaskInput[]): Promise<{ imported: number }> {
    for (const t of tasks) {
      await this.addTask(t);
    }
    return { imported: tasks.length };
  }

  async addTask(task: TaskInput): Promise<OloTaskRecord> {
    const record: OloTaskRecord = {
      id: newId("olo-task"),
      type: "olo_task",
      caseCode: task.caseCode,
      title: task.title,
      dueDate: task.dueDate,
      assignee: task.assignee ?? null,
      status: "معلق",
      createdAt: new Date().toISOString(),
    };
    await cacheData("attachments", record);
    return record;
  }

  async listTasks(): Promise<OloTaskRecord[]> {
    const all = (await getCachedData("attachments")) as OSSyncRecord[];
    return all
      .filter((r) => r.type === "olo_task")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)) as OloTaskRecord[];
  }

  async toggleTask(id: string, done: boolean): Promise<void> {
    const all = (await getCachedData("attachments")) as OSSyncRecord[];
    const task = all.find((r) => r.id === id && r.type === "olo_task") as
      | OloTaskRecord
      | undefined;
    if (task) {
      await cacheData("attachments", {
        ...task,
        status: done ? "مكتمل" : "معلق",
      });
    }
  }

  async deleteTask(id: string): Promise<void> {
    await deleteCachedData("attachments", id);
  }

  /** CSV for the office package (task/deadline sheet). */
  exportTasksCsv(tasks: OloTaskRecord[]): string {
    const rows: Array<Array<string | number | null>> = [
      ["رقم القضية", "المهمة", "الاستحقاق", "المسؤول", "الحالة"],
      ...tasks.map((t) => [t.caseCode, t.title, t.dueDate, t.assignee, t.status]),
    ];
    return toCsv(rows);
  }
}

export function getOpenLawOfficeIntegration(): OpenLawOfficeIntegration {
  return new OpenLawOfficeIntegration();
}

// ============================================================
// Free Law Project — CourtListener (real public REST API, v4)
// ============================================================

export const COURTLISTENER_ENV = {
  token: "VITE_COURTLISTENER_TOKEN",
} as const;

const COURTLISTENER_BASE = "https://www.courtlistener.com/api/rest/v4";

export interface CourtListenerHit {
  clusterId: string;
  caseName: string;
  court: string;
  courtId: string | null;
  dateFiled: string | null;
  citation: string[];
  caseNumber: string | null;
  status: string | null;
  absoluteUrl: string;
  snippet: string | null;
}

export interface CourtListenerSearchOutcome {
  ok: boolean;
  live: boolean; // true = real CourtListener response
  hits: CourtListenerHit[];
  error: string | null;
  note: string | null;
}

export interface RecapDocument {
  id: string;
  clusterId: string;
  downloadUrl: string | null;
  plainTextAvailable: boolean;
}

function readToken(): string {
  if (typeof import.meta === "undefined") return "";
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const token = env[COURTLISTENER_ENV.token];
  return token && token !== "your_token_here" ? token : "";
}

/** True when a token is configured (raises CourtListener's rate limits). */
export function isCourtListenerConfigured(): boolean {
  return Boolean(readToken());
}

export class FreeLawProjectIntegration {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly localRetriever: RAGRetriever;

  constructor(options: { token?: string; baseUrl?: string } = {}) {
    this.token = options.token ?? readToken();
    this.baseUrl = options.baseUrl ?? COURTLISTENER_BASE;
    this.localRetriever = new RAGRetriever({ topK: 5 });
  }

  /**
   * The sketch's `searchCourtListener(query)`. Live call when the
   * browser can reach the API (token raises the throttles; CORS may
   * still block direct calls — see docs/). Any failure degrades to the
   * built-in Egyptian corpus with a clearly labeled fallback, because
   * CourtListener is US authority and must never be presented as an
   * Egyptian source.
   */
  async searchCourtListener(
    query: string,
    options: { topK?: number } = {},
  ): Promise<CourtListenerSearchOutcome> {
    const topK = options.topK ?? 5;
    const q = query.trim();
    if (!q) {
      return { ok: false, live: false, hits: [], error: "استعلام فارغ", note: null };
    }

    try {
      const url = `${this.baseUrl}/search/?q=${encodeURIComponent(q)}&type=o&page_size=${Math.min(topK, 20)}`;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (this.token) headers.Authorization = `Token ${this.token}`;
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`CourtListener HTTP ${response.status}`);
      }
      const payload = (await response.json()) as {
        results?: Array<Record<string, unknown>>;
      };
      const hits: CourtListenerHit[] = (payload.results ?? [])
        .slice(0, topK)
        .map((r) => {
          const citation = Array.isArray(r.citation)
            ? (r.citation as unknown[]).map(String)
            : r.citation
              ? [String(r.citation)]
              : [];
          const snippet =
            typeof r.snippet === "string"
              ? r.snippet
              : typeof r.description === "string"
                ? (r.description as string)
                : null;
          return {
            clusterId: String(r.cluster_id ?? r.id ?? ""),
            caseName: String(r.caseName ?? r.case_name ?? "قضية بدون عنوان"),
            court: String(r.court ?? ""),
            courtId: r.court_id ? String(r.court_id) : null,
            dateFiled: r.dateFiled ? String(r.dateFiled).slice(0, 10) : null,
            citation,
            caseNumber: r.docketNumber ? String(r.docketNumber) : null,
            status: r.status ? String(r.status) : null,
            absoluteUrl: String(r.absolute_url ?? ""),
            snippet,
          };
        });
      return {
        ok: true,
        live: true,
        hits,
        error: null,
        note: this.token
          ? "مكتبة المحاكم الأمريكية (CourtListener) — للمقارنة والبحث الدولي فقط، وليست سلطة مصرية."
          : "نتائج حية من CourtListener بدون رمز — المعدل محدود (٥/دقيقة). أضف VITE_COURTLISTENER_TOKEN لرفع الحد.",
      };
    } catch (error) {
      // Network / CORS / rate-limit failure → local Egyptian fallback.
      const fallback = await this.localRetriever.retrieve(q);
      const hits: CourtListenerHit[] = fallback.map((d) => ({
        clusterId: d.id,
        caseName: d.content.slice(0, 160),
        court: d.metadata.source,
        courtId: null,
        dateFiled: d.metadata.date ?? null,
        citation: d.metadata.articleRef ? [d.metadata.articleRef] : [],
        caseNumber: d.metadata.court ?? null,
        status: null,
        absoluteUrl: "",
        snippet: d.metadata.articleRef ? `المادة المرجعية: ${d.metadata.articleRef}` : null,
      }));
      const reason =
        error instanceof Error ? error.message : "خطأ غير معروف";
      return {
        ok: hits.length > 0,
        live: false,
        hits,
        error: hits.length === 0 ? reason : null,
        note: hits.length > 0
          ? `تعذر الوصول إلى CourtListener من المتصفح (${reason}) — عُرضت النتائج من قاعدة القانون المصري المحلية.`
          : `تعذر الوصول إلى CourtListener (${reason}) ولا توجد نتائج مصرية مطابقة.`,
      };
    }
  }

  /**
   * The sketch's `getRecapDocuments(caseId)`: resolve the opinion
   * documents behind a cluster (RECAP archive links). Returns an empty
   * list on any failure — RECAP PDFs need authenticated/CORS-enabled
   * access, so the method is honest about what it could not fetch.
   */
  async getRecapDocuments(clusterId: string): Promise<RecapDocument[]> {
    if (!clusterId) return [];
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (this.token) headers.Authorization = `Token ${this.token}`;
      const response = await fetch(
        `${this.baseUrl}/opinions/?cluster=${encodeURIComponent(clusterId)}&page_size=5`,
        { headers },
      );
      if (!response.ok) return [];
      const payload = (await response.json()) as {
        results?: Array<Record<string, unknown>>;
      };
      return (payload.results ?? []).map((r) => ({
        id: String(r.id ?? ""),
        clusterId,
        downloadUrl:
          typeof r.download_url === "string" ? (r.download_url as string) : null,
        plainTextAvailable:
          typeof r.plain_text === "string" && (r.plain_text as string).length > 0,
      }));
    } catch {
      return [];
    }
  }
}

export function getFreeLawProjectIntegration(): FreeLawProjectIntegration {
  return new FreeLawProjectIntegration();
}
