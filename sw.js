const CACHE='r-calculus-v1'; const FILES=['./','index.html','css/app.css','css/background.css','css/calculator.css','js/app.js','js/calculator.js','js/storage.js','js/settings.js','js/pdf-export.js','data/pricing.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request))));
