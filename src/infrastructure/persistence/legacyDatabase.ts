import { openDB, type IDBPDatabase } from "idb";
import { LEGACY_DATABASE } from "@/domain/backup/contracts";

export interface LegacyLibraryRecord {
  id: string;
  [field: string]: unknown;
}

let databasePromise: Promise<IDBPDatabase> | undefined;

/**
 * Compatibility adapter for the deployed app's existing IndexedDB database.
 * It deliberately opens version 1 without an upgrade callback that mutates schema.
 */
export function openLegacyDatabase(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Quiet Reader persistence is available only in a browser."));
  }

  databasePromise ??= openDB(LEGACY_DATABASE.name, LEGACY_DATABASE.version);
  return databasePromise;
}

export async function getAllLegacyRecords(): Promise<LegacyLibraryRecord[]> {
  const database = await openLegacyDatabase();
  return database.getAll(LEGACY_DATABASE.store) as Promise<LegacyLibraryRecord[]>;
}

export async function putLegacyRecord(record: LegacyLibraryRecord): Promise<void> {
  const database = await openLegacyDatabase();
  await database.put(LEGACY_DATABASE.store, record);
}