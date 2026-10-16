// dispositivo.js — Módulo de APIs de dispositivo (Sesión 24)
// Cámara, Micrófono, Geolocalización y Permissions API

/**
 * Consulta el estado de un permiso sin disparar alertas al usuario.
 * @param {string} nombre - Nombre del permiso (p. ej. 'camera', 'microphone', 'geolocation')
 * @returns {Promise<"granted"|"denied"|"prompt"|"desconocido">}
 */
export async function estadoPermiso(nombre) {
  try {
    const r = await navigator.permissions.query({ name: nombre });
    return r.state; // "granted" | "denied" | "prompt"
  } catch {
    return "desconocido"; // el navegador no soporta ese nombre
  }
}

/**
 * Abre la cámara del dispositivo con restricciones ideales.
 * @param {"environment"|"user"} facingMode - Cámara trasera ("environment") o frontal ("user")
 * @returns {Promise<MediaStream>}
 */
export function abrirCamara(facingMode = "environment") {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: facingMode }, // "user" = frontal, "environment" = trasera
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
}

/**
 * Detiene todas las pistas del stream de cámara para apagar el hardware (LED).
 * @param {MediaStream|null} stream
 */
export function detenerCamara(stream) {
  stream?.getTracks().forEach((pista) => pista.stop());
}

/**
 * Traduce los errores de getUserMedia a mensajes claros para el usuario.
 * @param {Error} err
 * @returns {string}
 */
export function describirErrorCamara(err) {
  switch (err?.name) {
    case "NotAllowedError":
      return "Bloqueaste el permiso de cámara. Habilítalo desde el candado de la barra de direcciones.";
    case "NotFoundError":
      return "Este dispositivo no tiene cámara disponible.";
    case "NotReadableError":
      return "La cámara está siendo usada por otra aplicación.";
    case "OverconstrainedError":
      return "La cámara no soporta la configuración pedida.";
    case "TypeError":
      return "La cámara solo funciona en HTTPS o en localhost.";
    default:
      return `No se pudo abrir la cámara (${err?.name ?? "error desconocido"}).`;
  }
}

/**
 * Dibuja el fotograma actual del video en un canvas y lo exporta como Blob JPEG.
 * @param {HTMLVideoElement} video
 * @param {number} anchoMax
 * @returns {Promise<Blob|null>}
 */
export function capturarFoto(video, anchoMax = 640) {
  const escala = Math.min(1, anchoMax / (video.videoWidth || 640));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((video.videoWidth || 640) * escala);
  canvas.height = Math.round((video.videoHeight || 480) * escala);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
}

/**
 * Abre el micrófono con cancelación de eco y supresión de ruido.
 * @returns {Promise<MediaStream>}
 */
export function abrirMicrofono() {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: false,
  });
}

/**
 * Crea un analizador de audio Web Audio API para medir el nivel de volumen en tiempo real.
 * @param {MediaStream} stream
 * @returns {{ leer: () => number, cerrar: () => void }}
 */
export function crearMedidorDeNivel(stream) {
  const ctx = new AudioContext();
  ctx.resume(); // Dentro del gesto del usuario para cumplir política de autoplay
  const analizador = ctx.createAnalyser();
  analizador.fftSize = 512;
  ctx.createMediaStreamSource(stream).connect(analizador);
  const datos = new Uint8Array(analizador.fftSize);

  return {
    leer() {
      // Devuelve valor normalizado: 0 = silencio, 1 = máximo
      analizador.getByteTimeDomainData(datos);
      let pico = 0;
      for (const v of datos) {
        pico = Math.max(pico, Math.abs(v - 128));
      }
      return pico / 128;
    },
    cerrar() {
      stream.getTracks().forEach((p) => p.stop());
      ctx.close();
    },
  };
}

/**
 * Obtiene la posición geográfica actual mediante Geolocation API.
 * @param {{ altaPrecision?: boolean, timeoutMs?: number }} opciones
 * @returns {Promise<{ lat: number, lon: number, precision: number, momento: string }>}
 */
export function obtenerUbicacion({ altaPrecision = false, timeoutMs = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject({ code: 0, message: "Geolocation no disponible" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        precision: Math.round(pos.coords.accuracy),
        momento: new Date(pos.timestamp).toISOString(),
      }),
      reject,
      { enableHighAccuracy: altaPrecision, timeout: timeoutMs, maximumAge: 60000 }
    );
  });
}

/**
 * Traduce códigos de error de Geolocation a mensajes comprensibles.
 * @param {{ code?: number }} err
 * @returns {string}
 */
export function describirErrorUbicacion(err) {
  switch (err?.code) {
    case 1:
      return "Denegaste el permiso de ubicación. La tarea sigue funcionando sin ella.";
    case 2:
      return "No se pudo determinar la posición (sin señal GPS o de red).";
    case 3:
      return "La ubicación tardó demasiado en responder. Intenta de nuevo.";
    default:
      return "La ubicación no está disponible en este navegador.";
  }
}
