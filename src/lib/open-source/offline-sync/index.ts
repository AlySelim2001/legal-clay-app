// ============================================================
// CRIM-SYS 2026 — Offline Sync Module
// IndexedDB persistence using idb + tanstack/react-query
// Enables full offline-first functionality for courtroom use
// ============================================================

import { openDB, type IDBPDatabase } from "idb";
import type { OfflineStoreName, OfflineSyncConfig, CachedQuery } from "@/lib/open-source";

// ---- Database Constants ----

const DB_NAME = "crim-sys-2026";
const DB_VERSION = 1;

const ALL_STORES: OfflineStoreName[] = [
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

// ---- IndexedDB Initialization ----

let dbInstance: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create all object stores
      ALL_STORES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: "id" });
          // Create indexes for common query patterns
          if (storeName === "cases") {
            store.createIndex("case_code", "case_code", { unique: true });
            store.createIndex("client_id", "client_id");
            store.createIndex("filing_date", "filing_date");
            store.createIndex("procedural_status", "procedural_status");
          }
          if (storeName === "clients") {
            store.createIndex("client_code", "client_code", { unique: true });
            store.createIndex("national_id", "national_id", { unique: true });
          }
          if (storeName === "schedules") {
            store.createIndex("session_date", "session_date");
            store.createIndex("case_id", "case_id");
          }
          if (storeName === "attachments") {
            store.createIndex("case_id", "case_id");
          }
          if (storeName === "audit_log") {
            store.createIndex("record_id", "record_id");
            store.createIndex("table_name", "table_name");
            store.createIndex("changed_at", "changed_at");
          }
        }
      });

      // Create metadata store for sync tracking
      if (!db.objectStoreNames.contains("_sync_meta")) {
        db.createObjectStore("_sync_meta", { keyPath: "storeName" });
      }
    },
  });

  return dbInstance;
}

// ---- Generic CRUD Operations ----

export async function cacheData<T extends { id: string }>(
  storeName: OfflineStoreName,
  data: T | T[]
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);

  if (Array.isArray(data)) {
    for (const item of data) {
      await store.put(item);
    }
  } else {
    await store.put(data);
  }

  await tx.done;

  // Update sync metadata
  await updateSyncMeta(storeName);
}

export async function getCachedData<T>(
  storeName: OfflineStoreName
): Promise<T[]> {
  const db = await getDB();
  return (await db.getAll(storeName)) as T[];
}

export async function getCachedById<T>(
  storeName: OfflineStoreName,
  id: string
): Promise<T | undefined> {
  const db = await getDB();
  return (await db.get(storeName, id)) as T | undefined;
}

export async function getCachedByIndex<T>(
  storeName: OfflineStoreName,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await getDB();
  const tx = db.transaction(storeName, "readonly");
  const store = tx.objectStore(storeName);
  const index = store.index(indexName);
  return (await index.getAll(value)) as T[];
}

export async function deleteCachedData(
  storeName: OfflineStoreName,
  id: string
): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, id);
}

export async function clearStore(storeName: OfflineStoreName): Promise<void> {
  const db = await getDB();
  await db.clear(storeName);
}

// ---- Sync Metadata ----

interface SyncMeta {
  storeName: string;
  lastSyncedAt: string;
  recordCount: number;
}

async function updateSyncMeta(storeName: OfflineStoreName): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("_sync_meta", "readwrite");
  const store = tx.objectStore("_sync_meta");
  const count = await db.count(storeName);

  await store.put({
    storeName,
    lastSyncedAt: new Date().toISOString(),
    recordCount: count,
  });

  await tx.done;
}

export async function getSyncMeta(
  storeName: OfflineStoreName
): Promise<SyncMeta | undefined> {
  const db = await getDB();
  return (await db.get("_sync_meta", storeName)) as SyncMeta | undefined;
}

export async function getAllSyncMeta(): Promise<SyncMeta[]> {
  const db = await getDB();
  return (await db.getAll("_sync_meta")) as SyncMeta[];
}

// ---- Cache TTL Check ----

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function isCacheFresh(storeName: OfflineStoreName): Promise<boolean> {
  const meta = await getSyncMeta(storeName);
  if (!meta) return false;

  const lastSync = new Date(meta.lastSyncedAt).getTime();
  return Date.now() - lastSync < CACHE_TTL_MS;
}

// ---- Query Cache Helpers for React Query ----

/**
 * Create a query function that tries Supabase first, falls back to IndexedDB cache
 */
export function createCachedQuery<T>(
  storeName: OfflineStoreName,
  fetcher: () => Promise<T>
): () => Promise<T> {
  return async (): Promise<T> => {
    try {
      const fresh = await isCacheFresh(storeName);
      if (!fresh) {
        const data = await fetcher();
        if (data !== null && data !== undefined) {
          await cacheData(storeName, data as { id: string } | { id: string }[]);
        }
        return data;
      }
      // Cache is fresh, try fetching but don't fail
      try {
        const data = await fetcher();
        if (data !== null && data !== undefined) {
          const items = Array.isArray(data) ? data : [data];
          await cacheData(storeName, items as { id: string }[]);
        }
        return data;
      } catch {
        // Network failed, use cache
        const cached = await getCachedData<T>(storeName);
        if (cached.length > 0) return cached as T;
        throw new Error("لا يوجد اتصال بالإنترنت ولا توجد بيانات مخزنة");
      }
    } catch (err) {
      // Primary fetch failed, fall back to cache
      const cached = await getCachedData<T>(storeName);
      if (cached.length > 0) return cached as T;
      throw err;
    }
  };
}

// ---- Network Status Detection ----

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  const handler = () => callback(navigator.onLine);
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}

// ---- Storage Size Estimate ----

export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  usagePercent: number;
}> {
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    return {
      usage,
      quota,
      usagePercent: quota > 0 ? (usage / quota) * 100 : 0,
    };
  }
  return { usage: 0, quota: 0, usagePercent: 0 };
}

// ---- Cleanup ----

export async function clearAllCaches(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([...ALL_STORES, "_sync_meta"], "readwrite");
  for (const storeName of ALL_STORES) {
    await tx.objectStore(storeName).clear();
  }
  await tx.objectStore("_sync_meta").clear();
  await tx.done;
}

export async function closeDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
