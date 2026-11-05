// Notificaciones push con la app cerrada (Firebase Cloud Messaging).
// Va al inicio para que Firebase registre sus eventos primero.
try {
  importScripts('./firebase-config.js');
  if (self.FIREBASE_CONFIG && self.FIREBASE_VAPID_KEY) {
    importScripts(
      'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js'
    );
    firebase.initializeApp(self.FIREBASE_CONFIG);
    firebase.messaging(); // muestra sola la notificación cuando la app está cerrada
  }
} catch (e) { /* sin push: la app sigue funcionando */ }

const CACHE = 'mariscal-shop-v5';
const FILES = ['./', './index.html', './styles.css', './app.js', './products.js', './backend.js', './firebase-config.js', './manifest.webmanifest', './assets/icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Al tocar una notificación, abrir (o enfocar) la app en "Mis pedidos"
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './#/pedidos';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { c.navigate(url); return c.focus(); } }
    return clients.openWindow(url);
  }));
});
