import type { LegacyItemRepository, LegacyLibraryRecord } from "@/infrastructure/persistence/legacyDatabase";

interface AnnotationBook extends LegacyLibraryRecord {
  bookmarks?: unknown[];
  highlights?: unknown[];
  updated?: number;
  [field: string]: unknown;
}
export interface BookmarkRecord {
  id: string; chapterId?: string; chapterIndex?: number; offset?: number; label?: string; createdAt: number;
  [field: string]: unknown;
}
export interface HighlightRecord {
  id: string; chapterId?: string; chapterIndex?: number; start: number; end: number; text: string; color: string; note?: string; createdAt: number;
  [field: string]: unknown;
}

/** Annotation arrays remain on their existing IndexedDB book record for legacy compatibility. */
export function createAnnotationEngine(repository: LegacyItemRepository<AnnotationBook>) {
  async function append<T extends { id: string }>(bookId: string, key: "bookmarks" | "highlights", item: T): Promise<void> {
    const book = await repository.get(bookId);
    if (!book) throw new Error("Novel not found.");
    const current = Array.isArray(book[key]) ? book[key] as T[] : [];
    await repository.save({ ...book, [key]: [...current, item], updated: Date.now() });
  }
  async function remove(bookId: string, key: "bookmarks" | "highlights", itemId: string): Promise<void> {
    const book = await repository.get(bookId);
    if (!book) throw new Error("Novel not found.");
    const current = Array.isArray(book[key]) ? book[key] as Array<{ id?: string }> : [];
    await repository.save({ ...book, [key]: current.filter((item) => item.id !== itemId), updated: Date.now() });
  }
  return {
    async addBookmark(bookId: string, data: Omit<BookmarkRecord, "id" | "createdAt">): Promise<BookmarkRecord> {
      const item = { ...data, id: globalThis.crypto?.randomUUID?.() ?? `bookmark-${Date.now()}`, createdAt: Date.now() };
      await append(bookId, "bookmarks", item); return item;
    },
    async addHighlight(bookId: string, data: Pick<HighlightRecord, "chapterId" | "chapterIndex" | "start" | "end" | "text" | "color" | "note">): Promise<HighlightRecord> {
      const item = { ...data, id: globalThis.crypto?.randomUUID?.() ?? `highlight-${Date.now()}`, createdAt: Date.now() };
      await append(bookId, "highlights", item); return item;
    },
    removeBookmark: (bookId: string, itemId: string) => remove(bookId, "bookmarks", itemId),
    removeHighlight: (bookId: string, itemId: string) => remove(bookId, "highlights", itemId),
  };
}
