import { describe, expect, it } from "vitest";
import {
  LEGACY_DATABASE,
  LEGACY_JSON_BACKUP_FORMAT,
} from "@/domain/backup/contracts";

describe("legacy data contract", () => {
  it("pins the deployed IndexedDB identity", () => {
    expect(LEGACY_DATABASE).toEqual({
      name: "quietbook-v2",
      version: 1,
      store: "items",
      keyPath: "id",
    });
  });

  it("recognizes the established legacy JSON format identifier", () => {
    expect(LEGACY_JSON_BACKUP_FORMAT).toBe("QuietBookBackup");
  });
});