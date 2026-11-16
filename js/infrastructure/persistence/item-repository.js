// Infrastructure adapter for Quiet Reader's existing IndexedDB item store.
//
// Compatibility contract:
// - Keep database name, version, store name, and key path unchanged.
// - Preserve the existing record shape; this layer stores records as-is.
// - Do not add implicit migrations or destructive initialization here.
// - db.js remains a compatibility facade for existing feature modules.

const DB_NAME = 'quietbook-v2';
const DB_VERSION = 1;
const STORE_NAME = 'items';

let connection;

export function openItemDatabase() {
  if (connection) return connection;

  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      connection = undefined;
      reject(new Error('Quiet Reader storage upgrade is blocked by another open tab.'));
    };
  });

  return connection;
}

export async function put(item) {
  const database = await openItemDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(item);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('The item write was aborted.'));
  });
}

export async function remove(id) {
  const database = await openItemDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('The item deletion was aborted.'));
  });
}

export async function putMany(items) {
  const database = await openItemDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    for (const item of items) store.put(item);

    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('Restore transaction was aborted.'));
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAll() {
  const database = await openItemDatabase();

  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME).objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
