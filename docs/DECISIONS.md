# Architecture decision records

## ADR-001: Vite + React + TypeScript

**Status:** Accepted

**Context:** Quiet Reader is a local-first browser application deployed as static files. Its expensive work (IndexedDB, EPUB/PDF parsing, image/OCR, translation, TTS and ZIP backup) runs in the browser. It does not need server rendering, server actions, API routes or a mandatory backend.

**Decision:** Use Vite for development/build, React for UI, and strict TypeScript for contracts. Keep the deployment output static and relative-path compatible with GitHub Pages.

**Consequences:** Browser APIs are direct and predictable; there is no server/client component boundary. Routing and state libraries are added only when actual feature needs justify them. Performance is validated by bundle analysis and browser profiling rather than framework assumptions.

## ADR-002: Preserve the existing IndexedDB contract

**Status:** Accepted

**Context:** Existing users have valuable data in database `quietbook-v2`, version 1, object store `items`, key path `id`.

**Decision:** Treat this as an immutable compatibility boundary during the framework migration. Preserve unknown fields and current record payloads. No automatic destructive migration or database reset.

**Consequences:** New typed models must accommodate legacy fields and unknown values; typed application DTOs must not cause lossy serialization. Any future schema migration requires separate design, fixtures, validation and recovery.
