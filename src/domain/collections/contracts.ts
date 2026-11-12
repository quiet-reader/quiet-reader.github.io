export type CollectionItemReference =
  | { type: "book"; bookId: string }
  | { type: "chapter"; bookId: string; chapterId: string }
  | { type: "image"; bookId: string; imageId: string };

export interface UserCollection {
  id: string;
  name: string;
  createdAt: string;
  items: CollectionItemReference[];
}

export type CollectionTarget = "book" | "chapter" | "image";

export interface CollectionBook {
  id: string;
  kind: "book";
  chapters?: Array<{ id?: string; [key: string]: unknown }>;
  gallery?: { images?: Array<{ id?: string; [key: string]: unknown }> };
  pinned?: boolean;
  favorite?: boolean;
  updated?: number;
  [key: string]: unknown;
}
