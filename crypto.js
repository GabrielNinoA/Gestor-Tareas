export async function derivarClaveDesdeContrasena(contrasena, sal) {
  const materialBase = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(contrasena),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sal, iterations: 100000, hash: 'SHA-256' },
    materialBase,
    { name: 'AES-GCM', length: 256 },
    false, // no exportable
    ['encrypt', 'decrypt']
  );
}

export async function cifrarTexto(clave, texto) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = new TextEncoder().encode(texto);
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, datos);
  return { cifrado, iv };
}

export async function descifrarTexto(clave, { cifrado, iv }) {
  const datos = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, clave, cifrado);
  return new TextDecoder().decode(datos);
}
