export function isHtdemucsBackendUnavailable(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Could not find an implementation for|provider type for .+ is not set|std::bad_alloc|no available backend found|webgpuInit is not a function/i.test(message);
}

export function separateSongWithLocalEngine(channels, { model = "htdemucs", onProgress = () => {} } = {}) {
  if (!Array.isArray(channels) || channels.length !== 2 || channels.some((channel) => !(channel instanceof Float32Array))) {
    return Promise.reject(new TypeError("A decoded stereo song is required for stem separation."));
  }

  return new Promise((resolve, reject) => {
    let worker;
    try {
      const workerUrl = model === "spleeter"
        ? new URL("../vendor/stem-separation-engine.js?version=105", import.meta.url)
        : new URL("../vendor/htdemucs-separation-engine.js?version=105", import.meta.url);
      worker = new Worker(workerUrl, { type: "module" });
    } catch (error) {
      reject(error instanceof Error ? error : new Error("The local stem engine could not start."));
      return;
    }

    const finish = (callback, value) => {
      worker.terminate();
      callback(value);
    };
    worker.addEventListener("message", (event) => {
      const message = event.data;
      if (message?.type === "progress") {
        onProgress({ value: message.value, text: message.text });
      } else if (message?.type === "complete" && Array.isArray(message.stems)) {
        finish(resolve, message.stems);
      } else if (message?.type === "error") {
        finish(reject, new Error(message.message || "The song could not be separated."));
      }
    });
    worker.addEventListener("error", (event) => {
      event.preventDefault();
      finish(reject, new Error("The local stem engine failed to load. Reload the site and try again."));
    });
    worker.postMessage({ type: "separate", channels, sampleRate: 44100 }, channels.map((channel) => channel.buffer));
  });
}
