import { openDB, type IDBPDatabase } from "idb";
import { LEGACY_DATABASE } from "@/domain/backup/contracts";

export interface LegacyLibraryRecord {
  id: string;
  [field: string]: unknown;
}

export interface LegacyItemRepository<T extends LegacyLibraryRecord = LegacyLibraryRecord> {
  getAll(): Promise<T[]>;
  get(id: string): Promise<T | null>;
  save(record: T): Promise<void>;
  delete(id: string): Promise<void>;
  saveMany(records: T[]): Promise<void>;
}

let databasePromise: Promise<IDBPDatabase> | undefined;

/**
 * Compatibility adapter for the deployed application's existing IndexedDB.
 * The upgrade callback only creates the original store for a genuinely new DB;
 * opening an existing version-1 database does not rewrite or migrate records.
 */
export function openLegacyDatabase(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Quiet Reader persistence is available only in a browser."));
  }

  databasePromise ??= openDB(LEGACY_DATABASE.name, LEGACY_DATABASE.version, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(LEGACY_DATABASE.store)) {
        database.createObjectStore(LEGACY_DATABASE.store, { keyPath: LEGACY_DATABASE.keyPath });
      }
    },
    blocked() { databasePromise = undefined; },
    blocking() { databasePromise = undefined; },
    terminated() { databasePromise = undefined; },
  }).catch((error: unknown) => {
    databasePromise = undefined;
    throw error;
  });

  return databasePromise;
}

export async function getAllLegacyRecords(): Promise<LegacyLibraryRecord[]> {
  const database = await openLegacyDatabase();
  return database.getAll(LEGACY_DATABASE.store) as Promise<LegacyLibraryRecord[]>;
}

export async function getLegacyRecord(id: string): Promise<LegacyLibraryRecord | null> {
  const database = await openLegacyDatabase();
  return (await database.get(LEGACY_DATABASE.store, id) as LegacyLibraryRecord | undefined) ?? null;
}

export async function putLegacyRecord(record: LegacyLibraryRecord): Promise<void> {
  const database = await openLegacyDatabase();
  await database.put(LEGACY_DATABASE.store, record);
}

export async function deleteLegacyRecord(id: string): Promise<void> {
  const database = await openLegacyDatabase();
  await database.delete(LEGACY_DATABASE.store, id);
}

/** All records commit together or none do; used by restore and other atomic batches. */
export async function putLegacyRecords(records: LegacyLibraryRecord[]): Promise<void> {
  if (records.length === 0) return;
  const database = await openLegacyDatabase();
  const transaction = database.transaction(LEGACY_DATABASE.store, "readwrite");
  for (const record of records) void transaction.store.put(record);
  await transaction.done;
}

export const legacyItemRepository: LegacyItemRepository = Object.freeze({
  getAll: getAllLegacyRecords,
  get: getLegacyRecord,
  save: putLegacyRecord,
  delete: deleteLegacyRecord,
  saveMany: putLegacyRecords,
});
