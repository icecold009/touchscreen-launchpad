import { normalizePattern } from "./sequencer.js";

const MAX_RENDER_BARS = 16;
const MAX_RENDER_SECONDS = 64;
const MAX_RENDER_BYTES = 64 * 1024 * 1024;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeRenderOptions(candidate = {}) {
  const bpm = clamp(Number(candidate.bpm) || 120, 60, 200);
  const bars = clamp(Math.round(Number(candidate.bars) || 1), 1, MAX_RENDER_BARS);
  const sampleRate = clamp(Math.round(Number(candidate.sampleRate) || 44100), 22050, 96000);
  const channels = clamp(Math.round(Number(candidate.channels) || 2), 1, 2);
  const seconds = bars * (60 / bpm) * 4;
  return {
    bpm,
    bars,
    sampleRate,
    channels,
    seconds: Math.min(MAX_RENDER_SECONDS, seconds),
  };
}

export function estimateRenderBytes(options = {}) {
  const normalized = normalizeRenderOptions(options);
  return Math.ceil(normalized.seconds * normalized.sampleRate * normalized.channels * 2 + 44);
}

export function createPerformanceEvents({ scene, bpm = 120, bars = 1, trackIndex = null } = {}) {
  const normalized = normalizePattern(scene?.pattern);
  const options = normalizeRenderOptions({ bpm, bars });
  const stepDuration = 60 / options.bpm / 4;
  const events = [];
  for (let bar = 0; bar < options.bars; bar += 1) {
    normalized.tracks.forEach((track, currentTrackIndex) => {
      if (trackIndex !== null && currentTrackIndex !== trackIndex) return;
      track.steps.forEach((step, stepIndex) => {
        if (!step.on) return;
        const swing = stepIndex % 2 === 1 ? normalized.swing * stepDuration : 0;
        const at = Math.max(0, (bar * 16 + stepIndex) * stepDuration + swing + step.microTiming * stepDuration);
        events.push({
          bar,
          step: stepIndex,
          trackIndex: currentTrackIndex,
          trackId: track.id,
          padIndex: track.padIndex,
          at,
          duration: Math.max(0.001, stepDuration * 0.75),
          velocity: clamp(0.5 + step.probability * 0.5, 0.5, 1),
          probability: step.probability,
        });
      });
    });
  }
  return events.sort((left, right) => left.at - right.at || left.trackIndex - right.trackIndex || left.padIndex - right.padIndex);
}

export function createPerformanceLog({ scenes = [], pads = [], bpm = 120, bars = 1, masterEffects = {} } = {}) {
  const options = normalizeRenderOptions({ bpm, bars });
  return {
    schema: "touchscreen-launchpad.performance-log",
    version: 1,
    options,
    masterEffects: { ...masterEffects },
    pads: pads.slice(0, 16).map((pad, index) => ({
      index,
      id: pad?.id ?? index + 1,
      name: typeof pad?.label === "string" ? pad.label : "",
      sampleId: pad?.sampleId || null,
    })),
    scenes: scenes.slice(0, 2).map((scene, index) => ({
      id: scene?.id || `scene-${index + 1}`,
      name: scene?.name || `Scene ${index === 0 ? "A" : "B"}`,
      events: createPerformanceEvents({ scene, bpm: options.bpm, bars: options.bars }),
    })),
  };
}

export function isRenderWithinGuardrails(options = {}) {
  return estimateRenderBytes(options) <= MAX_RENDER_BYTES;
}

export async function checksumBytes(bytes) {
  if (!globalThis.crypto?.subtle) return "unavailable";
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
