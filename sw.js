const CACHE='r-kalkyle-v2.0.23';
const FILES=['./','index.html','manifest.webmanifest','css/app.css','css/background.css','css/calculator.css','css/calculation-form.css','css/multi-calculation.css','css/calculation-mail.css','css/admin-log.css','css/safe-area.css','css/choice-animation.css','css/navigation.css','css/product-search.css','css/catalog-press.css','css/catalog-browser.css','css/iphone-layout.css','css/skisse-footer.css','css/skisse-start-lock.css','css/home-layout.css','js/app.js','js/cloud-data.js','js/cloud-product-add.js','js/calculation-form.js','js/compat.js','js/catalog-ui.js','js/transition-refinement.js','js/catalog-structure.js','js/catalog-safety.js','js/catalog-navigation.js','js/catalog-browser.js','js/roll-material.js','js/multi-calculation.js','js/calculation-pdf.js','js/calculation-mail.js','js/admin-log.js','js/edge-swipe.js','js/push-notifications.js','js/calculator.js','js/storage.js','js/start-geometry.js','data/app.json','assets/brand/rumag-r-hvit.svg','assets/brand/rumag-logo-hvit.svg','assets/brand/rumag-logo-sort.svg','assets/icons/app-icon-r-kalkyle.svg','assets/icons/app-icon-r-kalkyle-192.png','assets/icons/app-icon-r-kalkyle-512.png','assets/icons/apple-touch-icon-r-kalkyle.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(fetch(event.request).then(response=>response).catch(()=>caches.match(event.request)));});
self.addEventListener('push', event => {
  const data = event.data?.json?.() || {};
  event.waitUntil(self.registration.showNotification(data.title || 'R Kalkyle', {
    body: data.body || 'Det er gjort en endring i R Kalkyle.',
    icon: 'assets/icons/app-icon-r-kalkyle-192.png',
    badge: 'assets/icons/app-icon-r-kalkyle-192.png',
    tag: data.tag || 'r-kalkyle',
    renotify: true,
    data: { url: data.url || '/' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(openClients => {
    const existing = openClients[0];
    return existing ? existing.focus() : clients.openWindow(event.notification.data?.url || '/');
  }));
});
