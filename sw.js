const CACHE_NAME = 'gestor-tareas-v1';
const CORE_ASSETS = [
  '/index.html',
  '/css/estilos.css',
  '/app.js',
  '/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/icons/')) {
    // Íconos: rara vez cambian → Cache First
    event.respondWith(cacheFirst(event.request));
  } else if (url.pathname.startsWith('/api/')) {
    // Datos de la API: deben verse al día → Network First
    event.respondWith(networkFirst(event.request));
  } else {
    // HTML, CSS, JS del shell: rápido, y se actualiza solo → Stale-While-Revalidate
    event.respondWith(staleWhileRevalidate(event.request));
  }
});

function cacheFirst(peticion) {
  return caches.match(peticion).then(enCache => {
    if (enCache) return enCache;
    return fetch(peticion).then(respuesta => {
      const clon = respuesta.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(peticion, clon));
      return respuesta;
    });
  });
}

function networkFirst(peticion) {
  return fetch(peticion)
    .then(respuesta => {
      const clon = respuesta.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(peticion, clon));
      return respuesta;
    })
    .catch(() => caches.match(peticion));
}

function staleWhileRevalidate(peticion) {
  return caches.open(CACHE_NAME).then(cache =>
    cache.match(peticion).then(enCache => {
      const actualizacion = fetch(peticion).then(respuesta => {
        cache.put(peticion, respuesta.clone());
        return respuesta;
      });
      return enCache || actualizacion;
    })
  );
}
