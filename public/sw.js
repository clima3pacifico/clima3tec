// Service worker: la app del técnico abre sin conexión (las llamadas /api/ las maneja offline.js con IndexedDB)
const C='c3tec-v5',A=['/','/index.html','/tecnico.html','/admin.html','/bolsa.html','/estilos.css','/comun.js','/offline.js','/icono.svg','/logo_clima3.svg','/logo_carrier.png','/manifest.json'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(A)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.pathname.startsWith('/api/'))return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok&&u.origin===location.origin){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})))});
