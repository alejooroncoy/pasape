/* Pasape service worker — escrito a mano (bundler-agnóstico, funciona con
 * Turbopack). Solo runtime caching: cachea el shell + assets a medida que el
 * usuario visita online, para que la wallet cargue offline. Los datos los aporta
 * la persistencia de React Query y el QR firma local. Conserva las reglas del
 * modo puerta (scanning NetworkOnly, scan-cache NetworkFirst). */

const VERSION = "pasape-sw-v1";
const SHELL = VERSION + "-shell"; // navegaciones (HTML/RSC)
const ASSETS = VERSION + "-assets"; // js/css/fuentes/imágenes
const SCAN = VERSION + "-scan"; // lista offline del portero

self.addEventListener("install", () => self.skipWaiting());

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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // solo same-origin

  // Nunca cachear admisiones del portero.
  if (url.pathname.startsWith("/api/scanning")) return;

  // Lista offline del portero: network-first.
  if (/\/api\/events\/[^/]+\/scan-cache/.test(url.pathname)) {
    event.respondWith(networkFirst(req, SCAN, 5000));
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
