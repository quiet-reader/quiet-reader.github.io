# Migration plan

## Source baseline
- Repo: `quiet-reader/quiet-reader-webapp`
- Branch: `V2-feature`
- Commit: `755bdd2f345c5ad5da2aaab0e8dbb940da70a691`
- Static HTML/CSS/ES modules; local-first IndexedDB; no app server.

## Target layout
```
app/                  # Next routes and providers
src/domain/           # framework-independent entities and invariants
src/application/      # use cases and ports
src/infrastructure/   # IndexedDB, files, workers, provider adapters
src/features/         # isolated feature modules with public entry points
src/presentation/     # shared, desktop and mobile UI
src/test/             # fixtures and test utilities
public/               # fonts, icons, worker/model assets
docs/                 # architecture, compatibility and parity records
```

## Phases
1. Foundation: strict TypeScript, static export, lint/typecheck/test and compatibility contract.
2. Characterization: fixture and regression tests for database records, JSON and ZIP backups, and feature flows.
3. Persistence seam: typed repositories over the existing store; no schema upgrade.
4. Domain/application extraction: books, chapters, progress, bookmarks, highlights, notes, links and settings.
5. Feature adapters: editor, EPUB/PDF, galleries, history, import/export, OCR/image translation, whole-chapter translation, system TTS and optional Kokoro WebGPU.
6. Responsive desktop/mobile presentation parity.
7. Release only after backup restore round-trips and complete browser regression checks pass.

Each phase must leave the branch buildable. Do not combine a full data migration, visual redesign and broad feature rewrite into one change. Record actual test outcomes; compilation is not browser testing.
