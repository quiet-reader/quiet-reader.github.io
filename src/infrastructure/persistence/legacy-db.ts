import { openDB, type IDBPDatabase } from "idb";
import { CURRENT_DATABASE_NAME, CURRENT_OBJECT_STORE } from "@/domain/backup/contracts";
interface LegacyItem extends Record<string, unknown> { id: string; }
let dbPromise: Promise<IDBPDatabase> | undefined;
/** Opens the existing database at its existing version. Never perform schema upgrades here. */
export function openLegacyDatabase(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") return Promise.reject(new Error("IndexedDB is browser-only."));
  dbPromise ??= openDB(CURRENT_DATABASE_NAME, 1, { upgrade() { /* immutable legacy boundary */ } });
  return dbPromise;
}
export async function readLegacyRecords(): Promise<LegacyItem[]> {
  const db = await openLegacyDatabase();
  return db.getAll(CURRENT_OBJECT_STORE) as Promise<LegacyItem[]>;
}
