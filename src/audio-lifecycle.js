const AUDIO_CONTEXT_STATES = new Set(["suspended", "running", "closed"]);

export function normalizeAudioContextState(state) {
  return AUDIO_CONTEXT_STATES.has(state) ? state : "unavailable";
}

export function describeAudioState(state, { sampleRate, baseLatency } = {}) {
  const normalized = normalizeAudioContextState(state);
  if (normalized === "running") {
    const rate = Number.isFinite(Number(sampleRate)) ? ` · ${Math.round(Number(sampleRate))} Hz` : "";
    const latency = Number.isFinite(Number(baseLatency)) ? ` · ${Math.round(Number(baseLatency) * 1000)} ms latency` : "";
    return `running${rate}${latency}`;
  }
  if (normalized === "suspended") return "suspended · interact to resume";
  if (normalized === "closed") return "closed · reload required";
  return "unavailable · Web Audio not supported";
}

export function hasLiveMediaTracks(stream) {
  if (!stream || typeof stream.getTracks !== "function") return false;
  return stream.getTracks().some((track) => track?.readyState === "live");
}
