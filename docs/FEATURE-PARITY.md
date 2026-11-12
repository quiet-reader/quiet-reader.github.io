# Feature parity tracking

Source inventory: [quiet-reader-webapp V2-feature](https://github.com/quiet-reader/quiet-reader-webapp/tree/V2-feature/guide).

This is a migration tracker, not a claim of implementation. Mark a feature complete only after functional tests and desktop/mobile browser checks pass.

| Area | Required behaviour | Status |
|---|---|---|
| Application shell | Offline-capable local-first app; navigation and responsive desktop/mobile shells | Not migrated |
| Library | Grid, expanded/compact views, filters, sort, tag colors, search across titles/authors/chapters/text | Not migrated |
| Book details | Metadata, rating, tags, cover, lock/unlock, notes, history, gallery tab, EPUB export | Not migrated |
| Chapter editor | Create/edit/delete, image insertion, clipboard preview, TXT single/bulk/folder import, batch rename | Not migrated |
| Reader | Chapter navigation/index, progress, search, reading format, copy, themes, width and text size | Not migrated |
| Marks | Bookmarks, text/paragraph highlights, colors, notes, search and management | Not migrated |
| History | Per-book reading/edit history and searchable universal history with lock/clear workflow | Not migrated |
| Galleries | Import/paste/folder, grid/compact/slideshow, fullscreen viewer, zoom/pan, notes, locks, reorder, rename, history | Not migrated |
| Translation | Provider configuration, whole-chapter translation, restore original, copy translation | Not migrated |
| Image OCR | Local browser OCR, whitespace cleanup, translation, expandable result below image | Not migrated |
| TTS | System speech and optional Kokoro WebGPU worker; failure isolation | Not migrated |
| EPUB/PDF | Import/export and preservation of extracted content | Not migrated |
| Backup | ZIP export, SHA-256 verification, assets, legacy JSON v2/v3, additive transactional restore | Not migrated |
| Links | Novel-to-novel and chapter-to-chapter relationships and navigation | Not migrated |
| Offline | Static hosting and service-worker cache/update behaviour | Not migrated |

## Release blocker

Do not direct users to migrate their only copy of a library until a representative real backup has been restored in a clean browser profile and all data counts, IDs, relationships, images, progress, marks, notes, locks and history have been checked.
