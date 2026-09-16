const CACHE_NAME = "touchscreen-launchpad-v36";
const CACHE_PREFIX = "touchscreen-launchpad-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?version=36",
  "./src/bootstrap.js?version=36",
  "./app.js?version=36",
  "./src/history.js?version=36",
  "./src/input-adapter.js?version=36",
  "./src/migrations.js?version=36",
  "./src/pointer-state.js?version=36",
  "./src/storage-request.js?version=36",
  "./src/download.js?version=36",
  "./src/midi.js?version=36",
  "./src/performance-engine.js?version=36",
  "./src/recording.js?version=36",
  "./src/sample-editor.js?version=36",
  "./src/sequencer.js?version=36",
  "./src/transport.js?version=36",
  "./src/voice-registry.js?version=36",
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

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const isNavigationRequest = event.request.mode === "navigate" || event.request.destination === "document";

  event.respondWith(
    caches.open(CACHE_NAME)
      .then((cache) => cache.match(event.request))
      .then((cachedResponse) => cachedResponse || fetch(event.request))
      .catch(() => isNavigationRequest
        ? caches.open(CACHE_NAME).then((cache) => cache.match("./index.html"))
        : Response.error()),
  );
});
