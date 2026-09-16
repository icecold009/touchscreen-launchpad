const CACHE_NAME = "touchscreen-launchpad-v45";
const CACHE_PREFIX = "touchscreen-launchpad-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?version=45",
  "./src/bootstrap.js?version=45",
  "./app.js?version=45",
  "./src/history.js?version=45",
  "./src/input-adapter.js?version=45",
  "./src/migrations.js?version=45",
  "./src/pointer-state.js?version=45",
  "./src/storage-request.js?version=45",
  "./src/download.js?version=45",
  "./src/effects.js?version=45",
  "./src/midi.js?version=45",
  "./src/midi-file.js?version=45",
  "./src/audio-lifecycle.js?version=45",
  "./src/clocked-sequencer.js?version=45",
  "./src/performance-engine.js?version=45",
  "./src/recording.js?version=45",
  "./src/sample-editor.js?version=45",
  "./src/sequencer.js?version=45",
  "./src/slices.js?version=45",
  "./src/transport.js?version=45",
  "./src/voice-registry.js?version=45",
  "./src/wav.js?version=45",
  "./src/sample-library.js?version=45",
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
