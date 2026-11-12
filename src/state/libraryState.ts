import type { CollectionBook } from "@/domain/collections/contracts";

/** Feature-owned transient library state. Persisted records remain in IndexedDB. */
export interface LibraryState {
  books: CollectionBook[];
  pastes: unknown[];
  activeBook: CollectionBook | null;
  filter: string;
  tagFilter: string;
}

export const initialLibraryState: LibraryState = {
  books: [],
  pastes: [],
  activeBook: null,
  filter: "all",
  tagFilter: "all",
};
