import type { LegacyLibraryRecord } from "@/infrastructure/persistence/legacyDatabase";

export type CollectionReference =
  | { type: "book"; bookId: string }
  | { type: "chapter"; bookId: string; chapterId: string }
  | { type: "image"; bookId: string; imageId: string };
export type VirtualCollection = { id: string; name: string; createdAt: string; items: CollectionReference[] };
const KEY = "qrCollections";
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `collection-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function readCollections(): VirtualCollection[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is VirtualCollection =>
      Boolean(value && typeof value === "object" && typeof value.id === "string" &&
        typeof value.name === "string" && Array.isArray(value.items)));
  } catch { return []; }
}
function writeCollections(collections: VirtualCollection[]): void {
  localStorage.setItem(KEY, JSON.stringify(collections));
}
function sameReference(a: CollectionReference, b: CollectionReference): boolean {
  return a.type === b.type && a.bookId === b.bookId &&
    ("chapterId" in a ? a.chapterId : "") === ("chapterId" in b ? b.chapterId : "") &&
    ("imageId" in a ? a.imageId : "") === ("imageId" in b ? b.imageId : "");
}
export function createCollection(name: string): VirtualCollection {
  const normalized = name.trim();
  if (!normalized) throw new Error("Enter a collection name.");
  const current = readCollections();
  if (current.some((item) => item.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())) {
    throw new Error("A collection with that name already exists.");
  }
  const created: VirtualCollection = { id: makeId(), name: normalized.slice(0, 60), createdAt: new Date().toISOString(), items: [] };
  writeCollections([...current, created]);
  return created;
}
export function deleteCollection(id: string): void {
  writeCollections(readCollections().filter((collection) => collection.id !== id));
}
export function addCollectionReference(collectionId: string, reference: CollectionReference): void {
  const current = readCollections();
  const collection = current.find((item) => item.id === collectionId);
  if (!collection) throw new Error("That collection no longer exists.");
  if (!collection.items.some((item) => sameReference(item, reference))) collection.items.push(reference);
  writeCollections(current);
}
export function removeCollectionReference(collectionId: string, reference: CollectionReference): void {
  writeCollections(readCollections().map((collection) => collection.id === collectionId
    ? { ...collection, items: collection.items.filter((item) => !sameReference(item, reference)) }
    : collection));
}
export function toggleBookCollection(collectionId: string, book: LegacyLibraryRecord): void {
  const reference: CollectionReference = { type: "book", bookId: book.id };
  const current = readCollections();
  const collection = current.find((item) => item.id === collectionId);
  if (!collection) throw new Error("That collection no longer exists.");
  const exists = collection.items.some((item) => sameReference(item, reference));
  if (exists) collection.items = collection.items.filter((item) => !sameReference(item, reference));
  else collection.items.push(reference);
  writeCollections(current);
}
export function pruneCollections(records: LegacyLibraryRecord[]): VirtualCollection[] {
  const books = records.filter((item) => item["kind"] === "book");
  const current = readCollections();
  let changed = false;
  const pruned = current.map((collection) => {
    const valid = collection.items.filter((reference) => {
      const book = books.find((item) => item.id === reference.bookId);
      if (!book) return false;
      if (reference.type === "book") return true;
      if (reference.type === "chapter") return Array.isArray(book["chapters"]) &&
        (book["chapters"] as Array<Record<string, unknown>>).some((chapter) => chapter["id"] === reference.chapterId);
      if (reference.type === "image") {
        const gallery = book["gallery"] as Record<string, unknown> | undefined;
        return Array.isArray(gallery?.["images"]) &&
          (gallery["images"] as Array<Record<string, unknown>>).some((image) => image["id"] === reference.imageId);
      }
      return false;
    });
    if (valid.length !== collection.items.length) changed = true;
    return { ...collection, items: valid };
  });
  if (changed) writeCollections(pruned);
  return pruned;
}
