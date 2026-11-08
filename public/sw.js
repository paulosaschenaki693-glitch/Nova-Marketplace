const CACHE='nova-shell-v4';
const STATIC=['/offline.html','/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request; const url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin)return;
 // Never cache authenticated, API, Next.js build, or route HTML responses.
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/_next/')||url.pathname.startsWith('/admin')||url.pathname.startsWith('/profile')||url.pathname.startsWith('/checkout'))return;
 if(req.mode==='navigate'){event.respondWith(fetch(req).catch(()=>caches.match('/offline.html')));return;}
 if(STATIC.includes(url.pathname)) event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});
