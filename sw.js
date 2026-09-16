const CACHE_NAME = "touchscreen-launchpad-v40";
const CACHE_PREFIX = "touchscreen-launchpad-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?version=40",
  "./src/bootstrap.js?version=40",
  "./app.js?version=40",
  "./src/history.js?version=40",
  "./src/input-adapter.js?version=40",
  "./src/migrations.js?version=40",
  "./src/pointer-state.js?version=40",
  "./src/storage-request.js?version=40",
  "./src/download.js?version=40",
  "./src/effects.js?version=40",
  "./src/midi.js?version=40",
  "./src/midi-file.js?version=40",
  "./src/audio-lifecycle.js?version=40",
  "./src/clocked-sequencer.js?version=40",
  "./src/performance-engine.js?version=40",
  "./src/recording.js?version=40",
  "./src/sample-editor.js?version=40",
  "./src/sequencer.js?version=40",
  "./src/transport.js?version=40",
  "./src/voice-registry.js?version=40",
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
