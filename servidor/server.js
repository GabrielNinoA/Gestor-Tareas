// servidor/server.js — Servidor Node para Gestor de Tareas (Sesión 26).
// Sirve los archivos estáticos de la PWA, administra suscripciones VAPID Web Push
// y recibe las sincronizaciones en segundo plano (outbox) con idempotencia.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAIZ_PWA = path.resolve(__dirname, "..");
const PUERTO = Number(process.env.PORT || 3000);

const ARCHIVO_CLAVES = path.join(__dirname, "claves-vapid.json");
const ARCHIVO_DATOS = path.join(__dirname, "datos.json");

// ── Claves VAPID: identifican a TU servidor ante el servicio de push ────────
let claves;
if (fs.existsSync(ARCHIVO_CLAVES)) {
  claves = JSON.parse(fs.readFileSync(ARCHIVO_CLAVES, "utf8"));
} else {
  claves = webpush.generateVAPIDKeys();
  fs.writeFileSync(ARCHIVO_CLAVES, JSON.stringify(claves, null, 2));
  console.log("Claves VAPID generadas en claves-vapid.json");
}

webpush.setVapidDetails(
  "mailto:tu-correo@ejemplo.com",
  claves.publicKey,
  claves.privateKey
);

// ── Persistencia ligera de datos ───────────────────────────────────────────
function cargarDatos() {
  if (fs.existsSync(ARCHIVO_DATOS)) {
    try {
      return JSON.parse(fs.readFileSync(ARCHIVO_DATOS, "utf8"));
    } catch {
      return { suscripciones: [], tareas: [] };
    }
  }
  return { suscripciones: [], tareas: [] };
}

let datos = cargarDatos();

function guardarDatos(nuevosDatos) {
  datos = nuevosDatos;
  fs.writeFileSync(ARCHIVO_DATOS, JSON.stringify(datos, null, 2));
}

// ── Tipos MIME para servir archivos estáticos ──────────────────────────────
const TIPOS_MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

function responder(res, codigo, contenido, tipo = "application/json; charset=utf-8") {
  res.writeHead(codigo, {
    "Content-Type": tipo,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  if (typeof contenido === "object" && !(contenido instanceof Buffer)) {
    res.end(JSON.stringify(contenido));
  } else {
    res.end(contenido);
  }
}

async function leerCuerpoJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

// ── Servidor HTTP Principal ────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PUERTO}`);
  const ruta = parsedUrl.pathname;

  // Manejo de preflight CORS
  if (req.method === "OPTIONS") {
    return responder(res, 204, "");
  }

  // 1. Clave pública VAPID para que el navegador pueda suscribirse
  if (req.method === "GET" && ruta === "/api/clave-publica") {
    return responder(res, 200, { clave: claves.publicKey });
  }

  // 2. Guardar suscripción push recibida desde el navegador
  if (req.method === "POST" && ruta === "/api/suscribir") {
    try {
      const sub = await leerCuerpoJson(req);
      if (!sub || !sub.endpoint || !sub.keys) {
        return responder(res, 400, { error: "suscripción incompleta" });
      }

      // Evitar duplicados por endpoint
      const existe = datos.suscripciones.some((s) => s.endpoint === sub.endpoint);
      if (!existe) {
        datos.suscripciones.push(sub);
        guardarDatos(datos);
      }
      return responder(res, 201, { ok: true, total: datos.suscripciones.length });
    } catch {
      return responder(res, 400, { error: "JSON inválido" });
    }
  }

  // 3. Cancelar suscripción push
  if (req.method === "POST" && ruta === "/api/desuscribir") {
    try {
      const { endpoint } = await leerCuerpoJson(req);
      datos.suscripciones = datos.suscripciones.filter((s) => s.endpoint !== endpoint);
      guardarDatos(datos);
      return responder(res, 200, { ok: true, total: datos.suscripciones.length });
    } catch {
      return responder(res, 400, { error: "JSON inválido" });
    }
  }

  // 4. Enviar notificación push de prueba a todos los navegadores suscritos
  if (req.method === "POST" && ruta === "/api/enviar-prueba") {
    try {
      const cuerpoReq = await leerCuerpoJson(req);
      const {
        titulo = "Gestor de Tareas",
        cuerpo = "Mensaje de prueba desde el servidor",
        url = "/index.html",
      } = cuerpoReq;

      const mensaje = JSON.stringify({ titulo, cuerpo, url });
      const resultado = { enviados: 0, fallidos: 0, eliminadas: 0 };

      for (const sub of [...datos.suscripciones]) {
        try {
          await webpush.sendNotification(sub, mensaje, { TTL: 60 });
          resultado.enviados++;
        } catch (err) {
          resultado.fallidos++;
          // 404/410: la suscripción ya no existe (el usuario revocó o desinstaló)
          if (err.statusCode === 404 || err.statusCode === 410) {
            datos.suscripciones = datos.suscripciones.filter((s) => s.endpoint !== sub.endpoint);
            resultado.eliminadas++;
          } else {
            console.error("Error al enviar push:", err.statusCode ?? "", err.message);
          }
        }
      }

      guardarDatos(datos);
      return responder(res, 200, resultado);
    } catch (err) {
      return responder(res, 500, { error: err.message });
    }
  }

  // 5. Consultar tareas recibidas en el servidor
  if (req.method === "GET" && ruta === "/api/tareas") {
    return responder(res, 200, datos.tareas);
  }

  // 6. Recibir tareas desde la bandeja de salida (Background Sync / Plan B)
  if (req.method === "POST" && ruta === "/api/tareas") {
    try {
      const cambio = await leerCuerpoJson(req);
      if (!cambio || !cambio.idCambio) {
        return responder(res, 400, { error: "El cambio debe incluir idCambio (UUID)" });
      }

      // Idempotencia: si ya existe una tarea con ese idCambio, no duplicar
      const yaExiste = datos.tareas.some((t) => t.idCambio === cambio.idCambio);
      if (yaExiste) {
        return responder(res, 200, { ok: true, duplicado: true });
      }

      datos.tareas.push(cambio);
      guardarDatos(datos);
      return responder(res, 200, { ok: true, duplicado: false });
    } catch {
      return responder(res, 400, { error: "JSON inválido" });
    }
  }

  // 7. Servir archivos estáticos del Gestor de Tareas
  if (req.method === "GET" || req.method === "HEAD") {
    let rutaLimpia = ruta === "/" ? "/index.html" : ruta;
    const rutaArchivo = path.join(RAIZ_PWA, rutaLimpia);

    // Evitar Directory Traversal
    if (!rutaArchivo.startsWith(RAIZ_PWA)) {
      return responder(res, 403, "Acceso no permitido", "text/plain");
    }

    fs.stat(rutaArchivo, (err, stats) => {
      if (err || !stats.isFile()) {
        return responder(res, 404, "Archivo no encontrado", "text/plain");
      }

      const ext = path.extname(rutaArchivo).toLowerCase();
      const tipoMime = TIPOS_MIME[ext] || "application/octet-stream";

      res.writeHead(200, {
        "Content-Type": tipoMime,
        "Cache-Control": ext === ".html" || ext === ".js" ? "no-cache" : "max-age=3600",
      });

      if (req.method === "HEAD") {
        return res.end();
      }

      fs.createReadStream(rutaArchivo).pipe(res);
    });
    return;
  }

  responder(res, 405, "Método no permitido", "text/plain");
});

server.listen(PUERTO, () => {
  console.log(`Servidor PWA Gestor de Tareas escuchando en http://localhost:${PUERTO}`);
});
