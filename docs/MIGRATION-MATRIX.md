# Quiet Reader V3 → React migration matrix

**Source baseline:** `quiet-reader/quiet-reader-webapp@V3-feature`  
**Pinned source commit:** `68fa6a3e50be4793ef6b8897b477a6d52f8ccd62`  
**Destination:** `quiet-reader/quiet-reader.github.io`  
**Migration branch:** `complete-v3-migration`  
**Last inventory check:** 13 November 2026

This is the working A–Z checklist. It maps the source feature surface to the destination implementation and records what still needs to be ported or tested. A file existing is not proof of behavioural parity.

## Progress estimate

<badge color="warning">Estimated implementation coverage: 28%</badge>

This is a weighted engineering estimate across the complete feature surface, not a test-pass percentage. Foundational architecture, persistence compatibility, the initial library/editor/reader paths and backup infrastructure account for most of the completed work. Several large features are absent or only represented by service-level scaffolding.

- **Implementation coverage:** approximately 28%.
- **Build/CI verification:** current branch run passed build/typecheck, unit tests, lint, Pages configuration and artifact upload.
- **Browser parity verification:** not yet established; no complete desktop/mobile regression pass has been recorded.
- **Data-safety release gate:** not passed; real-browser backup round-trip and populated-database restore still need validation.
- **Production readiness:** not ready.

Percentage method: each area has a relative weight based on feature breadth and data/behaviour complexity. The area scores below are approximate implementation coverage, not a count of files. Recalculate after meaningful feature changes and keep browser verification separate.

## Feature-by-feature checklist

Status key: **Partial** = some user-visible behaviour or service exists; **Scaffold** = supporting architecture/service exists but feature parity is missing; **Not started** = no meaningful destination implementation; **Verify** = code exists but real browser parity is unproven.

| Area | Weight | Destination mapping / current coverage | Remaining work | Status |
|---|---:|---|---|---|
| App bootstrap and shell | 6% | `src/main.tsx`, `src/app/App.tsx`, `src/presentation/shell/AppShell.tsx` | Full V3 navigation/screen structure, modal/dialog routing, responsive shell and all feature entry points | Partial |
| Library | 8% | `src/features/library/LibraryScreen.tsx`, `src/state/libraryState.ts` | Expanded/compact views, full filter/search parity, author-only search, saved-paste workflows, tag colour editor, all management actions | Partial |
| Book details and metadata | 5% | Library screen, `src/domain/book/capabilities.ts`, `src/domain/book/factory.ts` | Full tabs, gallery tab, richer metadata editing, complete lock enforcement across every mutation, book deletion/confirmation and history presentation | Partial |
| Chapter management | 6% | Library screen and existing chapter actions | Full chapter index, batch rename dialog/search/selection/order, robust bulk/folder import, clipboard preview, complete chapter-history UX | Partial |
| Chapter editor | 7% | Library screen, `src/state/editorState.ts` | Full editing toolbar/workflows, image paste/preview, batch operations, editor parity and lock regression | Partial |
| Reader navigation and layout | 7% | Library screen, `src/state/readerState.ts` | Chapter index, reading width, themes, complete reading formats, paragraph selection, reader settings and mobile parity | Partial |
| Reader search and copy | 3% | Library screen | Match V3 search scope/result navigation/highlighting and verify copy behaviour across devices | Partial |
| Bookmarks and marks | 5% | Basic bookmark persistence in reader | Highlights, paragraph selection, highlight colours/notes, search, marks manager and deletion/editing flows | Scaffold |
| Reading/edit history | 5% | Edit snapshots and progress persistence | Per-book reading/edit history, universal history search, locked clear workflow, history retention and full UI | Scaffold |
| Galleries | 8% | Virtual collections can refer to stable image IDs | Gallery create/import/folder/paste, grid/compact/slideshow, fullscreen, zoom/pan, image notes/locks, reorder/rename/bulk rename, storage size and image/gallery history | Not started |
| Translation | 5% | `src/infrastructure/translation/translationService.ts`, `src/features/translation/TranslationPanel.tsx` | Validate provider compatibility against V3, key/config UX, rate limits/long chapter chunking, restore-original integration, copy UX, translation history and image translation integration | Partial |
| Image OCR and translation | 5% | No OCR implementation | Browser OCR engine, cleanup/whitespace handling, result panel below image, translate-to-English, error handling and image viewer lifecycle | Not started |
| System TTS | 3% | No TTS implementation | Browser speech synthesis, voice/rate/pitch controls, sentence/chapter progression and stop/resume behaviour | Not started |
| Kokoro WebGPU TTS | 4% | No worker/model integration | Port Kokoro runtime, worker isolation, model loading/progress, WebGPU capability detection, fallback and memory cleanup | Not started |
| EPUB import | 3% | `src/infrastructure/importers/documentImport.ts` | Validate real-world EPUB fixtures, metadata/cover/image/spine edge cases, malformed archive handling and browser memory use | Partial / Verify |
| EPUB export | 2% | No export implementation | Export complete book/chapter structure and embedded assets into valid EPUB; round-trip tests | Not started |
| PDF import and viewing | 4% | `documentImport.ts` extracts selectable text | PDF.js viewer, page navigation/selection, layout, annotations or copy parity, scanned PDF OCR and large-file handling | Partial |
| TXT import and saved pastes | 3% | TXT import and existing backup record support | Single/multiple/folder flows, saved paste create/edit/delete/import/export UI and compatibility | Partial |
| Novel/chapter links | 3% | Chapter reorder remapping support exists | Link creation/edit/delete, lock enforcement, linked novel/chapter navigation and broken-link handling | Scaffold |
| Backup and restore | 8% | `src/infrastructure/backup/backupService.ts`, tests and library controls | ZIP round-trip in browser, populated DB restore, legacy fixtures, malformed/large archives, image bytes, unknown fields, atomic failure tests | Partial / Verify |
| IndexedDB compatibility | 5% | `src/infrastructure/persistence/legacyDatabase.ts` | Verify actual source record shapes/unknown-field preservation against populated real V3 data; exercise CRUD and failure paths in browser | Scaffold / Verify |
| Virtual collections | 2% | `src/application/collections/*`, `src/features/collections/*` | UI for chapter/image refs, invalid-reference cleanup, collections import/export and responsive parity | Partial |
| Themes and appearance | 2% | `src/styles/*` | V3 app/reader themes, theme persistence, tag colours, typography and settings parity | Scaffold |
| Offline and install lifecycle | 4% | Pages artifact workflow only | Service worker, shell/runtime cache, offline startup, update notification, cache versioning and stale-client recovery | Not started |
| Performance and resilience | 3% | React/Vite foundation and modular source layout | Lazy-load PDF/EPUB/OCR/TTS, workers, virtualized long lists, large-library/chapter tests, object URL cleanup and quota/provider error UX | Scaffold |
| Accessibility and responsive parity | 2% | Basic React UI/CSS | Keyboard/touch parity, accessible dialogs/labels/focus, screen reader semantics, no overflow at phone/tablet/desktop sizes | Verify |
| Documentation and release process | 2% | `docs/ARCHITECTURE.md`, `COMPATIBILITY.md`, `MIGRATION.md`, this matrix | Keep matrix/change log current, release gates, browser test evidence, rollback instructions | Partial |

## Data and compatibility invariants

- [x] Keep IndexedDB database name `quietbook-v2`.
- [x] Keep database version `1`, object store `items`, key path `id` in the adapter contract.
- [x] Preserve legacy JSON backup parsing for `QuietBookBackup` versions 2 and 3 in the backup service.
- [x] Use additive/upsert restore semantics in the service; unrelated records must remain.
- [ ] Browser-test against a populated database created by the original V3 app.
- [ ] Verify unknown fields survive read/edit/save.
- [ ] Verify book, chapter, image, paste IDs and relationships remain stable.
- [ ] Verify bookmarks, highlights, progress, notes, locks and reading/edit histories survive.
- [ ] Verify ZIP checksums and image asset hydration with real browser-generated archives.
- [ ] Verify failed restore leaves no partial records.
- [ ] Verify localStorage settings/collections and backup metadata compatibility.
- [ ] Test restore into a non-empty database with both matching and unrelated IDs.

## Release test checklist

### Functional smoke tests
- [ ] Create/open/edit/lock/unlock a book.
- [ ] Search, filter, sort, pin, favourite and manage tags.
- [ ] Create/edit/delete/reorder chapters; import TXT single/multiple/folder.
- [ ] Insert image and paste clipboard image with preview/confirmation.
- [ ] Reader navigation, progress restore, novel-wide search, copy and reading layout.
- [ ] Bookmark, highlight, note, search marks and manage marks.
- [ ] Reading/editing/universal history including lock/clear behaviour.
- [ ] Gallery create/import/paste/view/zoom/slideshow/notes/locks/reorder/history.
- [ ] Whole-chapter translation and image OCR/translation.
- [ ] System TTS and Kokoro worker failure isolation.
- [ ] EPUB import/export and PDF viewing/import.
- [ ] Novel/chapter links and navigation.
- [ ] ZIP backup export/restore, legacy JSON import and additive restore.
- [ ] Appearance, themes, tag colours and reader preferences.

### Desktop/mobile and offline
- [ ] Desktop browser smoke test.
- [ ] Mobile browser smoke test at narrow viewport.
- [ ] Touch and keyboard operation; dialogs/focus/accessibility.
- [ ] Offline startup and data access.
- [ ] Service-worker update and stale-cache recovery.
- [ ] Large library, long chapter, large EPUB/PDF/image and storage quota tests.

## Deployment and branch policy

- `main` remains the production branch.
- `complete-v3-migration` is the test branch.
- GitHub Pages in this repository serves one site. Deploying the test branch updates that same Pages URL; it is not an isolated per-branch preview.
- The original `quiet-reader-webapp` repository is separate and is not changed by this deployment.
- Keep PR #3 draft until all release gates pass. Do not merge into `main` just because CI passes.

## Update log

- 13 Nov 2026: inventory reconciled against source V3 tree and destination branch tree. Translation service/panel added. Latest recorded PR CI passed build, unit tests, lint and Pages artifact upload; deployment had been skipped by branch condition. No complete browser regression or backup restore evidence yet.
