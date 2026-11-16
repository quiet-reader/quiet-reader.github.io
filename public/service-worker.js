const SHELL_CACHE='quiet-reader-shell-v50';
const RUNTIME_CACHE='quiet-reader-runtime-v4';
const SHELL=['./','./index.html'];
const RUNTIME_HOSTS=['cdn.jsdelivr.net','cdnjs.cloudflare.com','fonts.googleapis.com','fonts.gstatic.com'];
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('quiet-reader-')&&![SHELL_CACHE,RUNTIME_CACHE].includes(key)).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request;if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin===self.location.origin){
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(RUNTIME_CACHE).then(cache=>cache.put(request,copy));}
   return response;
  }).catch(()=>caches.match('./index.html'))));return;
 }
 if(RUNTIME_HOSTS.includes(url.hostname)){
  event.respondWith(caches.open(RUNTIME_CACHE).then(async cache=>{
   const cached=await cache.match(request);if(cached)return cached;
   const response=await fetch(request);if(response.ok&&response.type!=='opaque')await cache.put(request,response.clone());return response;
  }));
 }
});
