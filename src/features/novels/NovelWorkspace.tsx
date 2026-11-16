import { useMemo, useState, type FormEvent } from "react";
import type { createNovelService, NovelChapter, NovelDraft, NovelRecord } from "@/application/novels/novelService";

type NovelService = ReturnType<typeof createNovelService>;
const emptyDraft: NovelDraft = { title: "", author: "", genre: "", cover: "", links: "", notes: "" };

type Props = {
  mode: "create" | "detail";
  novel?: NovelRecord;
  service: NovelService;
  onBack: () => void;
  onCreated: (novel: NovelRecord) => void;
  onUpdated: (novel: NovelRecord) => void;
};

export function NovelWorkspace({ mode, novel, service, onBack, onCreated, onUpdated }: Props) {
  const [draft, setDraft] = useState<NovelDraft>(() => novel ? {
    title: novel.title ?? "", author: novel.author ?? "", genre: novel.genre ?? "",
    cover: novel.cover ?? "", links: (novel.links ?? []).join("\n"), notes: novel.notes ?? "",
  } : emptyDraft);
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterContent, setChapterContent] = useState("");
  const [editingChapter, setEditingChapter] = useState<NovelChapter | null>(null);
  const [chapterEditorOpen, setChapterEditorOpen] = useState(false);
  const [metadataEditing, setMetadataEditing] = useState(mode === "create");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const chapters = useMemo(() => novel?.chapters ?? [], [novel]);
  const setField = (key: keyof NovelDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  async function saveNovel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (mode === "create") {
        const created = await service.create(draft);
        onCreated(created);
      } else if (novel) {
        const updated = await service.updateMetadata(novel, draft);
        onUpdated(updated);
        setMetadataEditing(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save this novel.");
    } finally {
      setSaving(false);
    }
  }

  async function saveChapter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!novel) return;
    setError("");
    try {
      const updated = editingChapter
        ? await service.updateChapter(novel, editingChapter.id, chapterTitle, chapterContent)
        : await service.addChapter(novel, chapterTitle, chapterContent);
      onUpdated(updated);
      setChapterEditorOpen(false);
      setEditingChapter(null);
      setChapterTitle("");
      setChapterContent("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save this chapter.");
    }
  }

  function editChapter(chapter: NovelChapter) {
    setEditingChapter(chapter);
    setChapterTitle(chapter.title);
    setChapterContent(chapter.content);
    setChapterEditorOpen(true);
  }

  return (
    <section className="novel-workspace">
      <header className="workspace-toolbar">
        <button className="secondary-button" type="button" onClick={onBack}>← Library</button>
        <span className="workspace-kicker">{mode === "create" ? "NEW READING PROJECT" : "NOVEL INDEX"}</span>
        {mode === "detail" && novel && <button className="secondary-button" type="button" onClick={() => setMetadataEditing(!metadataEditing)}>{metadataEditing ? "Close edit" : "Edit details"}</button>}
      </header>

      {metadataEditing ? (
        <form className="novel-form-panel" onSubmit={saveNovel}>
          <div className="workspace-heading"><p className="eyebrow">YOUR NEXT READING PROJECT</p><h1>{mode === "create" ? "Create a new novel" : "Novel details"}</h1><p>Keep the details together. You can update them whenever you like.</p></div>
          <div className="novel-form-grid">
            <label className="form-field form-field-wide">Novel title <input required autoFocus value={draft.title} onChange={(event) => setField("title", event.target.value)} placeholder="Enter the novel title" /></label>
            <label className="form-field">Author <input value={draft.author} onChange={(event) => setField("author", event.target.value)} placeholder="Author name" /></label>
            <label className="form-field">Genre <input value={draft.genre} onChange={(event) => setField("genre", event.target.value)} placeholder="Fantasy, cultivation, sci-fi…" /></label>
            <label className="form-field form-field-wide">Cover image URL <input value={draft.cover} onChange={(event) => setField("cover", event.target.value)} placeholder="https://…" /></label>
            <label className="form-field form-field-wide">Links <textarea rows={3} value={draft.links} onChange={(event) => setField("links", event.target.value)} placeholder="One URL per line" /></label>
            <label className="form-field form-field-wide">Notes <textarea rows={5} value={draft.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Your notes about this novel…" /></label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button className="secondary-button" type="button" onClick={onBack}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : mode === "create" ? "Create novel" : "Save changes"} →</button></div>
        </form>
      ) : novel ? (
        <div className="novel-index">
          <div className="novel-hero">
            <div className="novel-cover">{novel.cover ? <img src={novel.cover} alt="" /> : <div className="cover-placeholder">QUIET<br />READER</div>}</div>
            <div className="novel-summary">
              <p className="eyebrow">YOUR LIBRARY / NOVEL</p><h1>{novel.title}</h1>
              <p className="novel-author">{novel.author || "Unknown author"}{novel.genre ? ` · ${novel.genre}` : ""}</p>
              {novel.notes && <p className="novel-notes">{novel.notes}</p>}
              <div className="novel-metrics"><span>{chapters.length} chapters</span><span>{novel.bookmarks?.length ?? 0} bookmarks</span><span>{novel.highlights?.length ?? 0} highlights</span></div>
              {novel.links?.length ? <div className="novel-links">{novel.links.map((link) => <a href={link} target="_blank" rel="noreferrer" key={link}>{link}</a>)}</div> : null}
            </div>
          </div>
          <div className="chapter-section-heading"><div><p className="eyebrow">READING CONTENT</p><h2>Chapters</h2></div><button className="primary-button" type="button" onClick={() => { setEditingChapter(null); setChapterTitle(""); setChapterContent(""); setChapterEditorOpen(true); }}>＋ Add chapter</button></div>
          {chapterEditorOpen && <form className="chapter-editor" onSubmit={saveChapter}>
            <label className="form-field">Chapter title <input required autoFocus value={chapterTitle} onChange={(event) => setChapterTitle(event.target.value)} placeholder="Chapter 1 — The Beginning" /></label>
            <label className="form-field">Chapter content <textarea required rows={12} value={chapterContent} onChange={(event) => setChapterContent(event.target.value)} placeholder="Paste or write chapter content here…" /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setChapterEditorOpen(false)}>Cancel</button><button className="primary-button" type="submit">Save chapter</button></div>
          </form>}
          {chapters.length ? <ol className="chapter-list">{chapters.map((chapter, index) => <li key={chapter.id}><span className="chapter-number">{String(index + 1).padStart(2, "0")}</span><div className="chapter-title-wrap"><strong>{chapter.title || `Chapter ${index + 1}`}</strong><small>{(chapter.content ?? "").length.toLocaleString()} characters</small></div><button className="secondary-button" type="button" onClick={() => editChapter(chapter)}>Edit</button><button className="text-button danger-text" type="button" onClick={async () => { if (!novel || !window.confirm("Delete this chapter?")) return; const updated = await service.deleteChapter(novel, chapter.id); onUpdated(updated); }}>Delete</button></li>)}</ol> : <div className="chapters-empty"><h3>No chapters yet</h3><p>Add the first chapter to start building this novel.</p></div>}
        </div>
      ) : null}
    </section>
  );
}
