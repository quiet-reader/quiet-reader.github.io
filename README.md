# Quiet Reader — new experience

A local-first reading workspace built with React, TypeScript and Vite.

## Current milestone

The redesigned application shell and visual navigation are in place. This milestone is intentionally a UI foundation: buttons, tabs, menus and page placeholders establish the product structure without implementing book, import, persistence or reading workflows.

## Architecture principles

- Feature-oriented modularity with explicit public entry points.
- Dependency direction: Presentation → Application → Domain; Infrastructure implements application/domain ports.
- IndexedDB access stays behind a dedicated persistence boundary.
- Legacy data compatibility is isolated from UI components.
- No destructive database migration or automatic data reset.
- Expensive capabilities (EPUB/PDF parsing, OCR, translation and TTS) will be lazy-loaded and isolated.
- Keep transient interface state separate from persisted library data.
- Keep browser-only capabilities behind adapters and validate imported data at boundaries.

## Stack

- React 19
- TypeScript 5.9
- Vite 7
- Existing IndexedDB compatibility adapter (not wired into this UI milestone)
- Vitest

## Local development

Requires Node.js 20.19+ or 22.12+.

```sh
npm install --legacy-peer-deps
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

## Data safety

The existing `quietbook-v2` database is not opened, modified, upgraded or deleted by this UI-only milestone. The legacy compatibility adapter and data-contract documentation remain in the repository for subsequent implementation.
