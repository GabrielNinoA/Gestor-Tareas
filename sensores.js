// sensores.js — Módulo de sensores de movimiento y orientación (Sesión 25)
// DeviceOrientation, DeviceMotion, permiso en iOS y detección de sacudida (Shake to Undo)

/**
 * Solicita permiso explícito para sensores en navegadores que lo exigen (iOS Safari).
 * En Android/Chromium el permiso es implícito ("no-necesario").
 * @returns {Promise<"granted"|"denied"|"no-soportado"|"no-necesario">}
 */
export async function pedirPermisoSensores() {
  if (!("DeviceMotionEvent" in window)) return "no-soportado";
  if (typeof DeviceMotionEvent.requestPermission === "function") {
    try {
      return await DeviceMotionEvent.requestPermission(); // "granted" | "denied"
    } catch {
      return "denied"; // p. ej. NotAllowedError si no proviene de un clic
    }
  }
  return "no-necesario"; // Android / Chromium: permiso implícito
}

/**
 * Verifica si el dispositivo cuenta con sensores físicos reales, descartando
 * navegadores de escritorio que disparan eventos con valores null.
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
export function hayLecturasReales(timeoutMs = 1000) {
  return new Promise((resolve) => {
    const alRecibir = (e) => {
      const a = e.accelerationIncludingGravity;
      if (a && a.x !== null) {
        limpiar();
        resolve(true);
      }
    };
    const limpiar = () => {
      window.removeEventListener("devicemotion", alRecibir);
      clearTimeout(t);
    };
    const t = setTimeout(() => {
      limpiar();
      resolve(false);
    }, timeoutMs);
    window.addEventListener("devicemotion", alRecibir);
  });
}

/**
 * Escucha cambios en la orientación espacial (inclinación) limitando la frecuencia (throttle).
 * @param {({ alfa: number|null, beta: number|null, gamma: number|null }) => void} callback
 * @param {number} intervaloMs - Tiempo mínimo entre lecturas para no saturar la UI
 * @returns {() => void} Función de limpieza para apagar el sensor y ahorrar batería
 */
export function escucharOrientacion(callback, intervaloMs = 100) {
  let ultimo = 0;
  const manejador = (e) => {
    const ahora = performance.now();
    if (ahora - ultimo < intervaloMs) return;
    ultimo = ahora;
    if (e.beta === null) return; // Dispositivo sin sensor
    callback({
      alfa: e.alpha !== null ? Math.round(e.alpha) : null,
      beta: e.beta !== null ? Math.round(e.beta) : null,
      gamma: e.gamma !== null ? Math.round(e.gamma) : null,
    });
  };
  window.addEventListener("deviceorientation", manejador);
  return () => window.removeEventListener("deviceorientation", manejador);
}

/**
 * Detecta una sacudida (shake) midiendo la desviación de la aceleración con respecto a la gravedad terrestre (9.81 m/s²).
 * @param {(desviacion: number) => void} onSacudida - Callback ejecutado con la desviación detectada
 * @param {{ umbral?: number, enfriamientoMs?: number }} opciones
 * @returns {() => void} Función de limpieza para remover el listener
 */
export function detectarSacudida(onSacudida, { umbral = 12, enfriamientoMs = 1000 } = {}) {
  const GRAVEDAD = 9.81;
  let ultimaSacudida = 0;

  const manejador = (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null) return;
    const magnitud = Math.hypot(a.x, a.y, a.z);
    const desviacion = Math.abs(magnitud - GRAVEDAD);
    const ahora = performance.now();

    if (desviacion > umbral && ahora - ultimaSacudida > enfriamientoMs) {
      ultimaSacudida = ahora;
      onSacudida(Math.round(desviacion * 10) / 10);
    }
  };

  window.addEventListener("devicemotion", manejador);
  return () => window.removeEventListener("devicemotion", manejador);
}
