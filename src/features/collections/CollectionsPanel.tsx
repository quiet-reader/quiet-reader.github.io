import { useMemo, useState } from "react";
import type { LegacyLibraryRecord } from "@/infrastructure/persistence/legacyDatabase";
import {
  createCollection, deleteCollection, pruneCollections, toggleBookCollection,
  type VirtualCollection,
} from "@/application/collections/virtualCollections";

type BookLike = LegacyLibraryRecord & { title?: string; chapters?: Array<{ id?: string; title?: string }>; gallery?: { images?: Array<{ id?: string; name?: string }> } };
type Props = { records: BookLike[]; onOpenBook: (id: string) => void };
export function CollectionsPanel({ records, onOpenBook }: Props) {
  const [revision, setRevision] = useState(0);
  const [selectedBook, setSelectedBook] = useState("");
  const [newName, setNewName] = useState("");
  const collections = useMemo(() => pruneCollections(records), [records, revision]);
  const bookById = (id: string) => records.find((record) => record.id === id);
  const refresh = () => setRevision((value) => value + 1);
  function addCollection() {
    try { createCollection(newName); setNewName(""); refresh(); }
    catch (error) { window.alert(error instanceof Error ? error.message : "Could not create collection."); }
  }
  function addBook(collection: VirtualCollection) {
    const book = bookById(selectedBook);
    if (!book) return;
    toggleBookCollection(collection.id, book);
    refresh();
  }
  return <section className="collections-panel">
    <header className="collections-heading"><div><p className="eyebrow">YOUR ORGANIZATION</p><h2>Collections</h2><p className="muted-copy">Virtual groups reference your existing books. They never duplicate or move book data.</p></div></header>
    <div className="collection-create-row"><input aria-label="New collection name" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={60} placeholder="Name a collection…" onKeyDown={(event) => { if (event.key === "Enter") addCollection(); }} /><button className="primary-button" onClick={addCollection}>＋ Create</button></div>
    {collections.length === 0 ? <p className="empty-state">No collections yet. Create one to organize books, chapters or gallery images.</p> :
      <div className="collection-grid">{collections.map((collection) => {
        const members = collection.items.filter((item) => item.type === "book").map((item) => bookById(item.bookId)).filter((book): book is BookLike => Boolean(book));
        return <article className="collection-card" key={collection.id}>
          <div className="collection-card-heading"><div><h3>{collection.name}</h3><span className="muted-copy">{collection.items.length} references</span></div><button className="quiet-button danger-button" onClick={() => { if (window.confirm(`Delete collection “${collection.name}”? Your books will not be deleted.`)) { deleteCollection(collection.id); refresh(); } }}>Delete</button></div>
          <label className="collection-add-row"><select value={selectedBook} onChange={(event) => setSelectedBook(event.target.value)}><option value="">Choose a book…</option>{records.map((book) => <option key={book.id} value={book.id}>{book.title || "Untitled book"}</option>)}</select><button className="secondary-button" disabled={!selectedBook} onClick={() => addBook(collection)}>Add / remove</button></label>
          <div className="collection-members">{members.length ? members.map((book) => <button key={book.id} className="collection-member" onClick={() => onOpenBook(book.id)}>{book.title || "Untitled book"} <span>↗</span></button>) : <p className="muted-copy">No books in this collection yet.</p>}</div>
        </article>;
      })}</div>}
  </section>;
}
