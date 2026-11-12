import { openDB, type IDBPDatabase } from "idb";
import { LEGACY_DATABASE } from "@/domain/backup/contracts";

export interface LegacyLibraryRecord {
  id: string;
  [field: string]: unknown;
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
    blocked() {
      databasePromise = undefined;
    },
    blocking() {
      databasePromise = undefined;
    },
    terminated() {
      databasePromise = undefined;
    },
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

export async function putLegacyRecord(record: LegacyLibraryRecord): Promise<void> {
  const database = await openLegacyDatabase();
  await database.put(LEGACY_DATABASE.store, record);
}

export async function putLegacyRecords(records: LegacyLibraryRecord[]): Promise<void> {
  if (records.length === 0) return;
  const database = await openLegacyDatabase();
  const transaction = database.transaction(LEGACY_DATABASE.store, "readwrite");
  await Promise.all(records.map((record) => transaction.store.put(record)));
  await transaction.done;
}
