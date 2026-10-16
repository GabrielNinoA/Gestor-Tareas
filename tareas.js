// tareas.js — Lógica de presentación y estructura del Gestor de Tareas.
// Actualizado para Sesión 24 (adjuntos de foto y ubicación) y Sesión 25.

const CLAVE_ALMACENAMIENTO = "electiva-pwa-tareas";

/**
 * @typedef {"baja"|"media"|"alta"} Prioridad
 * @typedef {{
 *   id: string,
 *   titulo: string,
 *   prioridad: Prioridad,
 *   completada: boolean,
 *   fechaCreacion: string,
 *   notaCifrada?: string,
 *   notaIv?: string,
 *   foto?: Blob,
 *   ubicacion?: { lat: number, lon: number, precision: number, momento: string }
 * }} Tarea
 */

/** Crea una tarea nueva con valores por defecto */
export const crearTarea = (titulo, prioridad = "media") => ({
  id: crypto.randomUUID(),
  titulo,
  prioridad,
  completada: false,
  fechaCreacion: new Date().toISOString(),
  foto: null,
  ubicacion: null,
});

/**
 * Crea el <li> de una tarea y lo agrega al contenedor.
 * Incluye fila de adjuntos (cámara y geolocalización) con soporte de ciclo de vida de URLs.
 */
export const renderizarTarea = (tarea, contenedor, callbacks, opciones = {}) => {
  const {
    onToggle,
    onEliminar,
    onTomarFoto,
    onEliminarFoto,
    onTomarUbicacion,
    onEliminarUbicacion,
  } = callbacks;
  const { notaDescifrada = "", urlFoto = null } = opciones;

  const li = document.createElement("li");
  li.className = `tarea tarea--${tarea.prioridad}` + (tarea.completada ? " tarea--completada" : "");
  li.dataset.id = tarea.id;

  // Cabecera de la tarea: Checkbox, Título y Botón Eliminar
  const encabezado = document.createElement("div");
  encabezado.className = "tarea-encabezado";

  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "tarea-check";
  check.checked = tarea.completada;
  check.addEventListener("change", () => onToggle(tarea.id));

  const texto = document.createElement("span");
  texto.className = "tarea-titulo";
  texto.textContent = tarea.titulo;

  const borrar = document.createElement("button");
  borrar.type = "button";
  borrar.textContent = "Eliminar";
  borrar.className = "btn-eliminar";
  borrar.addEventListener("click", () => onEliminar(tarea.id));

  encabezado.append(check, texto, borrar);
  li.append(encabezado);

  // Nota opcional
  if (notaDescifrada) {
    const nota = document.createElement("div");
    nota.className = "tarea-nota";
    nota.textContent = `Nota: ${notaDescifrada}`;
    li.append(nota);
  }

  // Fila de adjuntos (Cámara y Ubicación) - Sesión 24
  const filaAdjuntos = document.createElement("div");
  filaAdjuntos.className = "tarea-adjuntos";

  // --- SECCIÓN FOTO ---
  const grupoFoto = document.createElement("div");
  grupoFoto.className = "adjunto-grupo adjunto-foto";

  if (urlFoto) {
    const contenedorThumb = document.createElement("div");
    contenedorThumb.className = "miniatura-contenedor";

    const img = document.createElement("img");
    img.src = urlFoto;
    img.alt = `Foto de tarea: ${tarea.titulo}`;
    img.className = "miniatura-foto";
    img.title = "Click para ver en tamaño completo";
    img.addEventListener("click", () => window.open(urlFoto, "_blank"));

    const btnQuitarFoto = document.createElement("button");
    btnQuitarFoto.type = "button";
    btnQuitarFoto.className = "btn-quitar-adjunto";
    btnQuitarFoto.title = "Eliminar foto";
    btnQuitarFoto.textContent = "✕";
    btnQuitarFoto.addEventListener("click", (e) => {
      e.stopPropagation();
      onEliminarFoto?.(tarea.id);
    });

    contenedorThumb.append(img, btnQuitarFoto);
    grupoFoto.append(contenedorThumb);
  } else {
    const btnFoto = document.createElement("button");
    btnFoto.type = "button";
    btnFoto.className = "btn-adjunto btn-adjunto-foto";
    btnFoto.innerHTML = "📷 <span>Foto</span>";
    btnFoto.addEventListener("click", () => onTomarFoto?.(tarea.id));
    grupoFoto.append(btnFoto);
  }

  // --- SECCIÓN UBICACIÓN ---
  const grupoUbicacion = document.createElement("div");
  grupoUbicacion.className = "adjunto-grupo adjunto-ubicacion";

  if (tarea.ubicacion && typeof tarea.ubicacion.lat === "number") {
    const chipUbicacion = document.createElement("div");
    chipUbicacion.className = "chip-ubicacion";

    const linkMapa = document.createElement("a");
    linkMapa.href = `https://www.google.com/maps?q=${tarea.ubicacion.lat},${tarea.ubicacion.lon}`;
    linkMapa.target = "_blank";
    linkMapa.rel = "noopener noreferrer";
    linkMapa.className = "link-mapa";
    linkMapa.title = `Capturado: ${new Date(tarea.ubicacion.momento).toLocaleString()}`;
    linkMapa.innerHTML = `📍 <span>${tarea.ubicacion.lat.toFixed(4)}, ${tarea.ubicacion.lon.toFixed(4)} (±${tarea.ubicacion.precision} m)</span>`;

    const btnQuitarUbicacion = document.createElement("button");
    btnQuitarUbicacion.type = "button";
    btnQuitarUbicacion.className = "btn-quitar-adjunto";
    btnQuitarUbicacion.title = "Eliminar ubicación";
    btnQuitarUbicacion.textContent = "✕";
    btnQuitarUbicacion.addEventListener("click", (e) => {
      e.stopPropagation();
      onEliminarUbicacion?.(tarea.id);
    });

    chipUbicacion.append(linkMapa, btnQuitarUbicacion);
    grupoUbicacion.append(chipUbicacion);
  } else {
    const btnUbicacion = document.createElement("button");
    btnUbicacion.type = "button";
    btnUbicacion.className = "btn-adjunto btn-adjunto-ubicacion";
    btnUbicacion.innerHTML = "📍 <span>Ubicación</span>";
    btnUbicacion.addEventListener("click", () => onTomarUbicacion?.(tarea.id));
    grupoUbicacion.append(btnUbicacion);
  }

  filaAdjuntos.append(grupoFoto, grupoUbicacion);
  li.append(filaAdjuntos);

  contenedor.append(li);
};
