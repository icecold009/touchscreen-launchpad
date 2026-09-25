const CACHE_NAME = "touchscreen-launchpad-v80";
const CACHE_PREFIX = "touchscreen-launchpad-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?version=79",
  "./src/bootstrap.js?version=76",
  "./app.js?version=76",
  "./src/history.js?version=76",
  "./src/input-adapter.js?version=76",
  "./src/migrations.js?version=76",
  "./src/pointer-state.js?version=76",
  "./src/storage-request.js?version=76",
  "./src/storage/indexed-db.js?version=76",
  "./src/storage/local-settings.js?version=76",
  "./src/download.js?version=76",
  "./src/effects.js?version=76",
  "./src/midi.js?version=76",
  "./src/midi-file.js?version=76",
  "./src/audio-lifecycle.js?version=76",
  "./src/clocked-sequencer.js?version=76",
  "./src/performance-engine.js?version=76",
  "./src/recording.js?version=76",
  "./src/sample-editor.js?version=76",
  "./src/sequencer.js?version=76",
  "./src/slices.js?version=76",
  "./src/transport.js?version=76",
  "./src/voice-registry.js?version=76",
  "./src/wav.js?version=76",
  "./src/sample-library.js?version=76",
  "./src/performance-export.js?version=76",
  "./src/arrangement.js?version=76",
  "./manifest.webmanifest",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  );
});

async function fetchNavigation(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response?.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(CACHE_NAME);
    return (await cache.match(request)) || cache.match("./index.html") || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const isNavigationRequest = event.request.mode === "navigate" || event.request.destination === "document";

  event.respondWith(
    isNavigationRequest
      ? fetchNavigation(event.request)
      : caches.open(CACHE_NAME)
        .then((cache) => cache.match(event.request))
        .then((cachedResponse) => cachedResponse || fetch(event.request))
        .catch(() => Response.error()),
  );
});
