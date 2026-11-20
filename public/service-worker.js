const SHELL_CACHE = 'quiet-reader-shell-v1';
const RUNTIME_CACHE = 'quiet-reader-runtime-v1';
const RUNTIME_HOSTS = new Set([
  'esm.sh',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'huggingface.co',
  'cdn-lfs.huggingface.co',
  'cas-bridge.xethub.hf.co'
]);

async function precacheApplicationShell() {
  const shell = await caches.open(SHELL_CACHE);
  const rootUrl = new URL('./', self.registration.scope);
  const indexUrl = new URL('./index.html', self.registration.scope);
  const response = await fetch(indexUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not download the application shell.');
  const html = await response.clone().text();
  await shell.put(indexUrl, response);

  const assets = new Set([rootUrl.href, indexUrl.href]);
  for (const match of html.matchAll(/(?:src|href)=["']([^"'#]+)["']/g)) {
    try {
      const assetUrl = new URL(match[1], self.registration.scope);
      if (assetUrl.origin === self.location.origin) assets.add(assetUrl.href);
    } catch {
      // Ignore malformed or non-URL references.
    }
  }

  await Promise.all([...assets].map(async assetUrl => {
    if (assetUrl === indexUrl.href) return;
    try {
      const assetResponse = await fetch(assetUrl, { cache: 'no-store' });
      if (assetResponse.ok) await shell.put(assetUrl, assetResponse);
    } catch {
      // The index remains cached; a later online visit can fill optional assets.
    }
  }));
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await precacheApplicationShell();
    // The first install takes control automatically. Later versions wait for
    // the user to press "Install update" in the app.
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
    // Keep runtime assets (including downloaded speech/model assets) between
    // app-shell releases. Never touch IndexedDB or localStorage here.
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith((async () => {
        const shell = await caches.open(SHELL_CACHE);
        const indexUrl = new URL('./index.html', self.registration.scope);
        try {
          const response = await fetch(request);
          if (response.ok) await shell.put(indexUrl, response.clone());
          return response;
        } catch {
          return (await shell.match(indexUrl)) || new Response(
            'Quiet Reader is not cached on this device yet. Connect once and reload.',
            { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
          );
        }
      })());
      return;
    }

    event.respondWith((async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const shell = await caches.open(SHELL_CACHE);
        await shell.put(request, response.clone());
      }
      return response;
    })());
    return;
  }

  if (RUNTIME_HOSTS.has(url.hostname)) {
    event.respondWith((async () => {
      const runtime = await caches.open(RUNTIME_CACHE);
      const cached = await runtime.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && response.type !== 'opaque') await runtime.put(request, response.clone());
      return response;
    })());
  }
});
