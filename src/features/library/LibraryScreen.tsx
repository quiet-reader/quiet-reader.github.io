import { exportBackup, getBackupDeviceName, restoreBackupFile } from "@/infrastructure/backup/backupService";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { freshBook } from "@/domain/book/factory";
import { canBook } from "@/domain/book/capabilities";
import {
  getAllLegacyRecords,
  putLegacyRecord,
  putLegacyRecords,
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
  const [importing, setImporting] = useState(false);\n  const [backupBusy, setBackupBusy] = useState(false);
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

  async function createBackup() {
    setBackupBusy(true); setError(null);
    try {
      const deviceName = window.prompt("Name this device for backup history", getBackupDeviceName());
      if (deviceName === null) return;
      const result = await exportBackup({ novels: true, marks: true, progress: true, pastes: true, appearance: true }, deviceName);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = result.filename; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a backup.");
    } finally { setBackupBusy(false); }
  }

  async function restoreBackup(file?: File) {
    if (!file) return;
    if (!window.confirm("Restore this backup? Existing records with matching IDs will be updated; unrelated local books will be retained. A backup file is recommended before continuing.")) return;
    setBackupBusy(true); setError(null);
    try {
      const result = await restoreBackupFile(file);
      await refresh();
      window.alert(`Backup restored and verified. ${result.books} books and ${result.pastes} saved pastes were imported.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not restore this backup.");
    } finally { setBackupBusy(false); }
  }

  async function importTxtFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => /\.txt$/i.test(file.name));
    if (!files.length) { setError("No .txt files were selected."); return; }
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    files.sort((a, b) => collator.compare(
      (a as File & { webkitRelativePath?: string }).webkitRelativePath || a.name,
      (b as File & { webkitRelativePath?: string }).webkitRelativePath || b.name,
    ));
    setImporting(true); setError(null);
    try {
      const chapters: ChapterRecord[] = [];
      for (const file of files) {
        const text = (await file.text()).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
        if (!text) continue;
        chapters.push({
          id: makeId("chapter"),
          title: file.name.replace(/\.txt$/i, "") || "Untitled chapter",
          text, images: [], createdAt: Date.now(), updatedAt: Date.now(), history: [],
        });
      }
      if (!chapters.length) throw new Error("The selected text files are empty.");
      const first = files[0] as File & { webkitRelativePath?: string };
      const relative = first.webkitRelativePath || "";
      const folder = relative.includes("/") ? relative.split("/")[0] : "";
      const firstChapter = chapters[0];
      if (!firstChapter) throw new Error("No readable TXT chapters were found.");
      const fallbackTitle = firstChapter.title?.replace(/\s*[-_]?(chapter|ch|part)\s*\d+.*$/i, "").trim();
      const title = folder || fallbackTitle || firstChapter.title || "Imported novel";
      const book = { ...freshBook("manual", title), chapters, updated: Date.now() };
      await putLegacyRecord(book as unknown as LegacyLibraryRecord);
      await refresh();
      setActiveBookId(book.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import the TXT files.");
    } finally { setImporting(false); }
  }

  async function importTxtChapters(fileList: FileList | null) {
    if (!activeBook || !fileList?.length) return;
    if (!canBook(activeBook, "chapter.create")) { setError("Unlock this book before importing chapters."); return; }
    const files = Array.from(fileList).filter((file) => /\.txt$/i.test(file.name))
      .sort((a, b) => new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare(a.name, b.name));
    if (!files.length) { setError("No .txt files were selected."); return; }
    setSaving(true); setError(null);
    try {
      const imported: ChapterRecord[] = [];
      for (const file of files) {
        const text = (await file.text()).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
        if (!text) continue;
        imported.push({ id: makeId("chapter"), title: file.name.replace(/\.txt$/i, ""),
          text, images: [], createdAt: Date.now(), updatedAt: Date.now(), history: [] });
      }
      if (!imported.length) throw new Error("The selected TXT files are empty.");
      await persistBook({ ...activeBook, chapters: [...(activeBook.chapters ?? []), ...imported], updated: Date.now() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import chapters.");
    } finally { setSaving(false); }
  }

  async function moveChapter(index: number, delta: -1 | 1) {
    if (!activeBook || !canBook(activeBook, "chapter.reorder")) {
      setError("Unlock this book before reordering chapters."); return;
    }
    const target = index + delta;
    const nextChapters = [...(activeBook.chapters ?? [])];
    const currentChapter = nextChapters[index];
    const targetChapter = nextChapters[target];
    if (!currentChapter || !targetChapter) return;

    // V3 stores bookmarks, progress and incoming chapter links as indexes.
    // Remap every reference atomically when two chapter positions are swapped.
    const swapIndex = (value: unknown): number => {
      const valueIndex = Number(value);
      if (!Number.isInteger(valueIndex)) return valueIndex;
      return valueIndex === index ? target : valueIndex === target ? index : valueIndex;
    };
    [nextChapters[index], nextChapters[target]] = [targetChapter, currentChapter];
    const allRecords = await getAllLegacyRecords();
    const changedRecords: LegacyLibraryRecord[] = [];
    for (const record of allRecords) {
      if (!isBook(record)) continue;
      let changed = false;
      const chaptersForBook = record.id === activeBook.id ? nextChapters : record.chapters ?? [];
      for (const chapter of chaptersForBook) {
        for (const link of (chapter["links"] as Array<Record<string, unknown>> | undefined) ?? []) {
          if (link["targetBookId"] === activeBook.id && Number.isInteger(Number(link["targetChapterIndex"]))) {
            const oldIndex = Number(link["targetChapterIndex"]);
            const newIndex = swapIndex(oldIndex);
            if (newIndex !== oldIndex) { link["targetChapterIndex"] = newIndex; changed = true; }
          }
        }
      }
      if (record.id === activeBook.id) {
        for (const bookmark of record.bookmarks ?? []) {
          const oldIndex = Number(bookmark.chapter);
          const newIndex = swapIndex(oldIndex);
          if (newIndex !== oldIndex) { bookmark.chapter = newIndex; changed = true; }
        }
        if (record.progress) {
          const oldIndex = Number(record.progress.chapter);
          const newIndex = swapIndex(oldIndex);
          if (newIndex !== oldIndex) { record.progress = { ...record.progress, chapter: newIndex }; changed = true; }
        }
        const readingHistory = record["readingHistory"] as Array<Record<string, unknown>> | undefined;
        for (const entry of readingHistory ?? []) {
          const oldIndex = Number(entry["chapterIndex"]);
          const newIndex = swapIndex(oldIndex);
          if (newIndex !== oldIndex) { entry["chapterIndex"] = newIndex; changed = true; }
        }
        record.chapters = nextChapters;
        record.updated = Date.now();
        changed = true;
      }
      if (changed) changedRecords.push(record);
    }
    try {
      await putLegacyRecords(changedRecords);
      setRecords((current) => current.map((book) => changedRecords.find((item) => item.id === book.id) as BookRecord ?? book));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reorder chapters and preserve their references.");
    }
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
            <div className="library-top-actions"><button className="secondary-button" onClick={() => void createBackup()} disabled={backupBusy}>{backupBusy ? "Working…" : "Export backup"}</button><label className="secondary-button import-txt-button">Restore backup<input type="file" accept=".zip,.json,application/zip,application/json" hidden disabled={backupBusy} onChange={(event) => { void restoreBackup(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label><label className="secondary-button import-txt-button">{importing ? "Importing…" : "Import TXT / folder"}<input type="file" accept=".txt,text/plain" multiple hidden disabled={importing} onChange={(event) => { if (event.target.files) void importTxtFiles(event.target.files); event.currentTarget.value = ""; }} /></label><button className="primary-button" onClick={() => void createNovel()} disabled={saving}>＋ New novel</button></div>
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
                    <button className="secondary-button" onClick={() => openEditor(null)} disabled={!canBook(activeBook, "chapter.create")}>+ Add chapter</button>\n                    <label className="secondary-button import-txt-button">Import TXT chapters<input type="file" accept=".txt,text/plain" multiple hidden disabled={!canBook(activeBook, "chapter.create") || saving} onChange={(event) => { void importTxtChapters(event.target.files); event.currentTarget.value = ""; }} /></label>
                    <button className="secondary-button" onClick={() => { const next = { ...activeBook, locked: !activeBook.locked, updated: Date.now() }; void persistBook(next).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not update lock.")); }}>{activeBook.locked ? "Unlock editing" : "Lock editing"}</button>
                    <span className="muted-copy">{activeBook.locked ? "Locked — editing is disabled" : "Changes are saved to your existing local library"}</span>
                  </div>
                  {error && <div className="error-banner" role="alert">{error}</div>}
                  <ol className="chapter-list">
                    {chapters.map((chapter, index) => (
                      <li key={chapter.id ?? `${activeBook.id}-${index}`}>
                        <div className="chapter-row-title"><strong>{chapter.title || `Chapter ${index + 1}`}</strong><span className="muted-copy">{(chapter.text ?? "").length.toLocaleString()} characters</span></div>
                        <div className="chapter-row-actions">
                          <button className="quiet-button" onClick={() => void moveChapter(index, -1)} disabled={!canBook(activeBook, "chapter.reorder") || index === 0} aria-label="Move chapter up">↑</button>
                          <button className="quiet-button" onClick={() => void moveChapter(index, 1)} disabled={!canBook(activeBook, "chapter.reorder") || index === chapters.length - 1} aria-label="Move chapter down">↓</button>
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
