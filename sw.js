const CACHE_NAME = "touchscreen-launchpad-v35";
const CACHE_PREFIX = "touchscreen-launchpad-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?version=35",
  "./src/bootstrap.js?version=35",
  "./app.js?version=35",
  "./src/history.js?version=35",
  "./src/input-adapter.js?version=35",
  "./src/migrations.js?version=35",
  "./src/pointer-state.js?version=35",
  "./src/storage-request.js?version=35",
  "./src/download.js?version=35",
  "./src/performance-engine.js?version=35",
  "./src/recording.js?version=35",
  "./src/sample-editor.js?version=35",
  "./src/sequencer.js?version=35",
  "./src/transport.js?version=35",
  "./src/voice-registry.js?version=35",
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
