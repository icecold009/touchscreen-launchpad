const CACHE_NAME = "touchscreen-launchpad-v42";
const CACHE_PREFIX = "touchscreen-launchpad-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?version=42",
  "./src/bootstrap.js?version=42",
  "./app.js?version=42",
  "./src/history.js?version=42",
  "./src/input-adapter.js?version=42",
  "./src/migrations.js?version=42",
  "./src/pointer-state.js?version=42",
  "./src/storage-request.js?version=42",
  "./src/download.js?version=42",
  "./src/effects.js?version=42",
  "./src/midi.js?version=42",
  "./src/midi-file.js?version=42",
  "./src/audio-lifecycle.js?version=42",
  "./src/clocked-sequencer.js?version=42",
  "./src/performance-engine.js?version=42",
  "./src/recording.js?version=42",
  "./src/sample-editor.js?version=42",
  "./src/sequencer.js?version=42",
  "./src/slices.js?version=42",
  "./src/transport.js?version=42",
  "./src/voice-registry.js?version=42",
  "./src/wav.js?version=42",
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
