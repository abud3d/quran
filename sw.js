const SHELL_CACHE='quran-shell-v5';
const SHELL=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL_CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>![SHELL_CACHE,'quran-data-v2'].includes(k)).map(k=>caches.delete(k)));await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET')return;
 if(url.origin===self.location.origin){
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{const copy=response.clone();caches.open(SHELL_CACHE).then(c=>c.put(event.request,copy));return response}).catch(()=>caches.match('./index.html'))));
 }
});
