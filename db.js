export const VERSION_DB = 3;
export const NOMBRE_DB = 'gestor-tareas-db';

export function abrirBaseDeDatos() {
  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open(NOMBRE_DB, VERSION_DB);
    
    peticion.onupgradeneeded = event => {
      const db = event.target.result;
      const version = event.oldVersion;

      if (version < 1) {
        const store = db.createObjectStore('tareas', { keyPath: 'id' });
        store.createIndex('porPrioridad', 'prioridad', { unique: false });
        store.createIndex('porTitulo', 'titulo', { unique: false });
      }
      if (version < 2) {
        // Configuraciones generales como la 'sal' para la clave
        if (!db.objectStoreNames.contains('config')) {
          db.createObjectStore('config', { keyPath: 'id' });
        }
      }
      if (version < 3) {
        // Almacén para la bandeja de salida (Background Sync - Sesión 26)
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'idCambio' });
        }
      }
    };

    peticion.onsuccess = event => resolve(event.target.result);
    peticion.onerror = event => reject(event.target.error);
  });
}

export function agregarTareaBD(db, tarea) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tareas', 'readwrite');
    const peticion = tx.objectStore('tareas').put(tarea);
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function eliminarTareaBD(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tareas', 'readwrite');
    const peticion = tx.objectStore('tareas').delete(id);
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

export function obtenerTodasLasTareasBD(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tareas', 'readonly');
    const peticion = tx.objectStore('tareas').getAll();
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}

export function guardarConfigBD(db, config) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('config', 'readwrite');
    const peticion = tx.objectStore('config').put(config);
    peticion.onsuccess = () => resolve();
    peticion.onerror = () => reject(peticion.error);
  });
}

export function obtenerConfigBD(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('config', 'readonly');
    const peticion = tx.objectStore('config').get(id);
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error);
  });
}
