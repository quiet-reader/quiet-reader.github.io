/** Shared, side-effect-free book editing policy migrated from V3. */
export const BOOK_CAPABILITIES = {
  "book.edit-metadata": "unlocked-book",
  "book.edit-tags": "unlocked-book",
  "book.edit-cover": "unlocked-book",
  "book.delete": "unlocked-book",
  "chapter.create": "unlocked-book",
  "chapter.edit": "unlocked-book",
  "chapter.delete": "unlocked-book",
  "chapter.rename": "unlocked-book",
  "chapter.reorder": "unlocked-book",
  "gallery.manage": "unlocked-book",
  "novel-links.manage": "unlocked-book",
  "chapter-links.manage": "unlocked-book",
} as const;

export type BookCapability = keyof typeof BOOK_CAPABILITIES;

export interface LockableBook {
  locked?: boolean;
}

export function canBook(book: LockableBook | null | undefined, capability: string): boolean {
  if (!book || !Object.hasOwn(BOOK_CAPABILITIES, capability)) return false;
  return book.locked !== true;
}
