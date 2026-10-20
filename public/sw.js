// Momentum service worker.
// - Built assets: cache-first (their URLs are content-hashed).
// - Pages, RSC payloads and API reads: network-first, falling back to the last cached copy,
//   so the app opens and shows your data offline.
// - Writes are never cached here; the app queues them itself and syncs when back online.

const VERSION = "v2";
const STATIC = `momentum-static-${VERSION}`;
const RUNTIME = `momentum-runtime-${VERSION}`;
// Static, build-independent files only. Pages live in the runtime cache so a new deploy
// replaces them instead of an install-time copy shadowing them.
const SHELL = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
const NO_CACHE = ["/api/auth", "/api/backup"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC).then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url)))),
      caches.open(RUNTIME).then((cache) => cache.add("/").catch(() => null)),
    ]).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, RUNTIME].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC)).put(request, response.clone());
  return response;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    // Don't cache redirects to the login page or errors.
    if (response.ok && !response.redirected) (await caches.open(RUNTIME)).put(request, response.clone());
    return response;
  } catch (err) {
    const runtime = await caches.open(RUNTIME);
    const cached = (await runtime.match(request)) || (fallbackUrl && (await runtime.match(fallbackUrl)));
    if (cached) return cached;
    if (request.headers.get("accept")?.includes("application/json") || new URL(request.url).pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Offline" }), { status: 503, headers: { "Content-Type": "application/json" } });
    }
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NO_CACHE.some((p) => url.pathname.startsWith(p))) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/"));
  } else {
    event.respondWith(networkFirst(request));
  }
});
