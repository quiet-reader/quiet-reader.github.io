# Migration plan

## Source of truth

Repository `quiet-reader/quiet-reader-webapp`, branch `V2-feature`, commit `755bdd2f345c5ad5da2aaab0e8dbb940da70a691`.

Before moving each feature, inspect its source and all imports, UI selectors, persisted fields, browser APIs, backup paths, and service-worker dependencies. The source guides and checklist are the authoritative inventory. This port must not assume an old module map is complete.

## Staged migration

1. **Foundation (current):** Vite + React + strict TypeScript, static deployment, compatibility boundary and engineering documentation.
2. **Characterization:** create synthetic fixtures and regression tests for current IndexedDB records, localStorage keys, backup formats and feature behaviour.
3. **Persistence seam:** preserve the legacy DB and record payloads; introduce typed repository ports/adapters with lossless unknown-field round-tripping.
4. **Core library:** library, book details, tags, search/sort/filter, paste records, chapter/editor and reader navigation.
5. **Reader capabilities:** progress, chapter search, format controls, bookmarks, highlights, notes, history and links.
6. **Media:** gallery, image insertion/paste, EPUB, PDF, TXT, previews and export.
7. **Optional engines:** translation providers, browser OCR, system TTS and optional Kokoro worker/WebGPU.
8. **Backup parity:** ZIP manifest/checksum validation, assets, JSON v2/v3, additive transactional restore.
9. **Presentation parity:** desktop and mobile shells; compare screenshots and interaction flows against the source.
10. **Release hardening:** offline cache, accessibility, performance profiling, browser regression and real backup round-trip.

Each phase must leave the app buildable. Keep the old app operational throughout. Do not combine data migration, broad visual redesign and feature rewrites into one change.

## Completion standard

A feature is complete only when it has a public feature API, tests for its business rules, persistence compatibility checks where applicable, and desktop/mobile interaction verification. Build success alone is not parity. Record what was actually run and what remains untested.
