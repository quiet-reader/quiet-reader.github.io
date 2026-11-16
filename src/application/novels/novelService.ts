import { freshBook } from "@/domain/book/factory";
import type { LegacyItemRepository, LegacyLibraryRecord } from "@/infrastructure/persistence/legacyDatabase";

export interface NovelChapter {
  id: string;
  title: string;
  content: string;
  created: number;
  updated: number;
  [field: string]: unknown;
}
export interface NovelRecord extends LegacyLibraryRecord {
  kind: "book";
  source: string;
  title: string;
  author: string;
  genre?: string;
  cover: string;
  links?: string[];
  notes?: string;
  chapters: NovelChapter[];
  bookmarks: unknown[];
  highlights: unknown[];
  updated: number;
  [field: string]: unknown;
}
export interface NovelDraft { title: string; author: string; genre: string; cover: string; links: string; notes: string; }

function createId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
export function isNovelRecord(record: LegacyLibraryRecord): record is NovelRecord {
  const value = record as Record<string, unknown>;
  const kind = String(value["kind"] ?? value["type"] ?? "").toLowerCase();
  if (["gallery", "image-gallery", "paste", "pdf"].includes(kind)) return false;
  return ["book", "novel", "epub"].includes(kind) ||
    (typeof value["title"] === "string" && Array.isArray(value["chapters"]));
}
export function isGalleryRecord(record: LegacyLibraryRecord): boolean {
  const value = record as Record<string, unknown>;
  const kind = String(value["kind"] ?? value["type"] ?? value["category"] ?? "").toLowerCase();
  return kind === "gallery" || kind === "image-gallery";
}
export function createNovelService(repository: LegacyItemRepository) {
  return {
    async list(): Promise<LegacyLibraryRecord[]> { return repository.getAll(); },
    async create(draft: NovelDraft): Promise<NovelRecord> {
      const title = draft.title.trim();
      if (!title) throw new Error("A novel title is required.");
      const book = {
        ...freshBook("manual", title),
        author: draft.author.trim(),
        genre: draft.genre.trim(),
        cover: draft.cover.trim(),
        links: draft.links.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
        notes: draft.notes,
      } as NovelRecord;
      await repository.save(book);
      return book;
    },
    async updateMetadata(book: NovelRecord, draft: NovelDraft): Promise<NovelRecord> {
      const title = draft.title.trim();
      if (!title) throw new Error("A novel title is required.");
      const updated: NovelRecord = {
        ...book, title, author: draft.author.trim(), genre: draft.genre.trim(),
        cover: draft.cover.trim(),
        links: draft.links.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
        notes: draft.notes, updated: Date.now(),
      };
      await repository.save(updated);
      return updated;
    },
    async addChapter(book: NovelRecord, title: string, content: string): Promise<NovelRecord> {
      const cleanTitle = title.trim();
      if (!cleanTitle) throw new Error("A chapter title is required.");
      const now = Date.now();
      const chapter: NovelChapter = { id: createId("chapter"), title: cleanTitle, content, created: now, updated: now };
      const updated = { ...book, chapters: [...(book.chapters ?? []), chapter], updated: now };
      await repository.save(updated);
      return updated;
    },
    async updateChapter(book: NovelRecord, chapterId: string, title: string, content: string): Promise<NovelRecord> {
      const cleanTitle = title.trim();
      if (!cleanTitle) throw new Error("A chapter title is required.");
      const now = Date.now();
      let found = false;
      const chapters = (book.chapters ?? []).map((chapter) => {
        if (chapter.id !== chapterId) return chapter;
        found = true;
        return { ...chapter, title: cleanTitle, content, updated: now };
      });
      if (!found) throw new Error("Chapter not found.");
      const updated = { ...book, chapters, updated: now };
      await repository.save(updated);
      return updated;
    },
    async deleteChapter(book: NovelRecord, chapterId: string): Promise<NovelRecord> {
      const chapters = (book.chapters ?? []).filter((chapter) => chapter.id !== chapterId);
      if (chapters.length === book.chapters.length) return book;
      const updated = { ...book, chapters, updated: Date.now() };
      await repository.save(updated);
      return updated;
    },
  };
}
