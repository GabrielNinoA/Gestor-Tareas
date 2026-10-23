module.exports = {
  globDirectory: '.',
  globPatterns: [
    'index.html',
    'manifest.json',
    'css/*.css',
    '*.js',
    'icons/*.png',
  ],
  // sw-propio.js es el CÓDIGO FUENTE del SW: no debe precachearse a sí mismo.
  globIgnores: [
    'node_modules/**/*',
    'servidor/**/*',
    'lib/**/*',
    'workbox-config.js',
    'sw-propio.js',
    'sw.js.map',
    'claves-vapid.json',
    'datos.json',
    'referencia-typescript/**/*',
  ],
  swSrc: 'sw-propio.js',
  swDest: 'sw.js',
};
