/**
 * notificaciones.js — Gestión de Notificaciones locales y Push API (Sesión 26).
 * Distingue la Notification API local del flujo de Push con claves VAPID.
 */

/** Pedir permiso. Solo llamar desde un gesto del usuario. */
export async function pedirPermisoNotificaciones() {
  if (!("Notification" in window)) return "no-soportado";
  return Notification.requestPermission();
}

/**
 * Notificación LOCAL (sin servidor): la muestra el propio SW.
 * Se usa registration.showNotification y no `new Notification()` porque este
 * último lanza TypeError en Chrome para Android.
 */
export async function mostrarAvisoLocal(titulo, cuerpo, url = "/index.html") {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(titulo, {
    body: cuerpo,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: `gestor-local-${Date.now()}`,
    renotify: true,
    data: { url },
  });
}

/** La clave pública VAPID llega en base64url; PushManager la quiere en bytes. */
export function urlBase64ABytes(base64url) {
  const relleno = "=".repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const binario = atob(b64);
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

/** Suscribe este navegador a push y envía la suscripción al servidor. */
export async function suscribirAPush() {
  const reg = await navigator.serviceWorker.ready;
  if (!("pushManager" in reg)) throw new Error("push-no-soportado");
  const respuesta = await fetch("/api/clave-publica");
  if (!respuesta.ok) throw new Error("No se pudo obtener la clave pública del servidor");
  const { clave } = await respuesta.json();
  const suscripcion = await reg.pushManager.subscribe({
    userVisibleOnly: true, // obligatorio: cada push debe mostrar una notificación
    applicationServerKey: urlBase64ABytes(clave),
  });
  const resp = await fetch("/api/suscribir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(suscripcion.toJSON()),
  });
  if (!resp.ok) throw new Error("El servidor no guardó la suscripción (" + resp.status + ")");
  return suscripcion;
}

/** Cancela la suscripción push activa tanto localmente como en el servidor. */
export async function cancelarSuscripcionPush() {
  const reg = await navigator.serviceWorker.ready;
  if (!("pushManager" in reg)) return false;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return false;
  try {
    await fetch("/api/desuscribir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } catch (err) {
    console.warn("No se pudo notificar la desuscripción al servidor:", err);
  }
  return await sub.unsubscribe();
}

/** Consulta si hay una suscripción activa a push en este navegador. */
export async function obtenerSuscripcionActual() {
  if (!("serviceWorker" in navigator)) return null;
  const reg = await navigator.serviceWorker.ready;
  if (!("pushManager" in reg)) return null;
  return await reg.pushManager.getSubscription();
}

/** Traduce excepciones de push a explicaciones comprensibles para el usuario. */
export function describirErrorPush(error) {
  if (!error) return "Error desconocido con el servicio push.";
  const nombre = error.name || "";
  const mensaje = error.message || "";
  if (nombre === "NotAllowedError") {
    return "Permiso denegado para notificaciones push en el navegador.";
  }
  if (nombre === "AbortError" || mensaje.includes("incognito") || mensaje.includes("Registration failed")) {
    return "El servicio de push del navegador no respondió (¿sin red, o navegador sin servicio de push?).";
  }
  if (mensaje === "push-no-soportado") {
    return "Este navegador no soporta PushManager.";
  }
  return `Error de push: ${error.message || nombre}`;
}

/** Pide al servidor de desarrollo que envíe un push de prueba a los suscriptores. */
export async function enviarPushPrueba(titulo = "Gestor de Tareas", cuerpo = "Mensaje de prueba desde el servidor", url = "/index.html") {
  const resp = await fetch("/api/enviar-prueba", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titulo, cuerpo, url }),
  });
  if (!resp.ok) {
    const errorJson = await resp.json().catch(() => ({}));
    throw new Error(errorJson.error || "El servidor respondió " + resp.status);
  }
  return await resp.json();
}
