/** Canonical constructor for new records only; never normalize stored legacy records through it. */
export interface NewBookRecord {
  id: string;
  kind: "book";
  source: string;
  title: string;
  author: string;
  cover: string;
  chapters: unknown[];
  locked: boolean;
  bookmarks: unknown[];
  highlights: unknown[];
  progress: { chapter: number; offset: number };
  updated: number;
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `book-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function freshBook(source: string, title: string, id = createId(), now = Date.now()): NewBookRecord {
  return {
    id,
    kind: "book",
    source,
    title,
    author: "",
    cover: "",
    chapters: [],
    locked: false,
    bookmarks: [],
    highlights: [],
    progress: { chapter: 0, offset: 0 },
    updated: now,
  };
}
