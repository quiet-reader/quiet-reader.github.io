import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { freshBook } from "@/domain/book/factory";
import { canBook } from "@/domain/book/capabilities";
import {
  getAllLegacyRecords,
  putLegacyRecord,
  type LegacyLibraryRecord,
} from "@/infrastructure/persistence/legacyDatabase";

type ChapterImage = { id: string; data: string; caption?: string; [field: string]: unknown };
type ChapterRecord = {
  id?: string;
  title?: string;
  text?: string;
  images?: ChapterImage[];
  createdAt?: number;
  updatedAt?: number;
  history?: Array<{ title?: string; text?: string; editedAt?: number; [field: string]: unknown }>;
  [field: string]: unknown;
};
type BookmarkRecord = { id?: string; chapter: number; offset?: number; anchorOffset?: number; text?: string; created?: number; [field: string]: unknown };
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
  bookmarks?: BookmarkRecord[];
  progress?: { chapter: number; offset: number; [field: string]: unknown };
  [field: string]: unknown;
};

function isBook(record: LegacyLibraryRecord): record is BookRecord {
  return record["kind"] === "book" || Array.isArray(record["chapters"]) || record["source"] === "manual";
}
function makeId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function displayDate(value: unknown): string {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "Not updated yet";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(timestamp));
}
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected image could not be read."));
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Invalid image data."));
    reader.readAsDataURL(file);
  });
}
function chapterParagraphs(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
}

export function LibraryScreen() {
  const [records, setRecords] = useState<BookRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isCreatingChapter, setIsCreatingChapter] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftImages, setDraftImages] = useState<ChapterImage[]>([]);
  const [readerIndex, setReaderIndex] = useState<number | null>(null);
  const [fontScale, setFontScale] = useState(1);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

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
    const list = !normalized ? [...records] : records.filter((book) => [
      book.title, book.author, ...(book.chapters ?? []).flatMap((chapter) => [chapter.title, chapter.text]),
    ].some((value) => String(value ?? "").toLocaleLowerCase().includes(normalized)));
    return list.sort((a, b) => Number(Boolean(b["pinned"])) - Number(Boolean(a["pinned"])) ||
      Number(b.updated ?? 0) - Number(a.updated ?? 0));
  }, [query, records]);

  const activeBook = records.find((book) => book.id === activeBookId) ?? null;
  const chapters = activeBook?.chapters ?? [];
  const activeChapter = readerIndex === null ? null : chapters[readerIndex] ?? null;

  async function persistBook(updated: BookRecord) {
    await putLegacyRecord(updated);
    setRecords((current) => current.map((book) => book.id === updated.id ? updated : book));
  }

  async function createNovel() {
    const title = window.prompt("Name your new novel");
    if (!title?.trim()) return;
    setSaving(true); setError(null);
    try {
      const record = freshBook("manual", title.trim());
      await putLegacyRecord(record as unknown as LegacyLibraryRecord);
      await refresh();
      setActiveBookId(record.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the novel.");
    } finally { setSaving(false); }
  }

  function openEditor(index: number | null) {
    if (!activeBook || !canBook(activeBook, index === null ? "chapter.create" : "chapter.edit")) {
      setError("Unlock this book before editing its chapters.");
      return;
    }
    const chapter = index === null ? null : activeBook.chapters?.[index];
    setEditingIndex(index);
    setIsCreatingChapter(index === null);
    setDraftTitle(chapter?.title ?? `Chapter ${(activeBook.chapters?.length ?? 0) + 1}`);
    setDraftText(chapter?.text ?? "");
    setDraftImages(chapter?.images ? [...chapter.images] : []);
    setError(null);
  }

  async function insertImage(file?: File) {
    if (!file || !activeBook) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    try {
      const data = await readAsDataUrl(file);
      const id = makeId("image");
      const marker = `\n[IMAGE:${id}]\n`;
      const textarea = textAreaRef.current;
      const start = textarea?.selectionStart ?? draftText.length;
      const end = textarea?.selectionEnd ?? start;
      setDraftText((current) => current.slice(0, start) + marker + current.slice(end));
      setDraftImages((current) => [...current, { id, data, caption: file.name }]);
      requestAnimationFrame(() => {
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(start + marker.length, start + marker.length);
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not insert the image.");
    }
  }

  async function saveChapter() {
    if (!activeBook || !canBook(activeBook, editingIndex === null ? "chapter.create" : "chapter.edit")) {
      setError("This book is locked. No changes were saved."); return;
    }
    if (editingIndex !== null && !activeBook.chapters?.[editingIndex]) {
      setError("This chapter no longer exists. Refresh the library before editing again."); return;
    }
    setSaving(true); setError(null);
    const now = Date.now();
    const previous = editingIndex === null ? null : activeBook.chapters?.[editingIndex] ?? null;
    const nextChapter: ChapterRecord = previous ? {
      ...previous,
      title: draftTitle.trim() || "Untitled chapter",
      text: draftText,
      images: draftImages,
      createdAt: previous.createdAt ?? Number(previous["addedAt"] ?? now),
      updatedAt: now,
      history: [...(previous.history ?? []), {
        title: previous.title ?? "",
        text: previous.text ?? "",
        editedAt: now,
      }].slice(-100),
    } : {
      id: makeId("chapter"),
      title: draftTitle.trim() || "Untitled chapter",
      text: draftText,
      images: draftImages,
      createdAt: now,
      updatedAt: now,
      history: [],
    };
    const nextChapters = [...(activeBook.chapters ?? [])];
    if (editingIndex === null) nextChapters.push(nextChapter);
    else nextChapters[editingIndex] = nextChapter;
    try {
      await persistBook({ ...activeBook, chapters: nextChapters, updated: now });
      setEditingIndex(null); setIsCreatingChapter(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the chapter.");
    } finally { setSaving(false); }
  }

  async function deleteChapter(index: number) {
    if (!activeBook || !canBook(activeBook, "chapter.delete")) {
      setError("Unlock this book before deleting chapters."); return;
    }
    if (!window.confirm(`Delete "${activeBook.chapters?.[index]?.title || `Chapter ${index + 1}`}"? This cannot be undone.`)) return;
    if (!activeBook.chapters?.[index]) return;
    const now = Date.now();
    const updated = { ...activeBook, chapters: activeBook.chapters!.filter((_, i) => i !== index), updated: now };
    try {
      await persistBook(updated);
      if (readerIndex !== null) setReaderIndex(null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the chapter.");
    }
  }

  async function saveReadingProgress(book: BookRecord, chapter: number, offset: number) {
    const updated = { ...book, progress: { ...(book.progress ?? { chapter: 0, offset: 0 }), chapter, offset }, updated: Date.now() };
    try { await persistBook(updated); } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save reading progress.");
    }
  }

  function openReader(index: number) {
    if (!activeBook?.chapters?.[index]) return;
    setReaderIndex(index);
    window.scrollTo({ top: 0 });
  }

  useEffect(() => {
    if (readerIndex === null || !activeBook) return;
    const saved = activeBook.progress?.chapter === readerIndex ? Number(activeBook.progress.offset) || 0 : 0;
    const timer = window.setTimeout(() => window.scrollTo({ top: saved, behavior: "instant" as ScrollBehavior }), 0);
    return () => window.clearTimeout(timer);
  }, [readerIndex, activeBook?.id]);

  function changeReaderChapter(next: number) {
    if (!activeBook || next < 0 || next >= (activeBook.chapters?.length ?? 0)) return;
    const offset = window.scrollY;
    void saveReadingProgress(activeBook, readerIndex ?? 0, offset);
    setReaderIndex(next);
    window.scrollTo({ top: 0 });
  }

  async function toggleBookmark() {
    if (!activeBook || readerIndex === null) return;
    const bookmarks = [...(activeBook.bookmarks ?? [])];
    const existing = bookmarks.findIndex((mark) => mark.chapter === readerIndex);
    if (existing >= 0) bookmarks.splice(existing, 1);
    else bookmarks.push({
      id: makeId("bookmark"), chapter: readerIndex, offset: window.scrollY,
      anchorOffset: window.scrollY + window.innerHeight / 2,
      text: activeChapter?.title ?? `Chapter ${readerIndex + 1}`, created: Date.now(),
    });
    try { await persistBook({ ...activeBook, bookmarks, updated: Date.now() }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the bookmark."); }
  }

  const bookmarked = readerIndex !== null && (activeBook?.bookmarks ?? []).some((mark) => mark.chapter === readerIndex);

  return (
    <main className={`library-page ${readerIndex !== null ? "reading-mode" : ""}`}>
      {readerIndex !== null && activeBook && activeChapter ? (
        <section className="reader-screen">
          <header className="reader-toolbar">
            <button className="quiet-button" onClick={() => { void saveReadingProgress(activeBook, readerIndex, window.scrollY); setReaderIndex(null); }}>← Back to book</button>
            <span className="reader-book-name">{activeBook.title}</span>
            <div className="reader-toolbar-actions">
              <button className={`quiet-button ${bookmarked ? "is-bookmarked" : ""}`} onClick={() => void toggleBookmark()} aria-pressed={bookmarked}>{bookmarked ? "★ Bookmarked" : "☆ Bookmark"}</button>
              <button className="quiet-button" onClick={() => setFontScale((size) => Math.max(.8, Number((size - .1).toFixed(2))))} aria-label="Decrease text size">A−</button>
              <button className="quiet-button" onClick={() => setFontScale((size) => Math.min(1.5, Number((size + .1).toFixed(2))))} aria-label="Increase text size">A+</button>
            </div>
          </header>
          <article className="reading-content" style={{ fontSize: `${fontScale}rem` }}>
            <p className="eyebrow">CHAPTER {readerIndex + 1} OF {chapters.length}</p>
            <h1>{activeChapter.title || `Chapter ${readerIndex + 1}`}</h1>
            <div className="reading-prose">
              {chapterParagraphs(activeChapter.text ?? "").map((paragraph, paragraphIndex) => {
                const pieces = paragraph.split(/(\[IMAGE:[^\]]+\])/g);
                return <p key={paragraphIndex}>{pieces.map((piece, pieceIndex) => {
                  const match = piece.match(/^\[IMAGE:([^\]]+)\]$/);
                  if (!match) return <span key={pieceIndex}>{piece}</span>;
                  const image = (activeChapter.images ?? []).find((item) => item.id === match[1]);
                  return image ? <figure className="chapter-image" key={pieceIndex}><img src={image.data} alt={image.caption ?? ""} /><figcaption>{image.caption}</figcaption></figure> : null;
                })}</p>;
              })}
            </div>
          </article>
          <footer className="reader-pagination">
            <button className="secondary-button" disabled={readerIndex === 0} onClick={() => changeReaderChapter(readerIndex - 1)}>← Previous</button>
            <span>{readerIndex + 1} / {chapters.length}</span>
            <button className="primary-button" disabled={readerIndex >= chapters.length - 1} onClick={() => changeReaderChapter(readerIndex + 1)}>Next →</button>
          </footer>
        </section>
      ) : (
        <>
          <header className="library-top">
            <div>
              <p className="eyebrow">YOUR PRIVATE SHELF</p>
              <h1>Library</h1>
              <p className="library-subtitle">Your books stay in this browser. No account or cloud library required.</p>
            </div>
            <button className="primary-button" onClick={() => void createNovel()} disabled={saving}>＋ New novel</button>
          </header>

          <section className="library-toolbar" aria-label="Library tools">
            <label className="search-field"><span aria-hidden="true">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search books, authors and chapters…" />
            </label>
            <span className="library-count">{visibleBooks.length} {visibleBooks.length === 1 ? "book" : "books"}</span>
          </section>

          {error && <div className="error-banner" role="alert">{error}</div>}
          {loading ? <p className="empty-state">Opening your local library…</p> : visibleBooks.length === 0 ? (
            <section className="empty-state">
              <div className="empty-icon">▤</div>
              <h2>{records.length === 0 ? "Your shelf is ready" : "No matching books"}</h2>
              <p>{records.length === 0 ? "Create a novel to get started. Your existing Quiet Reader records will appear here automatically." : "Try another title, author or chapter name."}</p>
              {records.length === 0 && <button className="primary-button" onClick={() => void createNovel()}>Create your first novel</button>}
            </section>
          ) : (
            <section className="book-grid" aria-label="Books">
              {visibleBooks.map((book) => (
                <button className={`book-card ${activeBookId === book.id ? "selected" : ""}`} key={book.id} onClick={() => { setActiveBookId(book.id); setEditingIndex(null); setReaderIndex(null); }}>
                  <span className="book-cover">{book.cover ? <img src={book.cover} alt="" /> : <span aria-hidden="true">▤</span>}</span>
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
              {editingIndex !== null || isCreatingChapter ? (
                <div className="chapter-editor">
                  <div className="detail-heading"><div><p className="eyebrow">CHAPTER EDITOR</p><h2>{isCreatingChapter ? "New chapter" : "Edit chapter"}</h2><p>{activeBook.title}</p></div>
                    <button className="quiet-button" onClick={() => { setEditingIndex(null); setIsCreatingChapter(false); }}>Cancel</button>
                  </div>
                  <label>Chapter title<input className="editor-title-input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} maxLength={240} /></label>
                  <label>Chapter text<textarea ref={textAreaRef} className="chapter-textarea" value={draftText} onChange={(event) => setDraftText(event.target.value)} spellCheck /></label>
                  <div className="editor-actions">
                    <label className="secondary-button image-upload-button">Insert image<input type="file" accept="image/*" hidden onChange={(event) => { void insertImage(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
                    <span className="muted-copy">{draftText.length.toLocaleString()} characters · {draftImages.length} images</span>
                    <button className="primary-button" onClick={() => void saveChapter()} disabled={saving}>{saving ? "Saving…" : "Save chapter"}</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="detail-heading">
                    <div><p className="eyebrow">BOOK DETAILS</p><h2>{activeBook.title || "Untitled book"}</h2><p>{activeBook.author || "Unknown author"} · {chapters.length} chapters</p></div>
                    <button className="quiet-button" onClick={() => setActiveBookId(null)}>Close</button>
                  </div>
                  <div className="detail-actions">
                    <button className="secondary-button" onClick={() => openEditor(null)} disabled={!canBook(activeBook, "chapter.create")}>+ Add chapter</button>
                    <button className="secondary-button" onClick={() => { const next = { ...activeBook, locked: !activeBook.locked, updated: Date.now() }; void persistBook(next).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not update lock.")); }}>{activeBook.locked ? "Unlock editing" : "Lock editing"}</button>
                    <span className="muted-copy">{activeBook.locked ? "Locked — editing is disabled" : "Changes are saved to your existing local library"}</span>
                  </div>
                  {error && <div className="error-banner" role="alert">{error}</div>}
                  <ol className="chapter-list">
                    {chapters.map((chapter, index) => (
                      <li key={chapter.id ?? `${activeBook.id}-${index}`}>
                        <div className="chapter-row-title"><strong>{chapter.title || `Chapter ${index + 1}`}</strong><span className="muted-copy">{(chapter.text ?? "").length.toLocaleString()} characters</span></div>
                        <div className="chapter-row-actions">
                          <button className="quiet-button" onClick={() => openReader(index)}>Read</button>
                          <button className="quiet-button" onClick={() => openEditor(index)} disabled={!canBook(activeBook, "chapter.edit")}>Edit</button>
                          <button className="quiet-button danger-button" onClick={() => void deleteChapter(index)} disabled={!canBook(activeBook, "chapter.delete")}>Delete</button>
                        </div>
                      </li>
                    ))}
                    {chapters.length === 0 && <li className="muted-copy">No chapters yet.</li>}
                  </ol>
                  {(activeBook.bookmarks?.length ?? 0) > 0 && <p className="muted-copy">{activeBook.bookmarks?.length ?? 0} saved bookmark{activeBook.bookmarks?.length === 1 ? "" : "s"}</p>}
                </>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
