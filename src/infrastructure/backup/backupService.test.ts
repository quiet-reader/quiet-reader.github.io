import { describe, expect, it } from "vitest";
import { parseBackupFile } from "./backupService";

describe("legacy Quiet Reader backup parsing", () => {
  it("accepts version 2 backups with books and pastes arrays", async () => {
    const file = new File([JSON.stringify({
      format: "QuietBookBackup",
      version: 2,
      books: [{ id: "book-1", kind: "book", title: "A" }],
      pastes: [{ id: "paste-1", kind: "paste", text: "B" }],
      collections: [{ id: "collection-1", name: "Saved" }],
    })], "backup.json", { type: "application/json" });
    const result = await parseBackupFile(file);
    expect(result.items.map((item) => item.id)).toEqual(["book-1", "paste-1"]);
    expect(result.collections).toHaveLength(1);
  });

  it("accepts version 3 backups with a unified item list", async () => {
    const file = new File([JSON.stringify({
      format: "QuietBookBackup",
      version: 3,
      items: [{ id: "book-2", kind: "book", title: "B", unknownLegacyField: { keep: true } }],
    })], "backup.json", { type: "application/json" });
    const result = await parseBackupFile(file);
    expect(result.items[0]?.["unknownLegacyField"]).toEqual({ keep: true });
  });

  it("rejects unsupported formats and versions", async () => {
    const file = new File([JSON.stringify({ format: "Other", version: 1, items: [] })], "backup.json");
    await expect(parseBackupFile(file)).rejects.toThrow(/Unsupported legacy/);
  });
});
