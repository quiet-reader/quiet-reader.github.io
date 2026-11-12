import { beforeEach, describe, expect, it } from "vitest";
import { createCollectionService } from "@/application/collections/collectionService";
import type { CollectionBook } from "@/domain/collections/contracts";
import type { LegacyItemRepository } from "@/infrastructure/persistence/legacyDatabase";

function makeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe("V3 virtual collections", () => {
  let book: CollectionBook;
  let saved: CollectionBook[];
  let storage: ReturnType<typeof makeStorage>;
  let service: ReturnType<typeof createCollectionService>;
  let nextId: number;

  beforeEach(() => {
    book = {
      id: "book-1", kind: "book", title: "Example",
      chapters: [{ title: "Chapter 1" }],
      gallery: { images: [{ name: "Cover image" }] },
    };
    saved = [];
    storage = makeStorage();
    nextId = 0;
    const repository = {
      getAll: async () => [book],
      get: async () => book,
      save: async (record: CollectionBook) => { saved.push(record); },
      delete: async () => undefined,
      saveMany: async () => undefined,
    } as LegacyItemRepository<CollectionBook>;
    service = createCollectionService({
      repository,
      storage,
      id: () => `id-${++nextId}`,
      now: () => new Date("2026-11-12T00:00:00.000Z"),
      dispatchChanged: () => undefined,
    });
  });

  it("creates named collections and rejects case-insensitive duplicates", () => {
    const collection = service.create("Read later");
    expect(collection.name).toBe("Read later");
    expect(collection.items).toEqual([]);
    expect(() => service.create("read LATER")).toThrow(/already exists/i);
  });

  it("stores stable chapter IDs and toggles membership without copying chapter content", async () => {
    const collection = service.create("Favorites");
    const added = await service.toggle("chapter", book, 0, collection.id);
    expect(added).toBe(true);
    expect(book.chapters?.[0].id).toBe("id-1");
    expect(saved).toHaveLength(1);
    expect(service.list()[0].items).toEqual([
      { type: "chapter", bookId: "book-1", chapterId: "id-1" },
    ]);
    expect(await service.toggle("chapter", book, 0, collection.id)).toBe(false);
    expect(service.list()[0].items).toEqual([]);
  });

  it("keeps pin and favorite flags on the existing book record", async () => {
    expect(await service.toggleBookFlag(book, "pinned")).toBe(true);
    expect(await service.toggleBookFlag(book, "favorite")).toBe(true);
    expect(book.pinned).toBe(true);
    expect(book.favorite).toBe(true);
    expect(saved).toHaveLength(2);
  });

  it("removes stale collection references but preserves valid books", async () => {
    const collection = service.create("Shelf", { type: "book", bookId: "book-1" });
    await service.toggle("book", book, undefined, collection.id);
    const refs = service.list()[0].items;
    expect(refs).toEqual([{ type: "book", bookId: "book-1" }]);
    await service.pruneStaleReferences();
    expect(service.list()[0].items).toHaveLength(1);
  });
});