import { describe, expect, it } from "vitest";
import { BOOK_CAPABILITIES, canBook } from "@/domain/book/capabilities";

describe("V3 shared book capability policy", () => {
  it("allows reading-related callers to remain separate from editing policy", () => {
    expect(canBook({ locked: false }, "chapter.edit")).toBe(true);
    expect(canBook({ locked: true }, "chapter.edit")).toBe(false);
  });

  it("fails closed for missing books and unknown capabilities", () => {
    expect(canBook(null, "chapter.edit")).toBe(false);
    expect(canBook({ locked: false }, "unknown.operation")).toBe(false);
    expect(Object.keys(BOOK_CAPABILITIES)).toContain("gallery.manage");
  });
});