import { describe, expect, it } from "vitest";
import { createNovelService, type NovelRecord } from "@/application/novels/novelService";
import type { LegacyItemRepository, LegacyLibraryRecord } from "@/infrastructure/persistence/legacyDatabase";

function memoryRepository(): LegacyItemRepository {
  const records = new Map<string, LegacyLibraryRecord>();
  return {
    async getAll() { return [...records.values()]; },
    async get(id) { return records.get(id) ?? null; },
    async save(record) { records.set(record.id, record); },
    async delete(id) { records.delete(id); },
    async saveMany(items) { items.forEach((item) => records.set(item.id, item)); },
  };
}

describe("novel service", () => {
  it("creates a legacy-compatible book record with metadata", async () => {
    const repository = memoryRepository();
    const service = createNovelService(repository);
    const novel = await service.create({
      title: "The Quiet Path", author: "A. Writer", genre: "Fantasy", cover: "",
      links: "https://example.com\nhttps://example.org", notes: "Read later",
    });
    expect(novel.kind).toBe("book");
    expect(novel.chapters).toEqual([]);
    expect(novel.links).toEqual(["https://example.com", "https://example.org"]);
    expect((await repository.get(novel.id))?.['title']).toBe('The Quiet Path');
  });

  it("adds, edits and removes chapters without dropping unknown book fields", async () => {
    const repository = memoryRepository();
    const service = createNovelService(repository);
    const novel = await service.create({ title: "A Novel", author: "", genre: "", cover: "", links: "", notes: "" });
    const withLegacyField = { ...novel, legacyExtension: { untouched: true } } as NovelRecord;
    await repository.save(withLegacyField);
    const added = await service.addChapter(withLegacyField, "Chapter 1", "Opening text");
    expect(added.chapters).toHaveLength(1);
    expect(added['legacyExtension']).toEqual({ untouched: true });
    const addedChapter = added.chapters[0];
    if (!addedChapter) throw new Error("Expected chapter to be created.");
    const edited = await service.updateChapter(added, addedChapter.id, "Revised Chapter", "Updated text");
    expect(edited.chapters[0]?.title).toBe("Revised Chapter");
    const removed = await service.deleteChapter(edited, addedChapter.id);
    expect(removed.chapters).toHaveLength(0);
    expect(removed['legacyExtension']).toEqual({ untouched: true });
  });

  it("rejects blank novel and chapter titles", async () => {
    const service = createNovelService(memoryRepository());
    await expect(service.create({ title: " ", author: "", genre: "", cover: "", links: "", notes: "" })).rejects.toThrow("novel title");
    const novel = await service.create({ title: "A Novel", author: "", genre: "", cover: "", links: "", notes: "" });
    await expect(service.addChapter(novel, " ", "content")).rejects.toThrow("chapter title");
  });
});
