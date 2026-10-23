/**
 * sync.js — Gestión de la bandeja de salida (outbox) y Background Sync (Sesión 26).
 * Implementa el patrón outbox, idempotencia por UUID y Plan B para navegadores sin SyncManager.
 */

export const ETIQUETA_SYNC = "sync-tareas";

/** Comprueba si el navegador actual soporta la Background Synchronization API. */
export function haySyncEnSegundoPlano() {
  return "serviceWorker" in navigator && "SyncManager" in window;
}

/** Anota un cambio pendiente en la bandeja outbox. Devuelve el idCambio (UUID). */
export function encolarCambio(db, tipo, datos) {
  const cambio = {
    idCambio: crypto.randomUUID(),
    tipo,
    datos,
    creadoEn: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readwrite");
    tx.objectStore("outbox").add(cambio);
    tx.oncomplete = () => resolve(cambio.idCambio);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Devuelve la lista completa de cambios pendientes en outbox. */
export function obtenerCambiosPendientes(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readonly");
    const peticion = tx.objectStore("outbox").getAll();
    peticion.onsuccess = () => resolve(peticion.result || []);
    peticion.onerror = () => reject(peticion.error);
  });
}

/** Devuelve el conteo de cambios pendientes en outbox. */
export function contarCambiosPendientes(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readonly");
    const peticion = tx.objectStore("outbox").count();
    peticion.onsuccess = () => resolve(peticion.result || 0);
    peticion.onerror = () => reject(peticion.error);
  });
}

/** Elimina un cambio de outbox tras confirmación del servidor. */
export function eliminarCambioOutbox(db, idCambio) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readwrite");
    const peticion = tx.objectStore("outbox").delete(idCambio);
    peticion.onsuccess = () => resolve();
    peticion.onerror = () => reject(peticion.error);
  });
}

/**
 * Plan B: Envía los cambios pendientes directamente desde la página cuando
 * Background Sync no está soportado (Safari, Firefox) o el permiso fue revocado.
 */
export async function vaciarDesdeLaPagina(db) {
  const pendientes = await obtenerCambiosPendientes(db);
  let enviados = 0;

  for (const cambio of pendientes) {
    const resp = await fetch("/api/tareas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambio),
    });

    if (!resp.ok) throw new Error("El servidor respondió " + resp.status);

    // Se borra cada entrada inmediatamente al confirmarse para no reenviar en caso de fallo posterior
    await eliminarCambioOutbox(db, cambio.idCambio);
    enviados++;
  }

  return enviados;
}

/**
 * Solicita la sincronización al navegador o usa el Plan B si SyncManager no está
 * disponible o falla.
 */
export async function pedirSincronizacion(db) {
  if (haySyncEnSegundoPlano()) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register(ETIQUETA_SYNC);
      return "segundo-plano";
    } catch (err) {
      // NotAllowedError si el permiso está denegado en el sitio, o fallo en el registro
      console.warn("Fallo en reg.sync.register, ejecutando Plan B:", err);
    }
  }

  // Plan B: Vaciar desde la página si hay conexión
  await vaciarDesdeLaPagina(db);
  return "desde-la-pagina";
}
