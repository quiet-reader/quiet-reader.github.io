# Quiet Reader — Next.js / TypeScript

Migration target for [quiet-reader-webapp](https://github.com/quiet-reader/quiet-reader-webapp), pinned to source branch `V2-feature` at `755bdd2f345c5ad5da2aaab0e8dbb940da70a691`.

**Foundation only; not feature-complete and not safe as your only reader yet.** The existing app remains the source of truth until parity and restore tests pass.

## Architecture
- Strict TypeScript; modular monolith with one-way dependencies: presentation → application → domain; infrastructure implements ports.
- Static export for GitHub Pages; no mandatory backend/account/cloud database.
- Preserve IndexedDB `quietbook-v2` (version 1, store `items`, key path `id`) without automatic schema upgrades.
- Preserve legacy JSON backups (QuietBookBackup v2/v3) and ZIP archives with manifest, per-record JSON, assets and SHA-256 integrity checks.
- Never mark a feature migrated until behavior, desktop/mobile UI, and backup round-trip tests pass.

## Commands
`npm ci`, `npm run dev`, `npm run typecheck`, `npm run lint`, `npm run build`.

See `docs/MIGRATION.md` and `docs/COMPATIBILITY.md` for the migration gates.
