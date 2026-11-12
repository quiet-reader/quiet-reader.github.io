import { useCallback, useEffect, useMemo, useState } from "react";
import { freshBook } from "@/domain/book/factory";
import {
  getAllLegacyRecords,
  putLegacyRecord,
  type LegacyLibraryRecord,
} from "@/infrastructure/persistence/legacyDatabase";

type ChapterRecord = { id?: string; title?: string; text?: string; [field: string]: unknown };
type BookRecord = LegacyLibraryRecord & {
  kind?: string;
  source?: string;
  title?: string;
  author?: string;
  cover?: string;
  chapters?: ChapterRecord[];
  tags?: string[];
  rating?: number;
  updated?: number;
  locked?: boolean;
  notes?: string;
};

function isBook(record: LegacyLibraryRecord): record is BookRecord {
  return record["kind"] === "book" || Array.isArray(record["chapters"]) || record["source"] === "manual";
}

function displayDate(value: unknown): string {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "Not updated yet";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(timestamp));
}

export function LibraryScreen() {
  const [records, setRecords] = useState<BookRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getAllLegacyRecords();
      setRecords(all.filter(isBook));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open your local library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const visibleBooks = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return records;
    return records.filter((book) => [
      book.title,
      book.author,
      ...(book.chapters ?? []).map((chapter) => chapter.title),
    ].some((value) => String(value ?? "").toLocaleLowerCase().includes(normalized)));
  }, [query, records]);

  const activeBook = records.find((book) => book.id === activeBookId) ?? null;

  async function createNovel() {
    const title = window.prompt("Name your new novel");
    if (!title?.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const record = freshBook("manual", title.trim());
      await putLegacyRecord(record as unknown as LegacyLibraryRecord);
      await refresh();
      setActiveBookId(record.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the novel.");
    } finally {
      setSaving(false);
    }
  }

  async function addChapter(book: BookRecord) {
    if (book.locked) {
      setError("This book is locked. Unlock it in the book settings before editing.");
      return;
    }
    const title = window.prompt("Chapter title");
    if (!title?.trim()) return;
    const updated: BookRecord = {
      ...book,
      chapters: [...(book.chapters ?? []), {
        id: globalThis.crypto?.randomUUID?.() ?? `chapter-${Date.now()}`,
        title: title.trim(),
        text: "",
        created: Date.now(),
        updated: Date.now(),
      }],
      updated: Date.now(),
    };
    try {
      await putLegacyRecord(updated);
      setRecords((current) => current.map((item) => item.id === book.id ? updated : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add the chapter.");
    }
  }

  return (
    <main className="library-page">
      <header className="library-top">
        <div>
          <p className="eyebrow">YOUR PRIVATE SHELF</p>
          <h1>Library</h1>
          <p className="library-subtitle">Your books stay in this browser. No account or cloud library required.</p>
        </div>
        <button className="primary-button" onClick={() => void createNovel()} disabled={saving}>
          {saving ? "Saving…" : "+ New novel"}
        </button>
      </header>

      <section className="library-toolbar" aria-label="Library tools">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)}
            type="search" placeholder="Search books, authors and chapters…" />
        </label>
        <span className="library-count">{visibleBooks.length} {visibleBooks.length === 1 ? "book" : "books"}</span>
      </section>

      {error && <div className="error-banner" role="alert">{error}</div>}
      {loading ? (
        <p className="empty-state">Opening your local library…</p>
      ) : visibleBooks.length === 0 ? (
        <section className="empty-state">
          <div className="empty-icon">▤</div>
          <h2>{records.length === 0 ? "Your shelf is ready" : "No matching books"}</h2>
          <p>{records.length === 0
            ? "Create a novel to get started. Your existing Quiet Reader records will appear here automatically."
            : "Try another title, author or chapter name."}</p>
          {records.length === 0 && <button className="primary-button" onClick={() => void createNovel()}>Create your first novel</button>}
        </section>
      ) : (
        <section className="book-grid" aria-label="Books">
          {visibleBooks.map((book) => (
            <button className={`book-card ${activeBookId === book.id ? "selected" : ""}`}
              key={book.id} onClick={() => setActiveBookId(book.id)}>
              <span className="book-cover">
                {book.cover ? <img src={book.cover} alt="" /> : <span aria-hidden="true">▤</span>}
              </span>
              <span className="book-card-body">
                <strong>{book.title || "Untitled book"}</strong>
                <span>{book.author || "Unknown author"}</span>
                <span className="book-card-meta">{book.chapters?.length ?? 0} chapters · {displayDate(book.updated)}</span>
              </span>
              {book.locked && <span className="lock-indicator" aria-label="Locked">● Locked</span>}
            </button>
          ))}
        </section>
      )}

      {activeBook && (
        <section className="book-detail-panel" aria-label="Selected book">
          <div className="detail-heading">
            <div>
              <p className="eyebrow">BOOK DETAILS</p>
              <h2>{activeBook.title || "Untitled book"}</h2>
              <p>{activeBook.author || "Unknown author"} · {activeBook.chapters?.length ?? 0} chapters</p>
            </div>
            <button className="quiet-button" onClick={() => setActiveBookId(null)}>Close</button>
          </div>
          <div className="detail-actions">
            <button className="secondary-button" onClick={() => void addChapter(activeBook)} disabled={activeBook.locked}>
              + Add chapter
            </button>
            <span className="muted-copy">{activeBook.locked ? "Locked — editing is disabled" : "Changes are saved to your existing local library"}</span>
          </div>
          <ol className="chapter-list">
            {(activeBook.chapters ?? []).map((chapter, index) => (
              <li key={chapter.id ?? `${activeBook.id}-${index}`}>
                <span>{chapter.title || `Chapter ${index + 1}`}</span>
                <span className="muted-copy">{(chapter.text ?? "").length.toLocaleString()} characters</span>
              </li>
            ))}
            {(activeBook.chapters ?? []).length === 0 && <li className="muted-copy">No chapters yet.</li>}
          </ol>
        </section>
      )}
    </main>
  );
}
