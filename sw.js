const CACHE_NAME = "touchscreen-launchpad-v84";
const CACHE_PREFIX = "touchscreen-launchpad-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?version=83",
  "./src/bootstrap.js?version=77",
  "./app.js?version=77",
  "./src/history.js?version=77",
  "./src/input-adapter.js?version=77",
  "./src/migrations.js?version=77",
  "./src/pointer-state.js?version=77",
  "./src/storage-request.js?version=77",
  "./src/storage/indexed-db.js?version=77",
  "./src/storage/local-settings.js?version=77",
  "./src/download.js?version=77",
  "./src/effects.js?version=77",
  "./src/midi.js?version=77",
  "./src/midi-file.js?version=77",
  "./src/audio-lifecycle.js?version=77",
  "./src/clocked-sequencer.js?version=77",
  "./src/performance-engine.js?version=77",
  "./src/recording.js?version=77",
  "./src/sample-editor.js?version=77",
  "./src/sequencer.js?version=77",
  "./src/slices.js?version=77",
  "./src/transport.js?version=77",
  "./src/voice-registry.js?version=77",
  "./src/wav.js?version=77",
  "./src/sample-library.js?version=77",
  "./src/performance-export.js?version=77",
  "./src/arrangement.js?version=77",
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
