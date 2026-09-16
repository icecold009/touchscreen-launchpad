const DEFAULT_COLORS = [
  "#f7b7bd", "#f8c6aa", "#f4e6a8", "#b7e3d0",
  "#f8dcaa", "#c6e6c8", "#bce4e3", "#c5c6ed",
  "#bde9c5", "#b9dced", "#d4c9ed", "#e0c8ec",
  "#c1cef2", "#d6cbed", "#e4d0ea", "#e7c8df",
];
const DEFAULT_KEYS = ["Q", "W", "E", "R", "A", "S", "D", "F", "Z", "X", "C", "V", "1", "2", "3", "4"];
const QUANTIZE_GRIDS = new Set(["off", "beat", "eighth", "sixteenth", "thirtysecond", "bar", "phrase"]);
const TRIGGER_MODES = new Set(["trigger", "gate", "hold", "loop", "retrigger", "repeat", "echo"]);
const MAPPING_MODES = new Set(["single", "velocity16", "chromatic16"]);

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeGroup(value) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 32) : null;
}

function normalizeLayerIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => typeof id === "string" && id.length <= 128))].slice(0, 4);
}

export function createDefaultPad(index, { padColors = DEFAULT_COLORS, keyboardKeys = DEFAULT_KEYS } = {}) {
  return {
    id: index + 1,
    label: "",
    key: keyboardKeys[index] || String(index + 1),
    color: padColors[index] || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    mode: "oneshot",
    volume: 0.8,
    sampleId: null,
    schemaVersion: 2,
    triggerMode: "trigger",
    mappingMode: "single",
    launchQuantize: "off",
    stopQuantize: "off",
    chokeGroup: null,
    muteGroup: null,
    linkGroup: null,
    layerIds: [],
    sampleRegion: { start: 0, end: 1, loopStart: 0, loopEnd: 1, reverse: false },
    pitchCents: 0,
    timeStretch: 1,
    attack: 0.005,
    release: 0.015,
    pan: 0,
    filter: { type: "lowpass", frequency: 20000, q: 0 },
    effectSends: { reverb: 0, delay: 0 },
  };
}

export function normalizePadDefinition(candidate, index, options = {}) {
  const fallback = createDefaultPad(index, options);
  const value = candidate && typeof candidate === "object" ? candidate : {};
  const candidateKey = typeof value.key === "string" ? value.key.trim().slice(0, 1).toUpperCase() : "";
  const candidateColor = typeof value.color === "string" && /^#[\da-f]{6}$/i.test(value.color) ? value.color : fallback.color;
  const candidateVolume = Number(value.volume);
  const region = value.sampleRegion && typeof value.sampleRegion === "object" ? value.sampleRegion : {};
  const filter = value.filter && typeof value.filter === "object" ? value.filter : {};
  const sends = value.effectSends && typeof value.effectSends === "object" ? value.effectSends : {};
  const sampleStart = Number(region.start);
  const sampleEnd = Number(region.end);
  const loopStart = Number(region.loopStart);
  const loopEnd = Number(region.loopEnd);
  const normalizedStart = Number.isFinite(sampleStart) ? clamp(sampleStart, 0, 1) : fallback.sampleRegion.start;
  const normalizedEnd = Math.max(normalizedStart, Number.isFinite(sampleEnd) ? clamp(sampleEnd, 0, 1) : fallback.sampleRegion.end);
  const normalizedLoopStart = Number.isFinite(loopStart) ? clamp(loopStart, normalizedStart, normalizedEnd) : fallback.sampleRegion.loopStart;
  const normalizedLoopEnd = Math.max(normalizedLoopStart, Number.isFinite(loopEnd) ? clamp(loopEnd, normalizedStart, normalizedEnd) : fallback.sampleRegion.loopEnd);

  return {
    ...fallback,
    label: typeof value.label === "string" && value.label.trim() ? value.label.trim().slice(0, 32) : fallback.label,
    key: /^[A-Z0-9]$/.test(candidateKey) ? candidateKey : fallback.key,
    color: candidateColor,
    mode: value.mode === "loop" ? "loop" : "oneshot",
    volume: Number.isFinite(candidateVolume) ? clamp(candidateVolume, 0, 1) : fallback.volume,
    sampleId: typeof value.sampleId === "string" && value.sampleId.length <= 128 ? value.sampleId : null,
    schemaVersion: 2,
    triggerMode: TRIGGER_MODES.has(value.triggerMode) ? value.triggerMode : fallback.triggerMode,
    mappingMode: MAPPING_MODES.has(value.mappingMode) ? value.mappingMode : fallback.mappingMode,
    launchQuantize: QUANTIZE_GRIDS.has(value.launchQuantize) ? value.launchQuantize : fallback.launchQuantize,
    stopQuantize: QUANTIZE_GRIDS.has(value.stopQuantize) ? value.stopQuantize : fallback.stopQuantize,
    chokeGroup: normalizeGroup(value.chokeGroup),
    muteGroup: normalizeGroup(value.muteGroup),
    linkGroup: normalizeGroup(value.linkGroup),
    layerIds: normalizeLayerIds(value.layerIds),
    sampleRegion: {
      start: normalizedStart,
      end: normalizedEnd,
      loopStart: normalizedLoopStart,
      loopEnd: normalizedLoopEnd,
      reverse: value.sampleRegion?.reverse === true,
    },
    pitchCents: Number.isFinite(Number(value.pitchCents)) ? clamp(Number(value.pitchCents), -2400, 2400) : fallback.pitchCents,
    timeStretch: Number.isFinite(Number(value.timeStretch)) ? clamp(Number(value.timeStretch), 0.25, 4) : fallback.timeStretch,
    attack: Number.isFinite(Number(value.attack)) ? clamp(Number(value.attack), 0, 1) : fallback.attack,
    release: Number.isFinite(Number(value.release)) ? clamp(Number(value.release), 0.002, 2) : fallback.release,
    pan: Number.isFinite(Number(value.pan)) ? clamp(Number(value.pan), -1, 1) : fallback.pan,
    filter: {
      type: filter.type === "highpass" || filter.type === "bandpass" ? filter.type : fallback.filter.type,
      frequency: Number.isFinite(Number(filter.frequency)) ? clamp(Number(filter.frequency), 20, 20000) : fallback.filter.frequency,
      q: Number.isFinite(Number(filter.q)) ? clamp(Number(filter.q), 0.0001, 18) : fallback.filter.q,
    },
    effectSends: {
      reverb: Number.isFinite(Number(sends.reverb)) ? clamp(Number(sends.reverb), 0, 1) : fallback.effectSends.reverb,
      delay: Number.isFinite(Number(sends.delay)) ? clamp(Number(sends.delay), 0, 1) : fallback.effectSends.delay,
    },
  };
}

export function normalizeSampleRecord(candidate) {
  return {
    ...candidate,
    schemaVersion: 2,
    sourceId: typeof candidate?.sourceId === "string" ? candidate.sourceId : null,
    editRecipe: Array.isArray(candidate?.editRecipe) ? candidate.editRecipe.slice(0, 64) : [],
  };
}

export function normalizeKitRecord(candidate, slot, normalizePads) {
  const fallbackName = `Kit ${slot}`;
  return {
    ...candidate,
    id: `kit-${slot}`,
    name: typeof candidate?.name === "string" && candidate.name.trim() ? candidate.name.trim().slice(0, 40) : fallbackName,
    pads: normalizePads(candidate?.pads),
    empty: Boolean(candidate?.empty),
    createdAt: typeof candidate?.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
    updatedAt: typeof candidate?.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString(),
    schemaVersion: 2,
    transport: candidate?.transport && typeof candidate.transport === "object" ? { ...candidate.transport } : undefined,
    patterns: Array.isArray(candidate?.patterns) ? candidate.patterns.slice(0, 64) : [],
    scenes: Array.isArray(candidate?.scenes) ? candidate.scenes.slice(0, 64) : [],
  };
}
