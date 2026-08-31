// ============================================================
// CRIM-SYS 2026 — Backup & Restore Engine
// Automated local-first data backup, restore, and storage sanitization
// Supports both browser (IndexedDB) and Capacitor native (Filesystem)
// ============================================================

import { supabase } from "@/lib/supabase";
import {
  getDB,
  getAllSyncMeta,
  clearStore,
} from "@/lib/open-source/offline-sync";

type OfflineStoreName =
  | "cases"
  | "clients"
  | "schedules"
  | "attachments"
  | "defenses_catalog"
  | "legal_deadlines_reference"
  | "procedural_stages"
  | "external_records"
  | "audit_log";

// ---- Types ----

export interface BackupMetadata {
  version: string;
  createdAt: string;
  deviceInfo: string;
  tables: string[];
  recordCounts: Record<string, number>;
}

export interface BackupPayload {
  metadata: BackupMetadata;
  data: Record<string, unknown[]>;
}

export interface RestoreResult {
  success: boolean;
  tablesRestored: number;
  recordsRestored: number;
  errors: string[];
}

export interface SanitizeResult {
  cleared: string[];
  preserved: string[];
  bytesFreed: number;
}

// ---- Constants ----

const BACKUP_VERSION = "1.0.0";
const BACKUP_PREFIX = "CRIM-SYS_Backup";
const STORES_TO_BACKUP: OfflineStoreName[] = [
  "cases",
  "clients",
  "schedules",
  "attachments",
  "defenses_catalog",
  "legal_deadlines_reference",
  "procedural_stages",
  "external_records",
  "audit_log",
];

const STORES_TO_PRESERVE: OfflineStoreName[] = [
  "defenses_catalog",
  "legal_deadlines_reference",
];

// ============================================================
// FULL SYSTEM EXPORT
// ============================================================

/**
 * Export all local IndexedDB data into a timestamped JSON backup file.
 * Works in both browser and Capacitor environments.
 */
export async function createFullBackup(): Promise<Blob> {
  const db = await getDB();
  const recordCounts: Record<string, number> = {};
  const data: Record<string, unknown[]> = {};

  for (const storeName of STORES_TO_BACKUP) {
    try {
      const allRecords = await db.getAll(storeName);
      data[storeName] = allRecords;
      recordCounts[storeName] = allRecords.length;
    } catch {
      data[storeName] = [];
      recordCounts[storeName] = 0;
    }
  }

  // Also capture sync metadata
  const syncMeta = await getAllSyncMeta();

  const metadata: BackupMetadata = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    deviceInfo: `${navigator.userAgent}`,
    tables: STORES_TO_BACKUP,
    recordCounts,
  };

  const payload: BackupPayload & { syncMeta: unknown[] } = {
    metadata,
    data,
    syncMeta,
  };

  const json = JSON.stringify(payload, null, 2);
  return new Blob([json], { type: "application/json" });
}

/**
 * Download the backup file to the user's device.
 * Uses Capacitor Filesystem on native, browser download on web.
 */
export async function downloadBackup(): Promise<string> {
  const blob = await createFullBackup();
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  const filename = `${BACKUP_PREFIX}_${timestamp}.json`;

  // Try Capacitor first (native Android)
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const text = await blob.text();
    await Filesystem.writeFile({
      path: `CRIM-SYS/${filename}`,
      data: text,
      directory: Directory.Documents,
      encoding: "utf-8" as unknown as import("@capacitor/filesystem").Encoding,
    });
    return `تم الحفظ في: Documents/CRIM-SYS/${filename}`;
  } catch {
    // Fallback to browser download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return `تم تحميل: ${filename}`;
  }
}

// ============================================================
// ONE-CLICK RESTORE
// ============================================================

/**
 * Validate the structure of a backup file before restoring.
 */
export function validateBackupStructure(
  raw: string
): { valid: boolean; error?: string; metadata?: BackupMetadata } {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    if (!parsed.metadata || typeof parsed.metadata !== "object") {
      return { valid: false, error: "ملف النسخة الاحتياطية غير صالح: البيانات الوصفية مفقودة" };
    }

    const meta = parsed.metadata as Record<string, unknown>;
    if (!meta.version || !meta.createdAt || !meta.tables) {
      return { valid: false, error: "ملف النسخة الاحتياطية غير صالح: حقول مفقودة" };
    }

    if (!parsed.data || typeof parsed.data !== "object") {
      return { valid: false, error: "ملف النسخة الاحتياطية غير صالح: بيانات مفقودة" };
    }

    // Version compatibility check
    const majorVersion = String(meta.version).split(".")[0];
    const currentMajor = BACKUP_VERSION.split(".")[0];
    if (majorVersion !== currentMajor) {
      return {
        valid: false,
        error: `إصدار غير متوافق: النسخة ${meta.version}، النظام الحالي ${BACKUP_VERSION}`,
      };
    }

    return {
      valid: true,
      metadata: meta as unknown as BackupMetadata,
    };
  } catch {
    return { valid: false, error: "ملف غير صالح: لا يمكن تحليل JSON" };
  }
}

/**
 * Restore data from a validated backup file into IndexedDB.
 * Then attempts background resync with Supabase.
 */
export async function restoreFromBackup(
  raw: string,
  onProgress?: (stage: string, progress: number) => void
): Promise<RestoreResult> {
  const validation = validateBackupStructure(raw);
  if (!validation.valid) {
    return {
      success: false,
      tablesRestored: 0,
      recordsRestored: 0,
      errors: [validation.error ?? "خطأ غير معروف"],
    };
  }

  const parsed = JSON.parse(raw) as BackupPayload & { syncMeta?: unknown[] };
  const db = await getDB();
  const errors: string[] = [];
  let tablesRestored = 0;
  let recordsRestored = 0;

  const stores = Object.keys(parsed.data) as OfflineStoreName[];

  for (let i = 0; i < stores.length; i++) {
    const storeName = stores[i];
    const records = parsed.data[storeName];

    onProgress?.(
      `جاري استعادة ${storeName}...`,
      Math.round(((i + 1) / stores.length) * 80)
    );

    try {
      if (!Array.isArray(records)) continue;

      // Clear existing data for this store
      await clearStore(storeName);

      // Insert records in batches
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      for (const record of records) {
        try {
          await store.put(record);
        } catch {
          // Skip individual record errors
        }
      }
      await tx.done;

      tablesRestored++;
      recordsRestored += records.length;
    } catch (err) {
      errors.push(`خطأ في استعادة ${storeName}: ${err instanceof Error ? err.message : "خطأ"}`);
    }
  }

  // Background resync with Supabase
  onProgress?.("جاري المزامنة مع الخادم...", 90);
  try {
    await resyncWithSupabase();
  } catch {
    errors.push("فشلت المزامنة مع الخادم — سيتم المحاولة لاحقاً");
  }

  onProgress?.("اكتملت الاستعادة", 100);

  return {
    success: errors.length === 0,
    tablesRestored,
    recordsRestored,
    errors,
  };
}

// ============================================================
// BACKGROUND RESYNC
// ============================================================

/**
 * Resync local IndexedDB data with Supabase primary node.
 * Pulls latest data for reference tables (defenses, deadlines).
 */
async function resyncWithSupabase(): Promise<void> {
  const db = await getDB();

  // Resync reference data that should stay current
  const refetchMap: Array<{
    store: OfflineStoreName;
    table: string;
    select: string;
  }> = [
    {
      store: "defenses_catalog",
      table: "defenses_catalog",
      select: "*",
    },
    {
      store: "legal_deadlines_reference",
      table: "legal_deadlines_reference",
      select: "*",
    },
  ];

  for (const { store, table, select } of refetchMap) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .order("code");

      if (!error && data && data.length > 0) {
        await clearStore(store);
        const tx = db.transaction(store, "readwrite");
        const objStore = tx.objectStore(store);
        for (const record of data) {
          await objStore.put(record);
        }
        await tx.done;
      }
    } catch {
      // Non-critical: reference data sync failure
    }
  }
}

// ============================================================
// STORAGE SANITIZATION
// ============================================================

/**
 * Purge expired cached PDFs, temporary signed URLs, and stale data
 * while preserving core relational reference data.
 */
export async function sanitizeStorage(): Promise<SanitizeResult> {
  const db = await getDB();
  const cleared: string[] = [];
  const preserved: string[] = [];
  let bytesFreed = 0;

  // Calculate initial storage estimate
  const initialEstimate = await getStorageEstimate();

  // Clear non-essential stores
  const clearableStores: OfflineStoreName[] = [
    "audit_log", // Can be re-fetched from Supabase
    "external_records", // Can be re-fetched
  ];

  for (const storeName of clearableStores) {
    try {
      const count = await db.count(storeName);
      if (count > 0) {
        await clearStore(storeName);
        cleared.push(`${storeName} (${count} سجل)`);
      } else {
        cleared.push(`${storeName} (فارغ)`);
      }
    } catch {
      // Store might not exist
    }
  }

  // Preserve reference stores
  for (const storeName of STORES_TO_PRESERVE) {
    try {
      const count = await db.count(storeName);
      preserved.push(`${storeName} (${count} سجل)`);
    } catch {
      preserved.push(`${storeName} (غير متاح)`);
    }
  }

  // Clear old sync metadata
  try {
    const tx = db.transaction("_sync_meta", "readwrite");
    await tx.objectStore("_sync_meta").clear();
    await tx.done;
  } catch {
    // Non-critical
  }

  // Calculate freed space
  const finalEstimate = await getStorageEstimate();
  bytesFreed = Math.max(0, initialEstimate.usage - finalEstimate.usage);

  // Clear any Capacitor filesystem cache
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const result = await Filesystem.readdir({
      path: "CRIM-SYS",
      directory: Directory.Cache,
    });
    for (const file of result.files) {
      if (file.name.endsWith(".pdf") || file.name.startsWith("tmp_")) {
        await Filesystem.deleteFile({
          path: `CRIM-SYS/${file.name}`,
          directory: Directory.Cache,
        });
        bytesFreed += 1024 * 1024; // Estimate 1MB per file
      }
    }
  } catch {
    // Non-Capacitor environment or no cache files
  }

  return { cleared, preserved, bytesFreed };
}

// ============================================================
// HELPERS
// ============================================================

async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
}> {
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usage: estimate.usage ?? 0,
      quota: estimate.quota ?? 0,
    };
  }
  return { usage: 0, quota: 0 };
}

/**
 * Get backup file list from Capacitor filesystem
 */
export async function listLocalBackups(): Promise<
  Array<{ name: string; size: number; date: string }>
> {
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const result = await Filesystem.readdir({
      path: "CRIM-SYS",
      directory: Directory.Documents,
    });

    return result.files
      .filter((f) => f.name.startsWith(BACKUP_PREFIX) && f.name.endsWith(".json"))
      .map((f) => ({
        name: f.name,
        size: f.size ?? 0,
        date: String(f.mtime ?? ""),
      }))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  } catch {
    return [];
  }
}

/**
 * Read a backup file from Capacitor filesystem
 */
export async function readBackupFile(filename: string): Promise<string | null> {
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const result = await Filesystem.readFile({
      path: `CRIM-SYS/${filename}`,
      directory: Directory.Documents,
      encoding: "utf-8" as unknown as import("@capacitor/filesystem").Encoding,
    });
    return typeof result.data === "string" ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Delete a backup file from Capacitor filesystem
 */
export async function deleteBackupFile(filename: string): Promise<boolean> {
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    await Filesystem.deleteFile({
      path: `CRIM-SYS/${filename}`,
      directory: Directory.Documents,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Format bytes to human readable Arabic
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 بايت";
  const units = ["بايت", "كيلوبايت", "ميجابايت", "جيجابايت"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
