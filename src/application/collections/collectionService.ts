import type { CollectionBook, CollectionItemReference, CollectionTarget, UserCollection } from "@/domain/collections/contracts";
import type { LegacyItemRepository } from "@/infrastructure/persistence/legacyDatabase";

const STORAGE_KEY = "qrCollections";
const COLLECTIONS_CHANGED_EVENT = "quiet-reader-collections-changed";

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `collection-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sameReference(a: CollectionItemReference, b: CollectionItemReference): boolean {
  return a.type === b.type && a.bookId === b.bookId &&
    ("chapterId" in a ? a.chapterId : "") === ("chapterId" in b ? b.chapterId : "") &&
    ("imageId" in a ? a.imageId : "") === ("imageId" in b ? b.imageId : "");
}

function parseCollections(raw: string | null): UserCollection[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is UserCollection =>
      !!item && typeof item === "object" &&
      typeof item.id === "string" && typeof item.name === "string" &&
      typeof item.createdAt === "string" && Array.isArray(item.items),
    ).map((item) => ({ ...item, items: item.items.filter(isCollectionReference) }));
  } catch {
    return [];
  }
}

function isCollectionReference(value: unknown): value is CollectionItemReference {
  if (!value || typeof value !== "object") return false;
  const ref = value as Record<string, unknown>;
  if (typeof ref.bookId !== "string") return false;
  if (ref.type === "book") return true;
  if (ref.type === "chapter") return typeof ref.chapterId === "string";
  if (ref.type === "image") return typeof ref.imageId === "string";
  return false;
}

export interface CollectionServiceDependencies {
  repository: LegacyItemRepository<CollectionBook>;
  storage?: Pick<Storage, "getItem" | "setItem">;
  now?: () => Date;
  id?: () => string;
  dispatchChanged?: () => void;
}

export function createCollectionService({
  repository,
  storage = typeof window === "undefined" ? undefined : window.localStorage,
  now = () => new Date(),
  id = createId,
  dispatchChanged = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(COLLECTIONS_CHANGED_EVENT));
  },
}: CollectionServiceDependencies) {
  function read(): UserCollection[] {
    return parseCollections(storage?.getItem(STORAGE_KEY) ?? null);
  }

  function write(collections: UserCollection[]): void {
    if (!storage) throw new Error("Collections require browser local storage.");
    storage.setItem(STORAGE_KEY, JSON.stringify(collections));
    dispatchChanged();
  }

  async function referenceFor(
    type: CollectionTarget,
    book: CollectionBook,
    childIndex?: number,
  ): Promise<CollectionItemReference | null> {
    if (type === "book") return { type, bookId: book.id };
    if (type === "chapter") {
      const child = book.chapters?.[Number(childIndex)];
      if (!child) return null;
      if (!child.id) child.id = id();
      await repository.save(book);
      return { type, bookId: book.id, chapterId: child.id };
    }
    const child = book.gallery?.images?.[Number(childIndex)];
    if (!child) return null;
    if (!child.id) child.id = id();
    await repository.save(book);
    return { type, bookId: book.id, imageId: child.id };
  }

  return {
    list: read,

    create(name: string, reference?: CollectionItemReference): UserCollection {
      const cleanName = name.trim();
      if (!cleanName) throw new Error("Enter a collection name.");
      const collections = read();
      if (collections.some((item) => item.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase())) {
        throw new Error("A collection with that name already exists.");
      }
      const collection: UserCollection = {
        id: id(),
        name: cleanName,
        createdAt: now().toISOString(),
        items: reference ? [reference] : [],
      };
      write([...collections, collection]);
      return collection;
    },

    async toggle(type: CollectionTarget, book: CollectionBook, childIndex: number | undefined, collectionId: string): Promise<boolean> {
      const reference = await referenceFor(type, book, childIndex);
      if (!reference) return false;
      const collections = read();
      const collection = collections.find((item) => item.id === collectionId);
      if (!collection) throw new Error("Collection not found.");
      const index = collection.items.findIndex((item) => sameReference(item, reference));
      if (index >= 0) collection.items.splice(index, 1);
      else collection.items.push(reference);
      write(collections);
      return index < 0;
    },

    namesFor(type: CollectionTarget, book: CollectionBook, childIndex?: number): string[] {
      const child = type === "chapter" ? book.chapters?.[Number(childIndex)] :
        type === "image" ? book.gallery?.images?.[Number(childIndex)] : undefined;
      if (type !== "book" && !child) return [];
      const reference: CollectionItemReference = type === "book"
        ? { type, bookId: book.id }
        : type === "chapter"
          ? { type, bookId: book.id, chapterId: child?.id ?? "" }
          : { type, bookId: book.id, imageId: child?.id ?? "" };
      return read().filter((collection) => collection.items.some((item) => sameReference(item, reference)))
        .map((collection) => collection.name);
    },

    async remove(collectionId: string): Promise<void> {
      write(read().filter((collection) => collection.id !== collectionId));
    },

    async pruneStaleReferences(): Promise<void> {
      const books = (await repository.getAll()).filter((item) => item.kind === "book");
      const byId = new Map(books.map((book) => [book.id, book]));
      let changed = false;
      const collections = read().map((collection) => ({
        ...collection,
        items: collection.items.filter((reference) => {
          const book = byId.get(reference.bookId);
          if (!book) { changed = true; return false; }
          const exists = reference.type === "book" ||
            (reference.type === "chapter" && (book.chapters ?? []).some((chapter) => chapter.id === reference.chapterId)) ||
            (reference.type === "image" && (book.gallery?.images ?? []).some((image) => image.id === reference.imageId));
          if (!exists) changed = true;
          return exists;
        }),
      }));
      if (changed) write(collections);
    },

    async toggleBookFlag(book: CollectionBook, flag: "pinned" | "favorite"): Promise<boolean> {
      const next = !book[flag];
      const updated = { ...book, [flag]: next, updated: Date.now() };
      await repository.save(updated);
      Object.assign(book, updated);
      return next;
    },
  };
}

export { COLLECTIONS_CHANGED_EVENT };
