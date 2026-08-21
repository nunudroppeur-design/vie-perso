const CACHE_NAME = 'vie-perso-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
];

// Installation du service worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(URLS_TO_CACHE).catch(err => {
        console.warn('Certaines ressources n\'ont pas pu être cachées:', err);
        // Continue même si quelques URLs échouent (CDN peut être bloqué)
      });
    })
  );
  self.skipWaiting();
});

// Activation du service worker
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if(cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stratégie de cache : Network First, fallback Cache
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ne pas cacher les requêtes POST
  if(request.method !== 'GET') {
    return;
  }

  // Pour les fichiers locaux et le HTML : Network First
  if(url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if(!response || response.status !== 200 || response.type === 'error') {
            return caches.match(request);
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
  }
  // Pour les CDN et scripts : Cache First avec fallback network
  else if(url.hostname.includes('cdnjs') || url.hostname.includes('jsdelivr')) {
    event.respondWith(
      caches.match(request)
        .then(response => {
          if(response) return response;
          return fetch(request).then(response => {
            if(!response || response.status !== 200) {
              return response;
            }
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseClone);
            });
            return response;
          });
        })
        .catch(() => {
          return caches.match(request);
        })
    );
  }
});

// Gestion des messages depuis l'app
self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync (optionnel - sauvegarde périodique)
self.addEventListener('sync', event => {
  if(event.tag === 'sync-data') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SYNC_REQUESTED'
          });
        });
      })
    );
  }
});
