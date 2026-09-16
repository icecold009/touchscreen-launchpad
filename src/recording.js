export const RECORDING_MIME_TYPES = Object.freeze([
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
]);

export const RECORDING_LIMITS = Object.freeze({
  maxDurationMs: 15 * 60 * 1000,
  maxBytes: 100 * 1024 * 1024,
});

export function chooseRecordingMimeType(RecorderClass = globalThis.MediaRecorder, candidates = RECORDING_MIME_TYPES) {
  if (!RecorderClass) return "";
  const isSupported = typeof RecorderClass.isTypeSupported !== "function"
    ? () => true
    : (type) => RecorderClass.isTypeSupported(type);
  return candidates.find((candidate) => isSupported(candidate)) || "";
}

export function formatRecordingTime(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds) / 1000) || 0);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function normalizeMarkers(value, durationMs) {
  if (!Array.isArray(value)) return [];
  const duration = Math.max(0, Number(durationMs) || 0);
  return value.slice(0, 64).map((marker, index) => ({
    id: typeof marker?.id === "string" && marker.id.length <= 80 ? marker.id : `marker-${index + 1}`,
    label: typeof marker?.label === "string" && marker.label.trim() ? marker.label.trim().slice(0, 40) : `Marker ${index + 1}`,
    atMs: Math.min(duration, Math.max(0, Number(marker?.atMs) || 0)),
  }));
}

export function normalizeTakeRecord(candidate) {
  if (!candidate || typeof candidate !== "object") return candidate;
  return {
    ...candidate,
    schemaVersion: 2,
    markers: normalizeMarkers(candidate.markers, candidate.durationMs),
  };
}

export function createTakeRecord({ id, blob, name, kitId, padIndex, durationMs = 0, markers = [], createdAt = new Date().toISOString() }) {
  if (!blob || typeof blob.size !== "number" || blob.size <= 0) {
    throw new Error("A recording did not contain audio data.");
  }
  if (blob.size > RECORDING_LIMITS.maxBytes) {
    throw new Error("This recording is too large to save safely.");
  }
  const safeName = String(name || "Launchpad take").trim().slice(0, 80) || "Launchpad take";
  return normalizeTakeRecord({
    id: String(id || `take-${Date.now()}`),
    schemaVersion: 2,
    name: safeName,
    mime: blob.type || "audio/*",
    size: blob.size,
    blob,
    kitId: typeof kitId === "string" ? kitId : null,
    padIndex: Number.isInteger(padIndex) && padIndex >= 0 ? padIndex : null,
    durationMs: Math.max(0, Number(durationMs) || 0),
    markers,
    createdAt,
  });
}

export function isValidTakeRecord(candidate) {
  return Boolean(
    candidate
      && typeof candidate.id === "string"
      && candidate.id.length <= 120
      && typeof candidate.name === "string"
      && candidate.name.trim()
      && typeof candidate.mime === "string"
      && Number.isFinite(candidate.size)
      && candidate.size > 0
      && candidate.size <= RECORDING_LIMITS.maxBytes
      && typeof candidate.blob?.arrayBuffer === "function"
      && Number.isFinite(candidate.blob.size)
      && candidate.blob.size === candidate.size
      && typeof candidate.createdAt === "string",
  );
}

export function createRecordingSession({
  RecorderClass = globalThis.MediaRecorder,
  now = () => Date.now(),
  onStateChange = () => {},
  maxDurationMs = RECORDING_LIMITS.maxDurationMs,
} = {}) {
  let recorder;
  let chunks = [];
  let startedAt = 0;
  let stopPromise;
  let durationTimer;
  let state = "idle";
  let cancelled = false;
  let pausedAt = 0;
  let pausedDuration = 0;
  let activeMaxDurationMs = RECORDING_LIMITS.maxDurationMs;

  function elapsed() {
    if (!startedAt) return 0;
    const end = state === "paused" ? pausedAt : now();
    return Math.max(0, end - startedAt - pausedDuration);
  }

  function emit(nextState, detail = {}) {
    state = nextState;
    onStateChange({ state, elapsedMs: elapsed(), ...detail });
  }

  function clearDurationTimer() {
    if (durationTimer !== undefined) clearTimeout(durationTimer);
    durationTimer = undefined;
  }

  function stopInternal() {
    if (!recorder || recorder.state === "inactive") return;
    if (state === "paused" && pausedAt) {
      pausedDuration += now() - pausedAt;
      pausedAt = 0;
    }
    if (state === "recording" || state === "paused") emit("stopping");
    recorder.stop();
  }

  function scheduleDurationTimer() {
    clearDurationTimer();
    const remaining = Math.max(1000, activeMaxDurationMs - elapsed());
    durationTimer = setTimeout(() => stopInternal(), remaining);
  }

  function start(stream, options = {}) {
    if (!RecorderClass) throw new Error("This browser does not support local audio recording.");
    if (state === "recording" || state === "stopping") throw new Error("A recording is already in progress.");
    if (!stream || typeof stream.getTracks !== "function") throw new Error("A microphone stream is required.");

    const mimeType = options.mimeType || chooseRecordingMimeType(RecorderClass);
    const recorderOptions = mimeType ? { mimeType } : undefined;
    try {
      recorder = new RecorderClass(stream, recorderOptions);
    } catch {
      throw new Error("This browser could not start an audio recording.");
    }
    const activeRecorder = recorder;
    cancelled = false;
    chunks = [];
    startedAt = now();
    pausedAt = 0;
    pausedDuration = 0;
    activeMaxDurationMs = Math.max(1000, Number(maxDurationMs) || RECORDING_LIMITS.maxDurationMs);
    stopPromise = new Promise((resolve, reject) => {
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) {
          const nextBytes = chunks.reduce((total, chunk) => total + chunk.size, 0) + event.data.size;
          if (nextBytes > RECORDING_LIMITS.maxBytes) {
            emit("error", { error: new Error("The recording reached its local size limit.") });
            try { activeRecorder.stop(); } catch { /* already stopping */ }
            return;
          }
          chunks.push(event.data);
        }
      });
      recorder.addEventListener("error", (event) => {
        clearDurationTimer();
        emit("error", { error: event.error || new Error("The audio recording failed.") });
        reject(event.error || new Error("The audio recording failed."));
      }, { once: true });
      recorder.addEventListener("stop", () => {
        clearDurationTimer();
        if (cancelled) {
          recorder = undefined;
          emit("idle");
          return;
        }
        const blob = new Blob(chunks, { type: activeRecorder.mimeType || mimeType || "audio/webm" });
        recorder = undefined;
        const finalState = blob.size ? "ready" : "error";
        emit(finalState, { blob, elapsedMs: Math.max(0, now() - startedAt) });
        if (blob.size) resolve(blob);
        else reject(new Error("The recording did not contain audio data."));
      }, { once: true });
      activeRecorder.start(250);
      emit("recording");
      scheduleDurationTimer();
    });
    return { mimeType: activeRecorder.mimeType || mimeType, startedAt };
  }

  function stop() {
    if (!recorder || (state !== "recording" && state !== "paused")) return Promise.reject(new Error("No recording is in progress."));
    stopInternal();
    return stopPromise;
  }

  function pause() {
    if (!recorder || state !== "recording") return false;
    if (typeof recorder.pause !== "function") throw new Error("This browser cannot pause local recording.");
    recorder.pause();
    pausedAt = now();
    clearDurationTimer();
    emit("paused");
    return true;
  }

  function resume() {
    if (!recorder || state !== "paused") return false;
    if (typeof recorder.resume !== "function") throw new Error("This browser cannot resume local recording.");
    recorder.resume();
    pausedDuration += Math.max(0, now() - pausedAt);
    pausedAt = 0;
    emit("recording");
    scheduleDurationTimer();
    return true;
  }

  function cancel() {
    clearDurationTimer();
    cancelled = true;
    chunks = [];
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch { /* already stopped */ }
    }
    recorder = undefined;
    stopPromise = undefined;
    startedAt = 0;
    pausedAt = 0;
    pausedDuration = 0;
    emit("idle");
  }

  return {
    cancel,
    get elapsedMs() { return elapsed(); },
    pause,
    resume,
    get state() {
      return state;
    },
    start,
    stop,
  };
}
