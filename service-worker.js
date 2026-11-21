const SHELL_CACHE = 'quiet-reader-shell-v84';
const RUNTIME_CACHE = 'quiet-reader-runtime-v4';
const SHELL = [
  './', './index.html', './version.json', './css/main.css', './js/app.js', './js/image-tools.js', './js/image-preview.js', './js/image-batch-tools.js', './js/reader.js',
  './js/translation.js', './js/image-translation.js', './js/links.js',
  './js/kokoro.js', './js/kokoro-worker.js', './js/state.js', './js/db.js',
  './js/infrastructure/persistence/item-repository.js', './js/utils.js',
  './js/themes.js', './js/library.js', './js/library-counts.js',
  './js/chapter-tools.js', './js/history.js', './js/galleries.js',
  './js/editor.js', './js/highlights.js', './js/backup.js', './js/epub.js',
  './js/pdf.js', './assets/favicon.svg'
];
const RUNTIME_HOSTS = new Set([
  'esm.sh', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com',
  'fonts.googleapis.com', 'fonts.gstatic.com'
]);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL);
    // First install takes control. Upgrades wait for explicit user approval.
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('quiet-reader-shell-') && key !== SHELL_CACHE)
      .map(key => caches.delete(key)));
    // Runtime caches may contain downloaded speech/model assets. Preserve them.
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const shell = await caches.open(SHELL_CACHE);
      const cached = await shell.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await shell.put(request, response.clone());
        return response;
      } catch {
        if (request.mode === 'navigate') {
          const fallback = await shell.match('./index.html');
          if (fallback) return fallback;
        }
        throw new Error('This resource is not available offline yet.');
      }
    })());
    return;
  }

  if (RUNTIME_HOSTS.has(url.hostname)) {
    event.respondWith((async () => {
      const runtime = await caches.open(RUNTIME_CACHE);
      const cached = await runtime.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque') {
        await runtime.put(request, response.clone());
      }
      return response;
    })());
  }
});
