/* Pasape service worker — escrito a mano (bundler-agnóstico, funciona con
 * Turbopack). Solo runtime caching: cachea el shell + assets a medida que el
 * usuario visita online, para que la wallet cargue offline. Los datos los aporta
 * la persistencia de React Query y el QR firma local. Conserva las reglas del
 * modo puerta (scanning NetworkOnly, scan-cache NetworkFirst). */

const VERSION = "pasape-sw-v2";
const SHELL = VERSION + "-shell"; // navegaciones (HTML/RSC)
const ASSETS = VERSION + "-assets"; // js/css/fuentes/imágenes same-origin
const IMAGES = VERSION + "-images"; // imágenes cross-origin (Supabase Storage)
const SCAN = VERSION + "-scan"; // lista offline del portero
// Respaldo de la wallet (usuario + entradas) a nivel SW: red primero, cae al
// último snapshot cacheado si no hay red. La persistencia de React Query en
// IndexedDB ya cubre esto, pero esta capa cubre el primer render offline antes
// de que esa persistencia termine de hidratar. Se borra en logout (ver mensaje
// CLEAR_WALLET_CACHE) para no filtrar entradas de una cuenta a otra en el mismo
// device.
const WALLET = VERSION + "-wallet";

// Tope de imágenes cacheadas (flyers/covers/avatares). LRU simple: al pasarse,
// se borran las más antiguas. ~120 cubre la wallet + el home sin inflar disco.
const IMAGES_MAX = 120;

self.addEventListener("install", () => self.skipWaiting());

// Logout: borra el snapshot de wallet cacheado para que no quede visible si
// otra persona inicia sesión después en el mismo device/navegador.
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_WALLET_CACHE") {
    event.waitUntil(caches.delete(WALLET));
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

const isAsset = (url) =>
  /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|gif|svg|ico)$/.test(url.pathname);

// ¿La request es una imagen? destination "image" cubre <img>; el regex y la ruta
// de Supabase Storage cubren casos donde el destination no llega.
const isImageReq = (req, url) =>
  req.destination === "image" ||
  /\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(url.pathname) ||
  url.pathname.includes("/storage/v1/object/");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Imágenes cross-origin (covers/flyers de Supabase Storage): cache-first +
  // LRU, para que la wallet/home muestren sus imágenes OFFLINE. Cada subida
  // tiene ruta única, así que cache-first no sirve algo desactualizado.
  if (url.origin !== self.location.origin) {
    if (isImageReq(req, url)) {
      event.respondWith(cacheFirst(req, IMAGES, IMAGES_MAX));
    }
    return; // cualquier otro cross-origin no lo maneja el SW
  }

  // Nunca cachear admisiones del portero.
  if (url.pathname.startsWith("/api/scanning")) return;

  // Lista offline del portero: network-first.
  if (/\/api\/events\/[^/]+\/scan-cache/.test(url.pathname)) {
    event.respondWith(networkFirst(req, SCAN, 5000));
    return;
  }

  // Wallet (identidad + entradas + carrusel): network-first, cae al último snapshot
  // cacheado offline. Respaldo de la persistencia de React Query — ver nota
  // junto a WALLET arriba.
  if (
    url.pathname === "/api/identity/me" ||
    /^\/api\/tickets\/[^/]+$/.test(url.pathname) ||
    /^\/api\/tickets\/[^/]+\/carousel-scope$/.test(url.pathname)
  ) {
    event.respondWith(networkFirst(req, WALLET, 4000));
    return;
  }

  // El resto de /api NO lo maneja el SW: los datos privados viajan por la
  // persistencia de React Query (IndexedDB), no por la cache del SW.
  if (url.pathname.startsWith("/api/")) return;

  // Assets estáticos: stale-while-revalidate.
  if (isAsset(url)) {
    event.respondWith(staleWhileRevalidate(req, ASSETS));
    return;
  }

  // Navegaciones + RSC: network-first con fallback al shell cacheado (offline).
  if (req.mode === "navigate" || req.headers.get("RSC") === "1") {
    event.respondWith(networkFirst(req, SHELL, 3000));
  }
});

async function networkFirst(req, cacheName, timeoutMs) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await withTimeout(fetch(req), timeoutMs);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw e;
  }
}

async function cacheFirst(req, cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached; // disponible offline al instante
  // Imágenes cross-origin sin CORS responden "opaque" (status 0): igual se
  // cachean y el <img> las pinta bien.
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) {
    await cache.put(req, res.clone());
    void trimCache(cacheName, maxEntries);
  }
  return res;
}

// LRU simple: cache.keys() devuelve en orden de inserción; borra las más viejas.
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  for (const k of keys.slice(0, keys.length - maxEntries)) await cache.delete(k);
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetching = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await fetching) || fetch(req);
}

function withTimeout(promise, ms) {
  if (!ms) return promise;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
}
