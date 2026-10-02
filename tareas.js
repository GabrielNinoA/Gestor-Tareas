// tareas.js — lógica del Gestor de Tareas.
// Construida en las Sesiones 3 a 8 (objetos, funciones, arrow functions, DOM
// y eventos, asincronía, módulos) y tipada en las Sesiones 9 a 14 — ver la
// versión de referencia en referencia-typescript/tareas.ts.

const CLAVE_ALMACENAMIENTO = "electiva-pwa-tareas";

/**
 * @typedef {"baja"|"media"|"alta"} Prioridad
 * @typedef {{ id: string, titulo: string, prioridad: Prioridad, completada: boolean, fechaCreacion: string }} Tarea
 */

/** Crea una tarea nueva. Sesión 3 (objetos) y Sesión 4 (parámetros por defecto). */
export const crearTarea = (titulo, prioridad = "media") => ({
  id: crypto.randomUUID(),
  titulo,
  prioridad,
  completada: false,
  fechaCreacion: new Date().toISOString(),
});

/** Crea el <li> de una tarea y lo agrega al contenedor. Sesión 6 (DOM y eventos). */
export const renderizarTarea = (tarea, contenedor, { onToggle, onEliminar }, notaText = "") => {
  const li = document.createElement("li");
  li.className = `tarea tarea--${tarea.prioridad}` + (tarea.completada ? " tarea--completada" : "");
  li.dataset.id = tarea.id;

  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = tarea.completada;
  check.addEventListener("change", () => onToggle(tarea.id));

  const texto = document.createElement("span");
  texto.textContent = tarea.titulo;

  const borrar = document.createElement("button");
  borrar.textContent = "Eliminar";
  borrar.className = "btn-eliminar";
  borrar.addEventListener("click", () => onEliminar(tarea.id));

  li.append(check, texto, borrar);
  
  if (notaText) {
    const nota = document.createElement("div");
    nota.textContent = `Nota: ${notaText}`;
    nota.style.fontSize = "0.85em";
    nota.style.color = "gray";
    nota.style.width = "100%";
    li.append(nota);
  }
  
  contenedor.append(li);
};
