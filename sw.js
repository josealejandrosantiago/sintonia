// Service worker: abre la app al instante y guarda los catálogos consultados.
// Nunca guarda películas ni audio: esos archivos siempre van directo a su fuente.
const VERSION = 'sintonia-1';
const CASCARON = `${VERSION}-app`;
const CATALOGOS = `${VERSION}-catalogos`;
const MAX_CATALOGOS = 160;

const ARCHIVOS = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/ui.js', 'js/almacen.js', 'js/fuentes.js', 'js/curaduria.js', 'js/reproductor.js',
  'fuentes/bricolage.woff2', 'iconos/icono-192.png', 'iconos/icono-512.png', 'iconos/maskable-512.png', 'iconos/apple-touch.png',
];

const esCatalogo = (u) =>
  (u.hostname === 'archive.org' && (u.pathname.startsWith('/advancedsearch') || u.pathname.startsWith('/metadata/'))) ||
  u.hostname === 'images-api.nasa.gov' ||
  u.hostname === 'api.openverse.org' ||
  u.hostname.endsWith('.radio-browser.info') ||
  u.hostname === 'sepiasearch.org' ||
  u.hostname === 'itunes.apple.com';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CASCARON).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function recortar(cache) {
  const claves = await cache.keys();
  for (const k of claves.slice(0, Math.max(0, claves.length - MAX_CATALOGOS))) await cache.delete(k);
}

// Responde con lo guardado y actualiza por detrás.
async function guardadoYActualizar(req, nombre, evento) {
  const cache = await caches.open(nombre);
  const previo = await cache.match(req, { ignoreVary: true });
  const fresco = fetch(req).then(async (r) => {
    if (r.ok && r.type !== 'opaque') {
      await cache.put(req, r.clone());
      if (nombre === CATALOGOS) await recortar(cache);
    }
    return r;
  });
  if (previo) {
    evento.waitUntil(fresco.catch(() => {}));
    return previo;
  }
  return fresco;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      e.respondWith(guardadoYActualizar(new Request('index.html'), CASCARON, e).catch(() => caches.match('index.html')));
    } else {
      e.respondWith(guardadoYActualizar(req, CASCARON, e));
    }
    return;
  }
  if (esCatalogo(url)) e.respondWith(guardadoYActualizar(req, CATALOGOS, e));
});
