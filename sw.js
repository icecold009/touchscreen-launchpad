const CACHE_NAME = "touchscreen-launchpad-v47";
const CACHE_PREFIX = "touchscreen-launchpad-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?version=47",
  "./src/bootstrap.js?version=47",
  "./app.js?version=47",
  "./src/history.js?version=47",
  "./src/input-adapter.js?version=47",
  "./src/migrations.js?version=47",
  "./src/pointer-state.js?version=47",
  "./src/storage-request.js?version=47",
  "./src/download.js?version=47",
  "./src/effects.js?version=47",
  "./src/midi.js?version=47",
  "./src/midi-file.js?version=47",
  "./src/audio-lifecycle.js?version=47",
  "./src/clocked-sequencer.js?version=47",
  "./src/performance-engine.js?version=47",
  "./src/recording.js?version=47",
  "./src/sample-editor.js?version=47",
  "./src/sequencer.js?version=47",
  "./src/slices.js?version=47",
  "./src/transport.js?version=47",
  "./src/voice-registry.js?version=47",
  "./src/wav.js?version=47",
  "./src/sample-library.js?version=47",
  "./src/performance-export.js?version=47",
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
