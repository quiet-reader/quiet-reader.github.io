import { useEffect, useState } from "react";
import { isGalleryRecord, isNovelRecord, type NovelRecord } from "@/application/novels/novelService";
import { legacyItemRepository, type LegacyLibraryRecord } from "@/infrastructure/persistence/legacyDatabase";

type Section = "Library" | "Galleries";

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
      setError(reason instanceof Error ? reason.message : "Unable to load your library.");
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="site">
      <header className="site-header">
        <a className="wordmark" href="#library" onClick={(event) => { event.preventDefault(); setSection("Library"); }}>
          <span className="wordmark-icon">q.</span>
          <span>quiet reader</span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          {(["Library", "Galleries"] as const).map((item) => (
            <button key={item} type="button" className={section === item ? "nav-link active" : "nav-link"} onClick={() => setSection(item)}>
              {item}
            </button>
          ))}
        </nav>
      </header>

      <main className="page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR COLLECTION</p>
            <h1>{section}</h1>
          </div>
          <span className="item-count">{section === "Library" ? books.length : galleries.length} {section === "Library" ? "books" : "galleries"}</span>
        </div>

        {error && <p className="error-message" role="alert">{error}</p>}
        {loading ? <p className="quiet-message">Loading your collection…</p> : section === "Library" ? (
          books.length ? (
            <div className="collection-grid">
              {books.map((book) => (
                <article className="book-card" key={book.id}>
                  <div className="book-cover">
                    {book.cover ? <img src={book.cover} alt={book.title} /> : <span className="cover-placeholder">quiet<br />reader</span>}
                  </div>
                  <div className="card-details">
                    <h2>{book.title}</h2>
                    <p>{book.author || "Unknown author"}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="empty-state"><h2>Your library is empty</h2><p>Books you add will appear here.</p></div>
        ) : (
          galleries.length ? (
            <div className="collection-grid gallery-grid">
              {galleries.map((gallery) => {
                const item = gallery as LegacyLibraryRecord & { title?: string; cover?: string; images?: unknown[] };
                return (
                  <article className="gallery-card" key={item.id}>
                    <div className="gallery-preview">
                      {item.cover ? <img src={item.cover} alt={item.title || "Gallery"} /> : <span>Gallery</span>}
                    </div>
                    <div className="card-details">
                      <h2>{item.title || "Untitled gallery"}</h2>
                      <p>{item.images?.length ?? 0} images</p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <div className="empty-state"><h2>No galleries yet</h2><p>Your image collections will appear here.</p></div>
        )}
      </main>

      <footer className="site-footer"><span>quiet reader</span><span>A personal library</span></footer>
    </div>
  );
}
