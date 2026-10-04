// app.js — punto de entrada: conecta tareas.js con el DOM. Sesión 8 (módulos).
import { crearTarea, renderizarTarea } from "./tareas.js";
import { abrirBaseDeDatos, agregarTareaBD, eliminarTareaBD, obtenerTodasLasTareasBD, guardarConfigBD, obtenerConfigBD } from "./db.js";
import { derivarClaveDesdeContrasena, cifrarTexto, descifrarTexto } from "./crypto.js";

let db;
let claveActual = null;
let tareas = [];

const listaEl = document.getElementById("lista-tareas");
const formEl = document.getElementById("form-tarea");
const inputTituloEl = document.getElementById("input-titulo");
const inputPrioridadEl = document.getElementById("input-prioridad");
const inputPasswordEl = document.getElementById("input-password");
const inputNotaEl = document.getElementById("input-nota");

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

const pintarTodo = async () => {
  listaEl.innerHTML = "";
  tareas = await obtenerTodasLasTareasBD(db);
  
  for (const tarea of tareas) {
    let notaDescifrada = "";
    if (claveActual && tarea.notaCifrada) {
        try {
            notaDescifrada = await descifrarTexto(claveActual, { cifrado: tarea.notaCifrada, iv: tarea.notaIv });
        } catch (e) {
            notaDescifrada = "[Error al descifrar: Contraseña incorrecta o cambiada]";
        }
    } else if (tarea.notaCifrada) {
        notaDescifrada = "[Nota cifrada - Ingrese contraseña para ver]";
    }

    renderizarTarea(tarea, listaEl, {
      onToggle: alternarCompletada,
      onEliminar: eliminarTarea,
    }, notaDescifrada);
  }
};

async function alternarCompletada(id) {
  const tarea = tareas.find((t) => t.id === id);
  if (tarea) {
      tarea.completada = !tarea.completada;
      await agregarTareaBD(db, tarea);
      pintarTodo();
  }
}

async function eliminarTarea(id) {
  await eliminarTareaBD(db, id);
  pintarTodo();
}

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

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then(reg => console.log('SW registrado:', reg.scope))
    .catch(err => console.error('Error al registrar SW:', err));
}

window.addEventListener('online', () => document.getElementById('indicador-conexion').hidden = true);
window.addEventListener('offline', () => document.getElementById('indicador-conexion').hidden = false);
if (!navigator.onLine) {
  document.getElementById('indicador-conexion').hidden = false;
}

let deferredPrompt;
const btnInstalar = document.getElementById('btn-instalar');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  btnInstalar.hidden = false;
});

btnInstalar.addEventListener('click', async () => {
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  btnInstalar.hidden = true;
});
