import { describe, expect, it } from "vitest";
import { parseBackupFile } from "./backupService";

function jsonFile(value: unknown): File {
  return {
    name: "backup.json",
    type: "application/json",
    text: async () => JSON.stringify(value),
  } as File;
}

describe("legacy Quiet Reader backup parsing", () => {
  it("accepts version 2 backups with books and pastes arrays", async () => {
    const result = await parseBackupFile(jsonFile({
      format: "QuietBookBackup", version: 2,
      books: [{ id: "book-1", kind: "book", title: "A" }],
      pastes: [{ id: "paste-1", kind: "paste", text: "B" }],
      collections: [{ id: "collection-1", name: "Saved" }],
    }));
    expect(result.items.map((item) => item.id)).toEqual(["book-1", "paste-1"]);
    expect(result.collections).toHaveLength(1);
  });

  it("accepts version 3 backups with a unified item list", async () => {
    const result = await parseBackupFile(jsonFile({
      format: "QuietBookBackup", version: 3,
      items: [{ id: "book-2", kind: "book", title: "B", unknownLegacyField: { keep: true } }],
    }));
    expect(result.items[0]?.["unknownLegacyField"]).toEqual({ keep: true });
  });

  it("rejects unsupported formats and versions", async () => {
    await expect(parseBackupFile(jsonFile({ format: "Other", version: 1, items: [] })))
      .rejects.toThrow(/Unsupported legacy/);
  });
});
