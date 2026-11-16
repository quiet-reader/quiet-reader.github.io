import { useEffect, useRef, useState, type FormEvent } from "react";
import { isGalleryRecord } from "@/application/novels/novelService";
import { legacyItemRepository, type LegacyLibraryRecord } from "@/infrastructure/persistence/legacyDatabase";

type Section = "Library" | "Galleries";
type GalleryImage = { id: string; data: string; caption: string };
type GalleryRecord = LegacyLibraryRecord & { kind: "gallery"; title: string; cover: string; images: GalleryImage[]; updated: number };

function LibraryIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" /><path d="M4 6h13M8 7v8" /></svg>;
}
function GalleryIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 5-5 3 3 3-4 5 6" /></svg>;
}
function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unable to read image."));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });
}

export function AppShell() {
  const [section, setSection] = useState<Section>("Library");
  const [galleries, setGalleries] = useState<LegacyLibraryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryTitle, setGalleryTitle] = useState("");
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [savingGallery, setSavingGallery] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  async function refreshCollection() {
    const records = await legacyItemRepository.getAll();
    setGalleries(records.filter(isGalleryRecord));
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    legacyItemRepository.getAll().then((records) => {
      if (!active) return;
      setGalleries(records.filter(isGalleryRecord));
      setLoading(false);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "Unable to load your collection.");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  function openReaderMenu() {
    try {
      frameRef.current?.contentWindow?.document.getElementById("menuBtn")?.click();
    } catch {
      setError("The reader menu is not available yet. Wait for the library to finish loading.");
    }
  }

  async function createGallery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = galleryTitle.trim();
    if (!title) return;
    setSavingGallery(true);
    setError("");
    try {
      const images = await Promise.all(galleryFiles.map(async (file) => ({
        id: globalThis.crypto?.randomUUID?.() ?? `image-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        data: await toDataUrl(file),
        caption: file.name,
      })));
      const gallery: GalleryRecord = {
        id: globalThis.crypto?.randomUUID?.() ?? `gallery-${Date.now()}`,
        kind: "gallery",
        title,
        images,
        cover: images[0]?.data ?? "",
        updated: Date.now(),
      };
      await legacyItemRepository.save(gallery);
      await refreshCollection();
      setGalleryOpen(false);
      setGalleryTitle("");
      setGalleryFiles([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create this gallery.");
    } finally {
      setSavingGallery(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#library" onClick={(event) => { event.preventDefault(); setSection("Library"); }}>
          <span className="brand-mark">q</span>
          <span>QUIET <strong>READER</strong></span>
        </a>
        <div className="topbar-note"><i /> YOUR PERSONAL READING SPACE</div>
        <button className="shell-menu-button" type="button" onClick={openReaderMenu} aria-label="Open library menu">Menu <span>⋮</span></button>
      </header>

      <div className="main-nav-wrap">
        <nav className="main-nav" aria-label="Main navigation">
          <button type="button" className={section === "Library" ? "nav-link active" : "nav-link"} aria-current={section === "Library" ? "page" : undefined} onClick={() => setSection("Library")}>
            <LibraryIcon /><span>Library</span>
          </button>
          <button type="button" className={section === "Galleries" ? "nav-link active" : "nav-link"} aria-current={section === "Galleries" ? "page" : undefined} onClick={() => setSection("Galleries")}>
            <GalleryIcon /><span>Galleries</span>
          </button>
        </nav>
      </div>

      {section === "Library" ? (
        <main className="reader-embed-wrap">
          <iframe
            ref={frameRef}
            className="reader-engine-frame"
            title="Quiet Reader library and reading workspace"
            src={`${import.meta.env.BASE_URL}reader-engine/index.html`}
            onLoad={() => setFrameReady(true)}
          />
          {!frameReady && <div className="frame-loading">Opening your library…</div>}
        </main>
      ) : (
        <main className="main-content gallery-page">
          <section className="section-heading">
            <div><span className="section-kicker">YOUR COLLECTION</span><h2>Your galleries</h2></div>
            <button className="primary-button" type="button" onClick={() => setGalleryOpen(true)}>＋ Add gallery</button>
          </section>
          {error && <p className="error-message" role="alert">{error}</p>}
          {loading ? <p className="quiet-message">Opening your collection…</p> : galleries.length ? (
            <div className="collection-grid gallery-grid">
              {galleries.map((gallery, index) => {
                const item = gallery as GalleryRecord;
                return (
                  <article className="gallery-card" key={item.id}>
                    <div className="gallery-preview">
                      {item.cover ? <img src={item.cover} alt={item.title || "Gallery"} /> : <span className="gallery-placeholder"><GalleryIcon /></span>}
                      <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <div className="card-details"><h3>{item.title || "Untitled gallery"}</h3><p>{item.images?.length ?? 0} images</p></div>
                  </article>
                );
              })}
            </div>
          ) : <div className="empty-state"><span className="empty-icon"><GalleryIcon /></span><h2>No galleries yet.</h2><p>Create a gallery to keep your visual references together.</p><button className="secondary-button" type="button" onClick={() => setGalleryOpen(true)}>＋ Add your first gallery</button></div>}
        </main>
      )}

      {galleryOpen && <div className="gallery-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setGalleryOpen(false); }}>
        <form className="gallery-modal" onSubmit={createGallery}>
          <div className="gallery-modal-heading"><div><span className="section-kicker">NEW COLLECTION</span><h2>Create a gallery</h2></div><button type="button" className="text-button" onClick={() => setGalleryOpen(false)} aria-label="Close">×</button></div>
          <label className="form-field">Gallery name<input autoFocus required value={galleryTitle} onChange={(event) => setGalleryTitle(event.target.value)} placeholder="e.g. Character references" /></label>
          <label className="form-field">Images<input type="file" accept="image/*" multiple onChange={(event) => setGalleryFiles(Array.from(event.target.files ?? []))} /></label>
          <p className="quiet-message">{galleryFiles.length ? `${galleryFiles.length} image(s) selected` : "You can create an empty gallery and add images later."}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setGalleryOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={savingGallery}>{savingGallery ? "Creating…" : "Create gallery →"}</button></div>
        </form>
      </div>}

      <footer className="app-footer"><span>QUIET READER</span><span>A personal library, kept simple.</span></footer>
    </div>
  );
}
