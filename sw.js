const CACHE_NAME = "touchscreen-launchpad-v117";
const CACHE_PREFIX = "touchscreen-launchpad-";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css?version=106",
  "./src/bootstrap.js?version=105",
  "./app.js?version=105",
  "./src/history.js?version=105",
  "./src/input-adapter.js?version=105",
  "./src/migrations.js?version=105",
  "./src/pointer-state.js?version=105",
  "./src/storage-request.js?version=105",
  "./src/storage/indexed-db.js?version=105",
  "./src/storage/local-settings.js?version=105",
  "./src/download.js?version=105",
  "./src/effects.js?version=105",
  "./src/midi.js?version=105",
  "./src/midi-file.js?version=105",
  "./src/audio-lifecycle.js?version=105",
  "./src/clocked-sequencer.js?version=105",
  "./src/performance-engine.js?version=105",
  "./src/recording.js?version=105",
  "./src/sample-editor.js?version=105",
  "./src/sequencer.js?version=105",
  "./src/slices.js?version=105",
  "./src/stem-pad-map.js?version=105",
  "./src/stem-separation.js?version=105",
  "./src/transport.js?version=105",
  "./src/voice-registry.js?version=105",
  "./src/wav.js?version=105",
  "./src/sample-library.js?version=105",
  "./src/performance-export.js?version=105",
  "./src/arrangement.js?version=105",
  "./vendor/stem-separation-engine.js?version=105",
  "./vendor/htdemucs-separation-engine.js?version=105",
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
  const isStemRuntimeAsset = new URL(event.request.url).pathname.includes("/vendor/ort/");

  event.respondWith(
    isNavigationRequest
      ? fetchNavigation(event.request)
      : fetchAsset(event.request, isStemRuntimeAsset).catch(() => Response.error()),
  );
});

async function fetchAsset(request, cacheStemRuntimeAsset) {
  const cache = await caches.open(CACHE_NAME).catch(() => null);
  const cachedResponse = await cache?.match(request).catch(() => null);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);
  if (cacheStemRuntimeAsset && cache && response.ok) {
    try {
      await cache.put(request, response.clone());
    } catch {
      // A runtime asset stays usable when browser cache quota is exhausted.
    }
  }
  return response;
}
