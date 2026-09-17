const CACHE_NAME = "touchscreen-launchpad-v59";
const CACHE_PREFIX = "touchscreen-launchpad-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?version=59",
  "./src/bootstrap.js?version=59",
  "./app.js?version=59",
  "./src/history.js?version=59",
  "./src/input-adapter.js?version=59",
  "./src/migrations.js?version=59",
  "./src/pointer-state.js?version=59",
  "./src/storage-request.js?version=59",
  "./src/download.js?version=59",
  "./src/effects.js?version=59",
  "./src/midi.js?version=59",
  "./src/midi-file.js?version=59",
  "./src/audio-lifecycle.js?version=59",
  "./src/clocked-sequencer.js?version=59",
  "./src/performance-engine.js?version=59",
  "./src/recording.js?version=59",
  "./src/sample-editor.js?version=59",
  "./src/sequencer.js?version=59",
  "./src/slices.js?version=59",
  "./src/transport.js?version=59",
  "./src/voice-registry.js?version=59",
  "./src/wav.js?version=59",
  "./src/sample-library.js?version=59",
  "./src/performance-export.js?version=59",
  "./src/arrangement.js?version=59",
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
