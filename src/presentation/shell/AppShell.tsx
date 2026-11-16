import { useEffect, useState, type ReactNode } from "react";
import { createNovelService, isGalleryRecord, isNovelRecord, type NovelRecord } from "@/application/novels/novelService";
import { legacyItemRepository } from "@/infrastructure/persistence/legacyDatabase";
import { NovelWorkspace } from "@/features/novels/NovelWorkspace";

type ThemeName = "light" | "dark" | "sepia" | "midnight" | "forest" | "paper";
const themeOptions: Array<{ id: ThemeName; label: string; description: string }> = [
  { id: "light", label: "Light", description: "Clean, balanced and airy." },
  { id: "dark", label: "Dark", description: "Soft charcoal, #474747." },
  { id: "sepia", label: "Sepia", description: "Warm paper and ink." },
  { id: "midnight", label: "Midnight", description: "Deep blue-grey with soft lavender." },
  { id: "forest", label: "Forest", description: "Muted evergreen and moss." },
  { id: "paper", label: "Soft paper", description: "Cool, gentle off-white." },
];
const novelService = createNovelService(legacyItemRepository);


type IconName =
  | "menu" | "history" | "chevron" | "book" | "library" | "gallery"
  | "plus" | "sparkle" | "file" | "folder" | "file-pdf" | "bookmark"
  | "palette" | "languages" | "tag" | "download" | "clock" | "monitor"
  | "upload" | "search" | "grid" | "more" | "arrow" | "leaf";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true as const };
  const paths: Record<IconName, ReactNode> = {
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    history: <><path d="M3 12a9 9 0 1 0 2.6-6.4L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" /><path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20" /><path d="M9 7h7" /></>,
    library: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" /><path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20" /></>,
    gallery: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    sparkle: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
    folder: <><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
    "file-pdf": <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 14h2a1.5 1.5 0 0 1 0 3H8zm6 3v-3h1a1.5 1.5 0 0 1 0 3z" /></>,
    bookmark: <><path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4z" /></>,
    palette: <><path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 1.5-3.3 1.8 1.8 0 0 1 1.4-3h1.4A3.5 3.5 0 0 0 21 11.2 8.5 8.5 0 0 0 12 3Z" /><path d="M7.5 10h.01M10 7h.01M15 7.5h.01M17 11h.01" /></>,
    languages: <><path d="m5 8 6 0M8 5v3c0 4-2 7-5 9M5 12c1 2 3 3.5 5 4.5M13 19l4-10 4 10M14.5 16h5" /></>,
    tag: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 20h16" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
    upload: <><path d="M12 16V4m-5 5 5-5 5 5M4 20h16" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    grid: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    leaf: <><path d="M20 4c-8 0-14 3-14 10a6 6 0 0 0 6 6c7 0 10-6 8-16Z" /><path d="M4 21c3-5 7-8 12-11" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const navigation: { label: string; icon: IconName; group?: string }[] = [
  { label: "Library", icon: "library", group: "YOUR SPACE" },
  { label: "Paste a chapter", icon: "file" },
  { label: "Highlights & bookmarks", icon: "bookmark", group: "PERSONALIZE" },
  { label: "Appearance", icon: "palette" },
  { label: "Translation sources", icon: "languages" },
  { label: "Tag colors", icon: "tag" },
  { label: "Export backup", icon: "download", group: "DATA & DEVICES" },
  { label: "Backup history", icon: "clock" },
  { label: "Devices", icon: "monitor" },
  { label: "Import backup", icon: "upload" },
];

const tabs: Array<"Library" | "Galleries" | "Add"> = ["Library", "Galleries", "Add"];

const actions: { label: string; detail: string; icon: IconName; tone: string }[] = [
  { label: "New novel", detail: "Start a new reading project", icon: "book", tone: "action-lilac" },
  { label: "New gallery", detail: "Create a visual collection", icon: "gallery", tone: "action-peach" },
  { label: "Import EPUB", detail: "Add an EPUB book", icon: "file", tone: "action-blue" },
  { label: "Import TXT / folder", detail: "Add text files or a folder", icon: "folder", tone: "action-green" },
  { label: "Import PDF", detail: "Bring in a PDF document", icon: "file-pdf", tone: "action-amber" },
];

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"Library" | "Galleries" | "Add">("Library");
  const [activePage, setActivePage] = useState("Library");
  const [books, setBooks] = useState<NovelRecord[]>([]);
  const [galleryCount, setGalleryCount] = useState(0);
  const [selectedNovel, setSelectedNovel] = useState<NovelRecord | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<"create" | "detail" | null>(null);
  const [loadError, setLoadError] = useState("");
  const [theme, setTheme] = useState<ThemeName>(() => {
    try {
      const saved = window.localStorage.getItem("qr-theme");
      return saved && themeOptions.some((item) => item.id === saved) ? saved as ThemeName : "light";
    } catch { return "light"; }
  });

  const refreshLibrary = async () => {
    try {
      const records = await novelService.list();
      setBooks(records.filter(isNovelRecord));
      setGalleryCount(records.filter(isGalleryRecord).length);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to read the local library.");
    }
  };

  useEffect(() => { void refreshLibrary(); }, []);
  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#474747" : theme === "midnight" ? "#171a21" : theme === "forest" ? "#1f2924" : theme === "sepia" ? "#f1e6d1" : theme === "paper" ? "#f2f4f5" : "#f7f7f4");
    try { window.localStorage.setItem("qr-theme", theme); } catch { /* Theme still works for this session. */ }
  }, [theme]);

  const selectPage = (label: string) => {
    setActivePage(label);
    setMenuOpen(false);
    if (label === "Library") { setWorkspaceMode(null); setSelectedNovel(null); }
  };
  const activeIcon: IconName = navigation.find((item) => item.label === activePage)?.icon ?? "sparkle";

  function startNewNovel() {
    setActivePage("Library");
    setSelectedNovel(null);
    setWorkspaceMode("create");
    setMenuOpen(false);
  }

  function openNovel(novel: NovelRecord) {
    setActivePage("Library");
    setSelectedNovel(novel);
    setWorkspaceMode("detail");
  }

  async function handleCreated(novel: NovelRecord) {
    setSelectedNovel(novel);
    setWorkspaceMode("detail");
    await refreshLibrary();
  }

  async function handleUpdated(novel: NovelRecord) {
    setSelectedNovel(novel);
    await refreshLibrary();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-start">
          <button className="icon-button menu-trigger" type="button" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => { setMenuOpen(!menuOpen); setHistoryOpen(false); }}>
            <Icon name="menu" size={21} />
          </button>
          <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); selectPage("Library"); }}>
            <span className="brand-mark"><Icon name="leaf" size={19} /></span>
            <span>quiet<span className="brand-light">reader</span></span>
          </a>
          <span className="topbar-divider" />
          <span className="topbar-caption">A little space to get lost in a story.</span>
        </div>
        <div className="topbar-end">
          <div className="top-stat"><span className="stat-number">{books.length}</span><span>books</span></div>
          <span className="stat-separator" />
          <div className="top-stat"><span className="stat-number">{galleryCount}</span><span>galleries</span></div>
          <button className="icon-button history-trigger" type="button" aria-label="Reading history" aria-expanded={historyOpen} onClick={() => { setHistoryOpen(!historyOpen); setMenuOpen(false); }}>
            <Icon name="history" size={19} />
          </button>
        </div>
      </header>

      {menuOpen && <><button className="scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /><aside className="navigation-menu">
        <div className="menu-heading"><span>YOUR WORKSPACE</span><button className="icon-button close-menu" onClick={() => setMenuOpen(false)} aria-label="Close menu">×</button></div>
        {navigation.map((item) => <div key={item.label}>
          {item.group && <p className="menu-group">{item.group}</p>}
          <button className={`menu-item ${activePage === item.label ? "selected" : ""}`} onClick={() => selectPage(item.label)} type="button">
            <Icon name={item.icon} size={17} /><span>{item.label}</span>{item.label === "Library" && <span className="menu-count">{books.length}</span>}
          </button>
        </div>)}
        <div className="menu-footer"><span className="online-dot" /> Your library lives on this device</div>
      </aside></>}

      {historyOpen && <div className="history-popover">
        <div className="popover-title"><div><span className="popover-eyebrow">YOUR JOURNEY</span><h3>Reading history</h3></div><button className="icon-button" onClick={() => setHistoryOpen(false)} aria-label="Close history">×</button></div>
        <div className="popover-empty"><span className="empty-icon small"><Icon name="clock" size={21} /></span><strong>Your story starts here</strong><p>Reading history will appear here as you read.</p></div>
      </div>}

      <main className="main-content">
        {workspaceMode ? (
          <NovelWorkspace
            key={`${workspaceMode}-${selectedNovel?.id ?? "new"}`}
            mode={workspaceMode}
            novel={selectedNovel ?? undefined}
            service={novelService}
            onBack={() => { setWorkspaceMode(null); setSelectedNovel(null); void refreshLibrary(); }}
            onCreated={(novel) => { void handleCreated(novel); }}
            onUpdated={(novel) => { void handleUpdated(novel); }}
          />
        ) : activePage === "Library" ? <>
          <nav className="section-tabs" aria-label="Library sections">
            {tabs.map((tab) => {
              const tabIcon: IconName = tab === "Library" ? "book" : tab === "Galleries" ? "gallery" : "plus";
              return <button key={tab} className={`section-tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)} type="button"><Icon name={tabIcon} size={16} />{tab}</button>;
            })}
            <div className="tabs-spacer" />
            <span className="library-summary">{books.length} books <span>·</span> {galleryCount} galleries</span>
          </nav>

          {activeTab === "Library" && <section className="library-section">
            <div className="section-heading-row"><div><h2>Your library</h2><p className="section-subtitle">Your reading collection, kept on this device.</p></div><button className="primary-button" type="button" onClick={startNewNovel}>＋ New novel</button></div>
            {loadError && <p className="form-error" role="alert">Could not read IndexedDB: {loadError}</p>}
            <div className="action-grid">
              {actions.map((action) => <button key={action.label} type="button" className="action-card" onClick={() => action.label === "New novel" ? startNewNovel() : action.label === "New gallery" ? setActiveTab("Galleries") : undefined}>
                <span className={`action-icon ${action.tone}`}><Icon name={action.icon} size={20} /></span>
                <span className="action-copy"><strong>{action.label}</strong><small>{action.detail}</small></span>
                <span className="action-arrow"><Icon name="chevron" size={16} /></span>
              </button>)}
            </div>
            {books.length ? <div className="novel-card-grid">{books.map((book) => <button className="novel-card" type="button" key={book.id} onClick={() => openNovel(book)}>
              <span className="novel-card-cover">{book.cover ? <img src={book.cover} alt="" /> : <span>QUIET<br />READER</span>}</span>
              <span className="novel-card-info"><strong>{book.title}</strong><small>{book.author || "Unknown author"}</small><small>{book.chapters?.length ?? 0} chapters</small></span>
            </button>)}</div> : <div className="simple-empty library-zero"><span className="empty-icon"><Icon name="book" size={24} /></span><h3>Your library is quiet</h3><p>Create a novel or import a book to see it here.</p><button className="secondary-button" type="button" onClick={startNewNovel}><Icon name="plus" size={16} /> Create your first novel</button></div>}
          </section>}

          {activeTab === "Galleries" && <section className="library-section tab-placeholder"><div className="section-heading-row"><div><h2>Your galleries</h2><p className="section-subtitle">Visual collections attached to your reading projects.</p></div></div><div className="simple-empty"><span className="empty-icon"><Icon name="gallery" size={24} /></span><h3>{galleryCount ? `${galleryCount} galleries in your library` : "No galleries yet"}</h3><p>The gallery data engine is ready; gallery management UI is the next layer.</p></div></section>}

          {activeTab === "Add" && <section className="library-section tab-placeholder"><div className="section-heading-row"><div><h2>Bring a story in</h2><p className="section-subtitle">Choose how you'd like to add something to Quiet Reader.</p></div></div><div className="action-grid add-grid">{actions.map((action) => <button key={action.label} type="button" className="action-card" onClick={() => action.label === "New novel" ? startNewNovel() : action.label === "New gallery" ? setActiveTab("Galleries") : undefined}><span className={`action-icon ${action.tone}`}><Icon name={action.icon} size={20} /></span><span className="action-copy"><strong>{action.label}</strong><small>{action.detail}</small></span><span className="action-arrow"><Icon name="chevron" size={16} /></span></button>)}</div></section>}
        </> : activePage === "Appearance" ? <section className="appearance-page">
          <p className="eyebrow">MAKE IT YOURS</p><h1>Appearance</h1><p className="section-subtitle">Choose a comfortable palette for your reading space.</p>
          <div className="theme-grid">{themeOptions.map((option) => <button key={option.id} type="button" className={`theme-card ${theme === option.id ? "selected" : ""}`} onClick={() => setTheme(option.id)}>
            <span className={`theme-preview theme-preview-${option.id}`}><i /><i /><i /></span><strong>{option.label}</strong><small>{option.description}</small>{theme === option.id && <span className="theme-selected-mark">Selected</span>}
          </button>)}</div>
          <div className="font-settings"><h2>Reading font</h2><p>Gotham Pro will load automatically when its TTF files are added to <code>public/fonts/</code>. Until then, the interface uses the system fallback.</p><span className="font-sample">The quick brown fox jumps over the lazy dog.</span></div>
        </section> : <section className="placeholder-page"><span className="empty-icon"><Icon name={activeIcon} size={24} /></span><p className="eyebrow">QUIET READER WORKSPACE</p><h1>{activePage}</h1><p>This space is part of the new Quiet Reader experience. Its features will be added in a later step.</p><button className="secondary-button" onClick={() => selectPage("Library")}><Icon name="library" size={16} /> Back to library</button></section>}
        <footer className="app-footer"><span><Icon name="leaf" size={13} /> Made for slower moments.</span><span>QUIET READER <i>·</i> A PERSONAL LIBRARY</span></footer>
      </main>
    </div>
  );
}