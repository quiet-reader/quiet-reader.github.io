import { useEffect, useState } from "react";
import { isGalleryRecord, isNovelRecord, type NovelRecord } from "@/application/novels/novelService";
import { legacyItemRepository, type LegacyLibraryRecord } from "@/infrastructure/persistence/legacyDatabase";

type Section = "Library" | "Galleries";

function LibraryIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" /><path d="M4 6h13M8 7v8" /></svg>;
}
function GalleryIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 5-5 3 3 3-4 5 6" /></svg>;
}

export function AppShell() {
  const [section, setSection] = useState<Section>("Library");
  const [books, setBooks] = useState<NovelRecord[]>([]);
  const [galleries, setGalleries] = useState<LegacyLibraryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    legacyItemRepository.getAll().then((records) => {
      if (!active) return;
      setBooks(records.filter(isNovelRecord));
      setGalleries(records.filter(isGalleryRecord));
      setLoading(false);
    }).catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "Unable to load your collection.");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const count = section === "Library" ? books.length : galleries.length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#library" onClick={(event) => { event.preventDefault(); setSection("Library"); }}>
          <span className="brand-mark">q</span>
          <span>QUIET <strong>READER</strong></span>
        </a>
        <div className="topbar-note"><i /> YOUR PERSONAL READING SPACE</div>
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

      <main className="main-content">
        <section className="welcome-block">
          <div className="eyebrow"><i /> QUIET READER</div>
          <h1>{section === "Library" ? <>A little space for <span>every story.</span></> : <>Your images, <span>beautifully gathered.</span></>}</h1>
          <p className="welcome-copy">{section === "Library" ? "Keep your books together and return to the worlds you love." : "A calm home for the images and collections you want to keep."}</p>
        </section>

        <section className="section-heading">
          <div>
            <span className="section-kicker">YOUR COLLECTION</span>
            <h2>{section === "Library" ? "Your library" : "Your galleries"}</h2>
          </div>
          <span className="section-count">{String(count).padStart(2, "0")} {section === "Library" ? "BOOKS" : "GALLERIES"}</span>
        </section>

        {error && <p className="error-message" role="alert">{error}</p>}
        {loading ? <p className="quiet-message">Opening your collection…</p> : section === "Library" ? (
          books.length ? (
            <div className="collection-grid">
              {books.map((book, index) => (
                <article className="book-card" key={book.id}>
                  <div className="book-cover">
                    {book.cover ? <img src={book.cover} alt={book.title} /> : <span className="cover-placeholder"><span>q.</span><small>QUIET READER</small></span>}
                    <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="card-details">
                    <h3>{book.title}</h3>
                    <p>{book.author || "Unknown author"}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="empty-state"><span className="empty-icon"><LibraryIcon /></span><h2>Your library is waiting.</h2><p>Books you add will find their place here.</p></div>
        ) : (
          galleries.length ? (
            <div className="collection-grid gallery-grid">
              {galleries.map((gallery, index) => {
                const item = gallery as LegacyLibraryRecord & { title?: string; cover?: string; images?: unknown[] };
                return (
                  <article className="gallery-card" key={item.id}>
                    <div className="gallery-preview">
                      {item.cover ? <img src={item.cover} alt={item.title || "Gallery"} /> : <span className="gallery-placeholder"><GalleryIcon /></span>}
                      <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <div className="card-details">
                      <h3>{item.title || "Untitled gallery"}</h3>
                      <p>{item.images?.length ?? 0} images</p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <div className="empty-state"><span className="empty-icon"><GalleryIcon /></span><h2>No galleries yet.</h2><p>Your image collections will appear here.</p></div>
        )}
      </main>

      <footer className="app-footer"><span>QUIET READER</span><span>A personal library, kept simple.</span></footer>
    </div>
  );
}
