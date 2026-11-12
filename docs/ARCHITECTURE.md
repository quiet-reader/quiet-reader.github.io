# Quiet Reader architecture

## Product shape

Quiet Reader is a local-first browser application, not a server-rendered content site. The deployment target is static hosting (GitHub Pages). Vite builds a browser application; React owns presentation; TypeScript enforces contracts. There is no mandatory API server, account, cloud database, microservice, or micro-frontend.

## Dependency direction

`Presentation → Application → Domain`

`Infrastructure → Application/Domain contracts`

- **Domain:** stable entities, identifiers, invariants and format-independent rules. No React, DOM, IndexedDB or provider imports.
- **Application:** use cases, orchestration and ports. No component or browser-storage details.
- **Infrastructure:** IndexedDB, localStorage, files, workers, service worker, ZIP and provider adapters.
- **Features:** cohesive vertical capabilities with explicit public entry points; private implementation stays inside each feature.
- **Presentation:** desktop/mobile shells, shared controls, dialogs, responsive interactions and accessibility.
- **App composition:** bootstrap and dependency wiring only; never another all-knowing controller.

## Suggested structure

```
src/
  app/                    # bootstrap, composition, route/screen registry
  domain/                 # framework-independent entities and invariants
  application/             # use cases and ports
  infrastructure/
    persistence/           # legacy IndexedDB and future repositories
    files/                 # import/export and file adapters
    workers/               # CPU-intensive work
    providers/             # translation, OCR, speech adapters
  features/
    library/
    reader/
    editor/
    epub/
    pdf/
    galleries/
    history/
    highlights/
    bookmarks/
    translation/
    image-translation/
    tts/
    links/
    backup/
    appearance/
  presentation/
    desktop/
    mobile/
    shared/
    shell/
  styles/
  test/
```

The tree is a target, not permission to create empty abstractions. Add modules when a real feature is migrated and its responsibilities are known.

## Performance rules

- Keep initial app shell small; dynamically import expensive/rarely used features.
- Never load OCR/TTS models or PDF/EPUB engines merely to open the library.
- Use Web Workers for CPU-heavy processing and keep message contracts typed.
- Virtualize only where measured collection sizes justify it.
- Avoid duplicating large chapter strings, blobs and data URLs in component state.
- Revoke object URLs and release worker/WebGPU resources when no longer used.
- Keep transient UI state separate from persisted domain records.
- Prevent a feature failure (Kokoro, OCR, provider) from preventing normal reading.
- Measure before adding memoization, state libraries, caching layers or abstractions.

## React rules

- Components render UI and emit user intent; business rules live in use cases/domain.
- Persisted state is accessed through application services/repositories.
- Do not put the entire library or chapter content in one global React context.
- Keep state close to the feature that owns it; use subscriptions/selectors for cross-feature state.
- Use dynamic imports at feature boundaries.
- Do not adopt a component framework until a concrete accessibility/design-system need is established.

## Compatibility

The deployed source baseline is pinned in README. Preserve the existing database name/version/store/key path and unknown record fields. See [COMPATIBILITY.md](COMPATIBILITY.md). No startup migration, database reset, data normalization, or destructive restore is permitted.
