// test_push_servidor.js — Verificación de las capacidades del servidor Web Push (Sesión 26).
import http from 'node:http';
import fs from 'node:fs';
import webpush from 'web-push';

async function ejecutarPruebas() {
  console.log('Iniciando prueba de servidor Web Push...');
  
  // 1. Probar clave pública
  const resClave = await fetch('http://localhost:3000/api/clave-publica');
  const jsonClave = await resClave.json();
  console.log('1. Obtener clave pública:', jsonClave.clave ? 'PASS' : 'FAIL');

  // 2. Suscripción incompleta (debe dar 400)
  const resIncompleta = await fetch('http://localhost:3000/api/suscribir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: 'https://fake-endpoint.com/sub' }), // sin keys
  });
  console.log('2. Suscripción incompleta (400):', resIncompleta.status === 400 ? 'PASS' : 'FAIL');

  // 3. Suscripción simulada con claves válidas
  const subSimulada = {
    endpoint: 'https://fake-push-service.local/ep/12345',
    keys: {
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    },
  };

  const resSub = await fetch('http://localhost:3000/api/suscribir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subSimulada),
  });
  const jsonSub = await resSub.json();
  console.log('3. Suscripción exitosa (201):', resSub.status === 201 && jsonSub.ok ? 'PASS' : 'FAIL');

  // 4. Enviar prueba (el endpoint simulado fallará por no ser real, pero el servidor manejará el resultado sin colgarse)
  const resEnvio = await fetch('http://localhost:3000/api/enviar-prueba', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titulo: 'Test Push',
      cuerpo: 'Mensaje de verificación',
      url: '/index.html',
    }),
  });
  const jsonEnvio = await resEnvio.json();
  console.log('4. Endpoint enviar-prueba responde (200):', resEnvio.status === 200 ? 'PASS' : 'FAIL', jsonEnvio);

  // 5. Desuscribir
  const resDesub = await fetch('http://localhost:3000/api/desuscribir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subSimulada.endpoint }),
  });
  const jsonDesub = await resDesub.json();
  console.log('5. Desuscripción limpia (200):', resDesub.status === 200 && jsonDesub.ok ? 'PASS' : 'FAIL');

  console.log('Todas las pruebas del protocolo Push del servidor completadas.');
}

// Iniciar servidor temporalmente para la prueba
import('./server.js').then(() => {
  setTimeout(async () => {
    try {
      await ejecutarPruebas();
      process.exit(0);
    } catch (err) {
      console.error('Error durante las pruebas:', err);
      process.exit(1);
    }
  }, 1000);
});
