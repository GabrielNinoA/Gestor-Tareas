// sw-propio.js — Código fuente del Service Worker con InjectManifest (Sesión 26).
// Contiene precaché de Workbox, rutas de runtime, push, clic en notificación y Background Sync.

// Workbox cargado desde archivos LOCALES (carpeta lib/), no desde un CDN:
// así el SW arranca igual sin conexión.
importScripts("lib/workbox-v7.4.1/workbox-sw.js");
workbox.setConfig({ modulePathPrefix: "lib/workbox-v7.4.1/", debug: false });

// IMPORTANTE: leer TODOS los módulos aquí, en el nivel superior. Cada acceso
// (workbox.precaching, workbox.routing…) dispara un importScripts, y
// importScripts solo se permite mientras el SW se está instalando/evaluando.
const { precacheAndRoute, cleanupOutdatedCaches } = workbox.precaching;
const { registerRoute } = workbox.routing;
const { CacheFirst, NetworkFirst } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;

self.skipWaiting();
workbox.core.clientsClaim();
cleanupOutdatedCaches();

// Aquí Workbox inyecta la lista de precaché con hashes de versión
precacheAndRoute(self.__WB_MANIFEST);

// Rutas de almacenamiento en caché en tiempo de ejecución
registerRoute(
  ({ url }) => url.pathname.startsWith("/icons/"),
  new CacheFirst({
    cacheName: "imagenes",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkFirst({
    cacheName: "api-cache",
  })
);

// ── Clic en la notificación: enfocar la app abierta, o abrirla ─────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url ?? "/index.html", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const ventanas = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
      if (abierta) {
        if ("focus" in abierta) await abierta.focus();
        if (abierta.navigate && abierta.url !== destino) await abierta.navigate(destino);
        return;
      }
      if (clients.openWindow) return clients.openWindow(destino);
    })()
  );
});

// ── Mensajes al Service Worker (SKIP_WAITING) ─────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Push: llega un mensaje del servidor aunque la app esté cerrada ─────────
self.addEventListener("push", (event) => {
  let datos = { titulo: "Gestor de Tareas", cuerpo: "Tienes novedades.", url: "/index.html" };
  try {
    if (event.data) datos = { ...datos, ...event.data.json() };
  } catch {
    if (event.data) datos.cuerpo = event.data.text(); // el mensaje no era JSON
  }

  // userVisibleOnly:true (al suscribir) OBLIGA a mostrar una notificación en
  // cada push; por eso va dentro de waitUntil, siempre.
  // Se usa renotify: true y tag único/dinámico para que Windows obligatoriamente
  // despliegue el banner flotante y emita sonido en lugar de reemplazarlo en silencio.
  const tag = datos.tag || `gestor-push-${Date.now()}`;

  event.waitUntil(
    self.registration.showNotification(datos.titulo, {
      body: datos.cuerpo,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: tag,
      renotify: true,
      data: { url: datos.url },
    })
  );
});

// ── Background Sync: vaciado de outbox y notificación inteligente ───────────
function abrirDB() {
  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open("gestor-tareas-db");
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

function pedir(peticion) {
  return new Promise((resolve, reject) => {
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

async function vaciarBandeja() {
  const db = await abrirDB();
  if (!db.objectStoreNames.contains("outbox")) {
    db.close();
    return 0;
  }

  const txLectura = db.transaction("outbox", "readonly");
  const pendientes = await pedir(txLectura.objectStore("outbox").getAll());
  let enviados = 0;

  for (const cambio of pendientes) {
    const resp = await fetch("/api/tareas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambio),
    });

    // Si falla, lanzamos: el navegador reintentará (con espera creciente).
    if (!resp.ok) throw new Error("El servidor respondió " + resp.status);

    // Se borra cada entrada apenas se confirma, no al final: si el siguiente
    // falla, no se reenvía lo que ya llegó.
    const txBorrado = db.transaction("outbox", "readwrite");
    await pedir(txBorrado.objectStore("outbox").delete(cambio.idCambio));
    enviados++;
  }

  db.close();
  return enviados;
}

async function avisarDeSincronizacion(enviados) {
  if (enviados <= 0) return;

  // Avisar por notificación solo si nadie mira. Si hay una ventana visible,
  // basta con un mensaje en pantalla; la notificación del sistema se reserva
  // para cuando el usuario no está en la app.
  const ventanas = await clients.matchAll({ type: "window", includeUncontrolled: true });
  const algunaVisible = ventanas.some((v) => v.visibilityState === "visible");

  // Avisar a clientes para que refresquen estado
  for (const ventana of ventanas) {
    ventana.postMessage({ type: "SYNC_COMPLETADO", enviados });
  }

  if (!algunaVisible) {
    await self.registration.showNotification("Tareas sincronizadas", {
      body: `${enviados} ${enviados === 1 ? "tarea llegó" : "tareas llegaron"} al servidor.`,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "gestor-sync",
      data: { url: "/index.html" },
    });
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-tareas") {
    event.waitUntil(vaciarBandeja().then(avisarDeSincronizacion));
  }
});
