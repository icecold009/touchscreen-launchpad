export const PERFORMANCE_TRIGGER_MODES = Object.freeze(["trigger", "gate", "hold", "retrigger", "repeat", "echo"]);
export const PERFORMANCE_QUANTIZE_GRIDS = Object.freeze(["off", "beat", "eighth", "sixteenth", "thirtysecond", "bar", "phrase"]);

export function normalizePerformanceSettings(pad = {}) {
  return {
    triggerMode: PERFORMANCE_TRIGGER_MODES.includes(pad.triggerMode) ? pad.triggerMode : "trigger",
    launchQuantize: PERFORMANCE_QUANTIZE_GRIDS.includes(pad.launchQuantize) ? pad.launchQuantize : "off",
    stopQuantize: PERFORMANCE_QUANTIZE_GRIDS.includes(pad.stopQuantize) ? pad.stopQuantize : "off",
    chokeGroup: typeof pad.chokeGroup === "string" && pad.chokeGroup.trim() ? pad.chokeGroup.trim().slice(0, 32) : null,
    muteGroup: typeof pad.muteGroup === "string" && pad.muteGroup.trim() ? pad.muteGroup.trim().slice(0, 32) : null,
    linkGroup: typeof pad.linkGroup === "string" && pad.linkGroup.trim() ? pad.linkGroup.trim().slice(0, 32) : null,
  };
}

export function getGroupPeers(pads, index, groupKey) {
  const group = normalizePerformanceSettings(pads[index] || {})[groupKey];
  if (!group) return [];
  return pads
    .map((pad, padIndex) => ({ pad, padIndex }))
    .filter(({ padIndex, pad }) => padIndex !== index && normalizePerformanceSettings(pad)[groupKey] === group)
    .map(({ padIndex }) => padIndex);
}

export function shouldReleaseOnPointer(mode) {
  return mode === "gate" || mode === "hold";
}

export function getRepeatIntervalMs(bpm, subdivision = "sixteenth") {
  const safeBpm = Math.min(Math.max(Number(bpm) || 120, 20), 400);
  const beatMs = 60_000 / safeBpm;
  const factor = subdivision === "eighth" ? 0.5 : subdivision === "thirtysecond" ? 0.125 : 0.25;
  return Math.max(20, beatMs * factor);
}

export function getCountInBeatCount(bars, beatsPerBar = 4) {
  return Math.max(0, Math.min(4, Math.round(Number(bars) || 0))) * Math.max(1, Math.round(Number(beatsPerBar) || 4));
}
