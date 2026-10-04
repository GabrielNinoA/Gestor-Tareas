module.exports = {
  globDirectory: '.',
  globPatterns: [
    'index.html',
    'manifest.json',
    'css/*.css',
    '*.js',
    'icons/*.png'
  ],
  globIgnores: [
    'node_modules/**/*',
    'workbox-config.js',
    'package*.json'
  ],
  swDest: 'sw.js',
  runtimeCaching: [
    {
      urlPattern: /\/icons\//,
      handler: 'CacheFirst',
      options: {
        cacheName: 'imagenes',
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: ({ request }) => ['document', 'script', 'style'].includes(request.destination),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'shell',
      },
    }
  ]
};
