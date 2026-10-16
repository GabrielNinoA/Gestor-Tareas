// app.js — Punto de entrada del Gestor de Tareas PWA.
// Integra Sesión 22 (IndexedDB y Cripto), Sesión 23 (Workbox PWA),
// Sesión 24 (Cámara, Micrófono y Ubicación) y Sesión 25 (Sensores de Movimiento y Deshacer).

import { crearTarea, renderizarTarea } from "./tareas.js";
import {
  abrirBaseDeDatos,
  agregarTareaBD,
  eliminarTareaBD,
  obtenerTodasLasTareasBD,
  guardarConfigBD,
  obtenerConfigBD,
} from "./db.js";
import {
  derivarClaveDesdeContrasena,
  cifrarTexto,
  descifrarTexto,
} from "./crypto.js";
import {
  estadoPermiso,
  abrirCamara,
  detenerCamara,
  describirErrorCamara,
  capturarFoto,
  abrirMicrofono,
  crearMedidorDeNivel,
  obtenerUbicacion,
  describirErrorUbicacion,
} from "./dispositivo.js";
import {
  pedirPermisoSensores,
  hayLecturasReales,
  escucharOrientacion,
  detectarSacudida,
} from "./sensores.js";

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
let db;
let claveActual = null;
let tareas = [];
let ultimaEliminada = null; // Para deshacer eliminación (Sesión 25)
let urlsObjetosActivas = []; // Almacena URLs temporales para liberar memoria con revokeObjectURL (Sesión 24)

// Estado de la cámara
let streamCamaraActual = null;
let tareaIdParaFoto = null;
let facingModeActual = "environment"; // "environment" = trasera, "user" = frontal

// Estado de sensores de movimiento
let sensoresActivos = false;
let detenerOrientacionFn = null;
let detenerSacudidaFn = null;

// Estado del medidor de micrófono
let medidorMicActual = null;
let animacionMicId = null;

// --- ELEMENTOS DEL DOM ---
const listaEl = document.getElementById("lista-tareas");
const formEl = document.getElementById("form-tarea");
const inputTituloEl = document.getElementById("input-titulo");
const inputPrioridadEl = document.getElementById("input-prioridad");
const inputPasswordEl = document.getElementById("input-password");
const inputNotaEl = document.getElementById("input-nota");
const mensajeFeedbackEl = document.getElementById("mensaje-feedback");

// Controles de sensores y deshacer (Sesión 25)
const btnDeshacerEl = document.getElementById("btn-deshacer");
const btnSensoresEl = document.getElementById("btn-sensores");
const lecturaInclinacionEl = document.getElementById("lectura-inclinacion");
const avisoSensoresEl = document.getElementById("aviso-sensores");

// Modales de Cámara y Permisos (Sesión 24)
const dlgPermisoCamaraEl = document.getElementById("dlg-permiso-camara");
const btnConfirmarPermisoEl = document.getElementById("btn-confirmar-permiso");
const btnCancelarPermisoEl = document.getElementById("btn-cancelar-permiso");

const dlgCamaraEl = document.getElementById("dlg-camara");
const videoCamaraEl = document.getElementById("video-camara");
const btnCapturarFotoEl = document.getElementById("btn-capturar-foto");
const btnCambiarCamaraEl = document.getElementById("btn-cambiar-camara");
const btnCerrarCamaraEl = document.getElementById("btn-cerrar-camara");
const btnCerrarCamaraXEl = document.getElementById("btn-cerrar-camara-x");

// Modal de Micrófono (Sesión 24)
const btnAbrirMicEl = document.getElementById("btn-abrir-mic");
const dlgMicrofonoEl = document.getElementById("dlg-microfono");
const btnCerrarMicXEl = document.getElementById("btn-cerrar-mic-x");
const btnDetenerMicEl = document.getElementById("btn-detener-mic");
const barraVolumenNivelEl = document.getElementById("barra-volumen-nivel");
const valorVolumenActualEl = document.getElementById("valor-volumen-actual");
const estadoMicTextoEl = document.getElementById("estado-mic-texto");

// PWA: Conexión e Instalación
const indicadorConexionEl = document.getElementById("indicador-conexion");
const btnInstalarEl = document.getElementById("btn-instalar");

// --- UTILIDAD: FEEDBACK VISUAL ---
let temporizadorFeedback = null;
function mostrarFeedback(mensaje, esError = false) {
  if (!mensajeFeedbackEl) return;
  clearTimeout(temporizadorFeedback);
  mensajeFeedbackEl.textContent = mensaje;
  mensajeFeedbackEl.classList.toggle("feedback-error", esError);
  mensajeFeedbackEl.hidden = false;
  temporizadorFeedback = setTimeout(() => {
    mensajeFeedbackEl.hidden = true;
  }, 4500);
}

// --- CRIPTO: CLAVE DERIVADA ---
async function obtenerOcrearClave(password) {
  let configSal = await obtenerConfigBD(db, "sal_cripto");
  let sal;
  if (configSal) {
    sal = configSal.valor;
  } else {
    sal = crypto.getRandomValues(new Uint8Array(16));
    await guardarConfigBD(db, { id: "sal_cripto", valor: sal });
  }
  return derivarClaveDesdeContrasena(password, sal);
}

// --- RENDERIZADO PRINCIPAL CON GESTIÓN DE MEMORIA ---
const pintarTodo = async () => {
  // 1. Liberar URLs de Blob anteriores para evitar fugas de memoria (Sesión 24)
  urlsObjetosActivas.forEach((url) => URL.revokeObjectURL(url));
  urlsObjetosActivas = [];

  listaEl.innerHTML = "";
  tareas = await obtenerTodasLasTareasBD(db);

  for (const tarea of tareas) {
    let notaDescifrada = "";
    if (claveActual && tarea.notaCifrada) {
      try {
        notaDescifrada = await descifrarTexto(claveActual, {
          cifrado: tarea.notaCifrada,
          iv: tarea.notaIv,
        });
      } catch {
        notaDescifrada = "[Error al descifrar: Contraseña incorrecta o cambiada]";
      }
    } else if (tarea.notaCifrada) {
      notaDescifrada = "[Nota cifrada - Ingrese contraseña para ver]";
    }

    // Generar URL temporal si la tarea tiene una foto binaria (Blob)
    let urlFoto = null;
    if (tarea.foto instanceof Blob) {
      urlFoto = URL.createObjectURL(tarea.foto);
      urlsObjetosActivas.push(urlFoto);
    }

    renderizarTarea(
      tarea,
      listaEl,
      {
        onToggle: alternarCompletada,
        onEliminar: eliminarTarea,
        onTomarFoto: iniciarFlujoCamara,
        onEliminarFoto: eliminarFotoTarea,
        onTomarUbicacion: adjuntarUbicacionTarea,
        onEliminarUbicacion: eliminarUbicacionTarea,
      },
      { notaDescifrada, urlFoto }
    );
  }

  // Actualizar estado del botón de deshacer
  btnDeshacerEl.disabled = !ultimaEliminada;
};

// --- GESTIÓN DE TAREAS ---
async function alternarCompletada(id) {
  const tarea = tareas.find((t) => t.id === id);
  if (tarea) {
    tarea.completada = !tarea.completada;
    await agregarTareaBD(db, tarea);
    pintarTodo();
  }
}

/**
 * Elimina una tarea y guarda respaldo en ultimaEliminada (Sesión 25)
 */
async function eliminarTarea(id) {
  const tareaAEliminar = tareas.find((t) => t.id === id);
  if (tareaAEliminar) {
    ultimaEliminada = { ...tareaAEliminar };
    btnDeshacerEl.disabled = false;
  }
  await eliminarTareaBD(db, id);
  mostrarFeedback(
    `Tarea eliminada. Puedes deshacer la acción pulsando «Deshacer» o agitando tu teléfono.`
  );
  pintarTodo();
}

/**
 * Deshace la última eliminación restaurando la tarea en IndexedDB (Sesión 25).
 * Maneja colisión de títulos existentes para evitar errores de índice único.
 */
async function deshacerEliminacion() {
  if (!ultimaEliminada) return;

  // Validación de título existente (Sesión 25 Actividad 3)
  const existeMismoTitulo = tareas.some(
    (t) => t.titulo.trim().toLowerCase() === ultimaEliminada.titulo.trim().toLowerCase()
  );

  if (existeMismoTitulo) {
    mostrarFeedback(
      `No se puede restaurar: ya existe una tarea con el título «${ultimaEliminada.titulo}». Modifica la tarea existente para evitar duplicados.`,
      true
    );
    return; // Conserva ultimaEliminada en lugar de perderla
  }

  const tareaRestaurada = {
    ...ultimaEliminada,
    id: crypto.randomUUID(), // Asignar nuevo id único para la restauración
  };

  try {
    await agregarTareaBD(db, tareaRestaurada);
    mostrarFeedback(`Se restauró «${tareaRestaurada.titulo}».`);
    
    // Retroalimentación háptica (vibración) si el dispositivo lo soporta
    if ("vibrate" in navigator) {
      try { navigator.vibrate([80, 40, 80]); } catch {}
    }

    ultimaEliminada = null;
    btnDeshacerEl.disabled = true;
    pintarTodo();
  } catch (err) {
    mostrarFeedback(`Error al restaurar: ${err.message}`, true);
  }
}

btnDeshacerEl.addEventListener("click", deshacerEliminacion);

// --- FORMULARIO NUEVA TAREA ---
formEl.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const password = inputPasswordEl.value;
  if (!claveActual && password) {
    claveActual = await obtenerOcrearClave(password);
  }

  const titulo = inputTituloEl.value.trim();
  if (!titulo) return;

  const nuevaTarea = crearTarea(titulo, inputPrioridadEl.value);

  const notaText = inputNotaEl.value;
  if (notaText && claveActual) {
    const { cifrado, iv } = await cifrarTexto(claveActual, notaText);
    nuevaTarea.notaCifrada = cifrado;
    nuevaTarea.notaIv = iv;
  }

  await agregarTareaBD(db, nuevaTarea);

  inputTituloEl.value = "";
  inputNotaEl.value = "";
  pintarTodo();
});

// =========================================================================
// SESIÓN 24: CÁMARA (getUserMedia, Canvas, Blob y Permisos)
// =========================================================================

/**
 * Inicia el flujo de cámara verificando el estado del permiso antes de invocar hardware.
 */
async function iniciarFlujoCamara(idTarea) {
  tareaIdParaFoto = idTarea;

  // Consultar estado de permiso con Permissions API sin molestar al usuario
  const estado = await estadoPermiso("camera");

  if (estado === "denied") {
    mostrarFeedback(
      "Bloqueaste el permiso de cámara. Habilítalo desde el candado de la barra de direcciones.",
      true
    );
    return;
  }

  if (estado === "granted") {
    // Si ya está concedido, abrir directamente
    abrirCamaraModal();
  } else {
    // Si está en 'prompt' o 'desconocido', mostrar explicación previa respetuosa (Actividad 4)
    dlgPermisoCamaraEl.showModal();
  }
}

btnConfirmarPermisoEl.addEventListener("click", () => {
  dlgPermisoCamaraEl.close();
  abrirCamaraModal();
});

btnCancelarPermisoEl.addEventListener("click", () => {
  dlgPermisoCamaraEl.close();
  tareaIdParaFoto = null;
});

async function abrirCamaraModal() {
  try {
    detenerCamaraActiva();
    streamCamaraActual = await abrirCamara(facingModeActual);
    videoCamaraEl.srcObject = streamCamaraActual;
    dlgCamaraEl.showModal();
  } catch (err) {
    const mensaje = describirErrorCamara(err);
    mostrarFeedback(mensaje, true);
    tareaIdParaFoto = null;
  }
}

function detenerCamaraActiva() {
  if (streamCamaraActual) {
    detenerCamara(streamCamaraActual);
    streamCamaraActual = null;
    videoCamaraEl.srcObject = null;
  }
}

// Detener cámara al cerrar el diálogo (por botón o tecla ESC)
dlgCamaraEl.addEventListener("close", () => {
  detenerCamaraActiva();
});

btnCerrarCamaraEl.addEventListener("click", () => dlgCamaraEl.close());
btnCerrarCamaraXEl.addEventListener("click", () => dlgCamaraEl.close());

// Alternar entre cámara trasera y frontal
btnCambiarCamaraEl.addEventListener("click", async () => {
  facingModeActual = facingModeActual === "environment" ? "user" : "environment";
  await abrirCamaraModal();
});

// Capturar fotograma a Blob y almacenar en IndexedDB
btnCapturarFotoEl.addEventListener("click", async () => {
  if (!videoCamaraEl || !tareaIdParaFoto) return;

  try {
    const blobFoto = await capturarFoto(videoCamaraEl, 640);
    if (blobFoto) {
      const tarea = tareas.find((t) => t.id === tareaIdParaFoto);
      if (tarea) {
        tarea.foto = blobFoto;
        await agregarTareaBD(db, tarea);
        mostrarFeedback("Foto capturada y guardada con éxito.");
      }
    }
  } catch (err) {
    mostrarFeedback(`Error al procesar la foto: ${err.message}`, true);
  } finally {
    dlgCamaraEl.close();
    pintarTodo();
  }
});

async function eliminarFotoTarea(id) {
  const tarea = tareas.find((t) => t.id === id);
  if (tarea) {
    tarea.foto = null;
    await agregarTareaBD(db, tarea);
    mostrarFeedback("Foto eliminada de la tarea.");
    pintarTodo();
  }
}

// =========================================================================
// SESIÓN 24: GEOLOCALIZACIÓN
// =========================================================================

async function adjuntarUbicacionTarea(id) {
  mostrarFeedback("Obteniendo ubicación del dispositivo...");
  try {
    const ubicacion = await obtenerUbicacion({ altaPrecision: false, timeoutMs: 10000 });
    const tarea = tareas.find((t) => t.id === id);
    if (tarea) {
      tarea.ubicacion = ubicacion;
      await agregarTareaBD(db, tarea);
      mostrarFeedback(
        `Ubicación guardada: ${ubicacion.lat.toFixed(4)}, ${ubicacion.lon.toFixed(4)} (±${ubicacion.precision} m)`
      );
      pintarTodo();
    }
  } catch (err) {
    const mensaje = describirErrorUbicacion(err);
    mostrarFeedback(mensaje, true);
  }
}

async function eliminarUbicacionTarea(id) {
  const tarea = tareas.find((t) => t.id === id);
  if (tarea) {
    tarea.ubicacion = null;
    await agregarTareaBD(db, tarea);
    mostrarFeedback("Ubicación eliminada de la tarea.");
    pintarTodo();
  }
}

// =========================================================================
// SESIÓN 24: MICRÓFONO Y MEDIDOR DE NIVEL (Web Audio API)
// =========================================================================

btnAbrirMicEl.addEventListener("click", async () => {
  try {
    const stream = await abrirMicrofono();
    medidorMicActual = crearMedidorDeNivel(stream);
    dlgMicrofonoEl.showModal();
    estadoMicTextoEl.textContent = "Micrófono activo y midiendo nivel de audio...";

    const actualizarNivel = () => {
      if (!medidorMicActual) return;
      const nivel = medidorMicActual.leer(); // 0 a 1
      const porcentaje = Math.min(100, Math.round(nivel * 100));
      barraVolumenNivelEl.style.width = `${porcentaje}%`;
      valorVolumenActualEl.textContent = nivel.toFixed(2);
      animacionMicId = requestAnimationFrame(actualizarNivel);
    };

    actualizarNivel();
  } catch (err) {
    mostrarFeedback(
      `No se pudo abrir el micrófono: ${err?.name === "NotAllowedError" ? "Permiso denegado." : err.message}`,
      true
    );
  }
});

function cerrarMedidorMicrofono() {
  if (animacionMicId) {
    cancelAnimationFrame(animacionMicId);
    animacionMicId = null;
  }
  if (medidorMicActual) {
    medidorMicActual.cerrar();
    medidorMicActual = null;
  }
  barraVolumenNivelEl.style.width = "0%";
  valorVolumenActualEl.textContent = "0.00";
}

dlgMicrofonoEl.addEventListener("close", cerrarMedidorMicrofono);
btnDetenerMicEl.addEventListener("click", () => dlgMicrofonoEl.close());
btnCerrarMicXEl.addEventListener("click", () => dlgMicrofonoEl.close());

// =========================================================================
// SESIÓN 25: SENSORES DE MOVIMIENTO (DeviceOrientation y Shake to Undo)
// =========================================================================

btnSensoresEl.addEventListener("click", async () => {
  if (sensoresActivos) {
    // Desactivar sensores
    apagarSensores();
    mostrarFeedback("Sensores de movimiento desactivados.");
    return;
  }

  // 1. Permiso explícito en iOS Safari
  const estadoPermisoSensores = await pedirPermisoSensores();
  if (estadoPermisoSensores === "denied") {
    mostrarFeedback("Permiso denegado para sensores de movimiento. Usa el botón «Deshacer eliminación».", true);
    avisoSensoresEl.textContent = "Permiso denegado en iOS";
    return;
  }
  if (estadoPermisoSensores === "no-soportado") {
    mostrarFeedback("Este navegador no soporta DeviceMotionEvent. Usa el botón «Deshacer eliminación».", true);
    avisoSensoresEl.textContent = "Sin soporte de sensores en navegador";
    return;
  }

  // 2. Comprobar si hay hardware real o valores nulos (computadores de escritorio)
  lecturaInclinacionEl.textContent = "Detectando sensores...";
  const hayHardware = await hayLecturasReales(1000);

  if (!hayHardware) {
    avisoSensoresEl.textContent = "Este dispositivo no tiene sensores de movimiento. Usa el botón «Deshacer eliminación».";
    lecturaInclinacionEl.textContent = "Inclinación: No disponible";
    mostrarFeedback("Este dispositivo no tiene sensores de movimiento. Usa el botón «Deshacer eliminación».", true);
    return;
  }

  // 3. Activar sensores y listeners
  sensoresActivos = true;
  btnSensoresEl.textContent = "📳 Desactivar sensores";
  btnSensoresEl.classList.add("activo");
  avisoSensoresEl.textContent = "";
  mostrarFeedback("Sensores activados: inclina el dispositivo o agítalo para deshacer.");

  // Escuchar inclinación
  detenerOrientacionFn = escucharOrientacion(({ beta, gamma }) => {
    lecturaInclinacionEl.textContent = `inclinación β ${beta ?? 0}° · γ ${gamma ?? 0}°`;
  }, 100);

  // Detectar sacudida (Shake to Undo)
  detenerSacudidaFn = detectarSacudida((desviacion) => {
    if (ultimaEliminada) {
      mostrarFeedback(`¡Sacudida detectada (${desviacion} m/s²)! Restaurando tarea...`);
      deshacerEliminacion();
    } else {
      mostrarFeedback(`Sacudida detectada (${desviacion} m/s²), pero no hay tarea para deshacer.`);
    }
  }, { umbral: 12, enfriamientoMs: 1000 });
});

function apagarSensores() {
  detenerOrientacionFn?.();
  detenerSacudidaFn?.();
  detenerOrientacionFn = null;
  detenerSacudidaFn = null;
  sensoresActivos = false;
  btnSensoresEl.textContent = "📳 Activar agitar para deshacer";
  btnSensoresEl.classList.remove("activo");
  lecturaInclinacionEl.textContent = "Inclinación: Sensor inactivo";
  avisoSensoresEl.textContent = "";
}

// =========================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// =========================================================================

async function iniciar() {
  db = await abrirBaseDeDatos();

  const tareasActuales = await obtenerTodasLasTareasBD(db);
  if (tareasActuales.length === 0) {
    const tareaInicial = crearTarea("Aprender el Bloque 3: PWA", "alta");
    await agregarTareaBD(db, tareaInicial);
  }

  pintarTodo();
}

iniciar();

// Registro de Service Worker (Sesión 23)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => console.log("SW registrado:", reg.scope))
    .catch((err) => console.error("Error al registrar SW:", err));
}

// Indicador de conexión Online / Offline
window.addEventListener("online", () => (indicadorConexionEl.hidden = true));
window.addEventListener("offline", () => (indicadorConexionEl.hidden = false));
if (!navigator.onLine) {
  indicadorConexionEl.hidden = false;
}

// Instalación PWA (beforeinstallprompt)
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstalarEl.hidden = false;
});

btnInstalarEl.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  btnInstalarEl.hidden = true;
});
