# Gestor de Tareas PWA

Este es un proyecto base de un Gestor de Tareas construido como una **Progressive Web App (PWA)** utilizando tecnologías web modernas (HTML, CSS y JavaScript Vanilla). A lo largo de diferentes sesiones se le han implementado capacidades avanzadas de PWA.

## Características Principales

*   **Gestión de Tareas**: Crea, marca como completadas y elimina tareas.
*   **Notas Privadas Encriptadas**: Las tareas pueden incluir una nota privada de forma opcional. Estas notas son **cifradas en el cliente (AES-GCM)** y la clave de cifrado se deriva dinámicamente mediante **PBKDF2** usando una contraseña proporcionada por el usuario.
*   **Almacenamiento Local (IndexedDB)**: Los datos no dependen del servidor. Se guardan localmente utilizando IndexedDB (con soporte para múltiples versiones de esquemas y cursores/índices) evitando las limitaciones síncronas de `localStorage`.
*   **Funcionamiento Sin Conexión (Offline)**: Gracias a su *Service Worker* dinámico, la aplicación seguirá funcionando sin conexión a internet.
*   **Estrategias de Caché**:
    *   **Cache First**: Para los íconos (que rara vez cambian).
    *   **Network First**: Ideal para APIs o datos que requieren estar actualizados siempre que haya conexión.
    *   **Stale-While-Revalidate**: Para los recursos de la capa principal de la app (HTML, CSS, JS), lo que permite que la app se cargue instantáneamente y se actualice en segundo plano para la próxima visita.

## Tecnologías y APIs Web Utilizadas

*   JavaScript ES6+ (Módulos).
*   **Service Worker API** + **Cache Storage API**.
*   **IndexedDB API** (Promisificada para el uso con `async/await`).
*   **Web Crypto API** (`crypto.subtle` y `crypto.getRandomValues`).

## Estructura de Archivos (Módulos)

*   `app.js`: Archivo principal. Coordina la interfaz de usuario con la base de datos y la criptografía. Registra el *Service Worker*.
*   `sw.js`: Archivo del *Service Worker* que maneja el ciclo de vida (install, activate) y enruta las peticiones de red (fetch) hacia distintas estrategias.
*   `db.js`: Módulo encargado de abrir la base de datos, gestionar migraciones de esquema y las operaciones CRUD contra IndexedDB.
*   `crypto.js`: Módulo encargado de derivar claves seguras a partir de una contraseña y aplicar el cifrado/descifrado seguro de los textos.
*   `tareas.js`: Archivo con la lógica para crear y renderizar los nodos de tarea en el DOM.

## Cómo ejecutarlo

Al ser una PWA que utiliza *Service Workers* y la *Web Crypto API* (la cual exige un contexto seguro), el proyecto **debe** ejecutarse a través de un servidor web y sobre `localhost` o `HTTPS`.

1. Abre una terminal en la ruta de este directorio.
2. Ejecuta un servidor local. Por ejemplo usando `npx`:
   ```bash
   npx serve .
   ```
   *Alternativamente con Python:* `python -m http.server 8000`
3. Abre el enlace proporcionado (por defecto `http://localhost:3000` o `http://localhost:8000`) en tu navegador web.

## Probando el cifrado

1. Añade una tarea nueva. Escribe un título, una nota privada (opcional) e ingresa una **contraseña**.
2. Refresca la página. Si no ingresaste tu contraseña en la sesión actual, la nota aparecerá ofuscada y dirá `[Nota cifrada - Ingrese contraseña para ver]`.
3. Ingresa tu contraseña en la casilla y vuelve a añadir una tarea; observarás cómo la nota anterior es descifrada instantáneamente ya que la clave criptográfica se ha podido volver a derivar.
