# Offline app updates

Quiet Reader is a static Vite application hosted on GitHub Pages. The service worker is copied from `public/service-worker.js` into the deployment root.

## Behaviour

- The first successful online visit installs and caches the application shell (the built HTML entry point and its same-origin assets).
- Later service-worker versions install in the background but wait for the user to choose **Install update & reload**.
- The active app remains usable while an update waits.
- Installing an update deletes only old `quiet-reader-shell-*` caches.
- The `quiet-reader-runtime-v1` cache is retained across app-shell updates for optional downloaded runtime/model assets.
- IndexedDB and localStorage are never read, cleared, recreated, or migrated by the service worker.

## Releasing a new app-shell version

Whenever a release changes the deployed application shell, increment both:

1. `SHELL_CACHE` in `public/service-worker.js` (for example, `quiet-reader-shell-v1` → `quiet-reader-shell-v2`).
2. `APP_SHELL_VERSION` in `src/features/offline-updates/OfflineUpdates.tsx`.

Keep `RUNTIME_CACHE` unchanged unless there is a deliberate, separately reviewed reason to invalidate downloaded runtime assets. Do not delete user data or runtime/model caches as part of an ordinary UI release.

## Deployment

The `.github/workflows/pages.yml` workflow validates pull requests without deploying them. A push to `main` runs the build, tests and lint before deploying the Vite `dist/` directory to GitHub Pages.
