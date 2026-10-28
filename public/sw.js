const C='c3tec-v3',A=['/','/index.html','/tecnico.html','/estilos.css','/comun.js','/icono.svg','/logo_clima3.svg','/manifest.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A))));
self.addEventListener('fetch',e=>{if(e.request.url.includes('/api/'))return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});
