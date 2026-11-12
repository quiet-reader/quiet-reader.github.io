# Quiet Reader — Vite + React + TypeScript

A local-first migration of the existing Quiet Reader browser application.

**Status: architecture and application shell only. This is not a complete reader yet.** Do not use this branch as the only copy of your library. The existing app remains the source of truth until the new implementation passes feature-parity and backup-restore tests.

## Source baseline

- Source repository: [quiet-reader-webapp](https://github.com/quiet-reader/quiet-reader-webapp)
- Source branch: `V2-feature`
- Pinned source commit: `755bdd2f345c5ad5da2aaab0e8dbb940da70a691`
- Architecture and data contracts: source `guide/ARCHITECTURE.md`, `guide/DATA-COMPATIBILITY.md`, `guide/FEATURE-INVENTORY.md`, `guide/FEATURE-CHECKLIST.md`.

## Stack

- Vite + React + strict TypeScript.
- Static client-side build for GitHub Pages; no required server or account.
- Existing IndexedDB compatibility adapter; no schema migration on startup.
- CSS variables and feature-scoped styles; no heavy component framework.
- Vitest for unit tests; Playwright browser tests will be added for end-to-end parity.

## Local development

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/MIGRATION.md](docs/MIGRATION.md), and [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).

## Non-negotiable release gates

1. Preserve all fields and IDs in existing `quietbook-v2` records.
2. Keep ZIP backup restore and legacy `QuietBookBackup` JSON v2/v3 import compatible.
3. Restore additively/upserting by ID; never erase unrelated local records.
4. Match existing desktop and mobile behaviour before redesigning.
5. Keep OCR, translation, EPUB/PDF processing, and TTS optional and isolated.
6. Do not claim runtime parity until tested in real browsers with a representative backup.
