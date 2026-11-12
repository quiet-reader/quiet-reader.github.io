# V3 source feature additions

## Source baseline

- Repository: `quiet-reader/quiet-reader-webapp`
- Branch: `V3-feature`
- Pinned commit: `68fa6a3e50be4793ef6b8897b477a6d52f8ccd62`
- V3 is 27 commits ahead of the V2 source baseline used for the initial migration.

## Capabilities introduced/refined in V3

1. **Library organization:** pin and favorite flags on existing book records; virtual named collections can reference books, chapters and gallery images without duplicating their content. Collection membership is stored in localStorage under `qrCollections`; child references use stable chapter/image IDs.
2. **Shared edit policy:** one capability catalogue governs locked-book editing operations. Unknown operations fail closed. Reading, progress, bookmarks, highlights, history and export remain available while a book is locked.
3. **State ownership:** library, reader, editor and navigation state are separated into feature-owned slices; the old aggregate state remains a compatibility seam.
4. **Persistence boundary:** a generic lossless item repository exposes getAll/get/save/delete/saveMany over the existing IndexedDB store. Batch writes use one read/write transaction.
5. **Feature APIs:** explicit narrow facades under `js/features/*/index.js` define cross-feature entry points and reduce direct imports.
6. **Domain and presentation seams:** fresh-book construction and screen navigation are moved out of the old aggregate state module.
7. **Backup provenance:** optional archive fingerprint, device/application/platform/session/installation metadata, bounded backup history and virtual collection references. Legacy ZIPs without optional metadata and legacy JSON v2/v3 remain supported.

## Port status

The following V3 foundations have been ported into TypeScript in this repository:

- capability policy and fail-closed behaviour;
- fresh-book factory;
- collection contracts and application service (stable book/chapter/image references);
- pin/favorite persistence operations;
- feature-owned state slices;
- typed lossless IndexedDB repository contract;
- optional backup provenance/collection metadata contracts.

The following are not yet migrated:

- complete React collection picker/list UI and library pin/favorite controls;
- full reader/library/editor feature APIs and interactions;
- V3 backup ZIP exporter/importer, fingerprint computation, history UI and provenance round-trip;
- full enforcement audit across every edit/delete/reorder UI and operation;
- service-worker/offline cache parity and desktop/mobile browser verification.

No V3 change modifies the existing IndexedDB name/version/store/key path or persisted book schema. Pin/favorite fields are written to their existing book records; collections remain localStorage metadata and are optional in backups.
