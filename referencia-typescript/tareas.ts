// tareas.ts — versión tipada de referencia (Sesiones 9 a 14: interfaces, tipos
// literales, genéricos y modo estricto). La app en sí corre con tareas.js
// (JavaScript, sin paso de compilación); este archivo queda como el cierre
// del Bloque 2 tal como se entregó al final de la Sesión 14.

export type Prioridad = "baja" | "media" | "alta";

export interface Tarea {
  id: string;
  titulo: string;
  prioridad: Prioridad;
  completada: boolean;
  fechaCreacion: string;
}

export const crearTarea = (titulo: string, prioridad: Prioridad = "media"): Tarea => ({
  id: crypto.randomUUID(),
  titulo,
  prioridad,
  completada: false,
  fechaCreacion: new Date().toISOString(),
});

export const cargarTareas = (): Promise<Tarea[]> =>
  new Promise((resolve) => {
    const guardadas = localStorage.getItem("electiva-pwa-tareas");
    resolve(guardadas ? (JSON.parse(guardadas) as Tarea[]) : []);
  });

export function iniciar(): void {
  cargarTareas().then((tareas) => console.log(tareas));
}
