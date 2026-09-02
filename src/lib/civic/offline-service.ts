/**
 * Offline-First Service Worker Manager
 *
 * Manages IndexedDB caching of case data, client records,
 * and legal references for courtroom use without internet.
 */

const DB_NAME = 'law-sys-offline';
const DB_VERSION = 1;

export interface OfflineRecord {
  id: string;
  table: string;
  data: unknown;
  syncedAt: string;
  updatedAt: string;
}

let dbInstance: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database.
 */
export async function initOfflineDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores for each table
      const stores = ['cases', 'clients', 'schedules', 'deadlines', 'defenses', 'attachments'];
      for (const storeName of stores) {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          store.createIndex('table', 'table', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Save records to IndexedDB for offline access.
 */
export async function saveOfflineRecords(
  table: string,
  records: Record<string, unknown>[],
): Promise<void> {
  const db = await initOfflineDB();
  const tx = db.transaction(table, 'readwrite');
  const store = tx.objectStore(table);

  for (const record of records) {
    const offlineRecord: OfflineRecord = {
      id: String(record.id),
      table,
      data: record,
      syncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.put(offlineRecord);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Read all records from a table.
 */
export async function getOfflineRecords(table: string): Promise<OfflineRecord[]> {
  const db = await initOfflineDB();
  const tx = db.transaction(table, 'readonly');
  const store = tx.objectStore(table);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if we're online.
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Get sync status for all tables.
 */
export async function getSyncStatus(): Promise<
  Record<string, { count: number; lastSync: string | null }>
> {
  const tables = ['cases', 'clients', 'schedules', 'deadlines', 'defenses', 'attachments'];
  const status: Record<string, { count: number; lastSync: string | null }> = {};

  for (const table of tables) {
    const records = await getOfflineRecords(table);
    const lastSync = records.length > 0
      ? records.reduce((latest, r) =>
          r.syncedAt > latest ? r.syncedAt : latest, records[0].syncedAt)
      : null;
    status[table] = { count: records.length, lastSync };
  }

  return status;
}

/**
 * Clear all offline data.
 */
export async function clearOfflineData(): Promise<void> {
  const db = await initOfflineDB();
  const tables = ['cases', 'clients', 'schedules', 'deadlines', 'defenses', 'attachments'];

  for (const table of tables) {
    const tx = db.transaction(table, 'readwrite');
    tx.objectStore(table).clear();
  }
}
