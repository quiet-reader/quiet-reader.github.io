const SHELL_CACHE='quiet-reader-shell-v49';
const RUNTIME_CACHE='quiet-reader-runtime-v3';
const SHELL=['./','./index.html','./css/main.css','./js/app.js','./js/reader.js','./js/translation.js','./js/image-translation.js','./js/links.js','./js/kokoro.js','./js/kokoro-worker.js','./js/state.js','./js/db.js','./js/infrastructure/persistence/item-repository.js','./js/utils.js','./js/themes.js','./js/library.js','./js/library-counts.js','./js/chapter-tools.js','./js/history.js','./js/galleries.js','./js/editor.js','./js/highlights.js','./js/backup.js','./js/epub.js','./js/pdf.js','./assets/favicon.svg'];
const RUNTIME_HOSTS=['esm.sh','cdn.jsdelivr.net'];
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('quiet-reader-')&&![SHELL_CACHE,RUNTIME_CACHE].includes(key)).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin===self.location.origin){
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
   if(response.ok){const copy=response.clone();caches.open(SHELL_CACHE).then(cache=>cache.put(request,copy));}
   return response;
  }).catch(()=>caches.match('./index.html'))));
  return;
 }
 if(RUNTIME_HOSTS.includes(url.hostname)){
  event.respondWith(caches.open(RUNTIME_CACHE).then(async cache=>{
   const cached=await cache.match(request);
   if(cached)return cached;
   try{
    const response=await fetch(request);
    if(response.ok&&response.type!=='opaque')await cache.put(request,response.clone());
    return response;
   }catch(error){
    const fallback=await cache.match(request);
    if(fallback)return fallback;
    throw error;
   }
  }));
 }
});
