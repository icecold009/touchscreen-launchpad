export const SEQUENCER_TRACK_COUNT = 4;
export const SEQUENCER_STEP_COUNT = 16;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function createPattern(trackCount = SEQUENCER_TRACK_COUNT, stepCount = SEQUENCER_STEP_COUNT) {
  return {
    schemaVersion: 1,
    swing: 0,
    tracks: Array.from({ length: trackCount }, (_, trackIndex) => ({
      id: `track-${trackIndex + 1}`,
      padIndex: trackIndex,
      steps: Array.from({ length: stepCount }, () => ({ on: false, probability: 1, microTiming: 0 })),
    })),
  };
}

export function normalizePattern(candidate, trackCount = SEQUENCER_TRACK_COUNT, stepCount = SEQUENCER_STEP_COUNT) {
  const fallback = createPattern(trackCount, stepCount);
  const tracks = Array.isArray(candidate?.tracks) ? candidate.tracks : [];
  return {
    schemaVersion: 1,
    swing: clamp(Number(candidate?.swing) || 0, 0, 0.5),
    tracks: fallback.tracks.map((track, trackIndex) => {
      const source = tracks[trackIndex] || {};
      const steps = Array.isArray(source.steps) ? source.steps : [];
      return {
        ...track,
        id: typeof source.id === "string" ? source.id.slice(0, 32) : track.id,
        padIndex: Number.isInteger(source.padIndex) && source.padIndex >= 0 ? source.padIndex : track.padIndex,
        steps: track.steps.map((step, stepIndex) => ({
          on: steps[stepIndex]?.on === true,
          probability: clamp(Number(steps[stepIndex]?.probability) || 1, 0, 1),
          microTiming: clamp(Number(steps[stepIndex]?.microTiming) || 0, -0.5, 0.5),
        })),
      };
    }),
  };
}

export function toggleStep(pattern, trackIndex, stepIndex) {
  const next = normalizePattern(pattern);
  const track = next.tracks[trackIndex];
  if (!track || !track.steps[stepIndex]) return next;
  track.steps[stepIndex].on = !track.steps[stepIndex].on;
  return next;
}

export function updateStep(pattern, trackIndex, stepIndex, changes = {}) {
  const next = normalizePattern(pattern);
  const track = next.tracks[trackIndex];
  const step = track?.steps[stepIndex];
  if (!step) return next;
  if (typeof changes.on === "boolean") step.on = changes.on;
  if (changes.probability !== undefined) step.probability = clamp(Number(changes.probability) || 0, 0, 1);
  if (changes.microTiming !== undefined) step.microTiming = clamp(Number(changes.microTiming) || 0, -0.5, 0.5);
  return next;
}

export function getStepEvents(pattern, stepIndex, random = Math.random) {
  const normalized = normalizePattern(pattern);
  return normalized.tracks
    .map((track) => ({ track, step: track.steps[stepIndex] }))
    .filter(({ step }) => step?.on && random() <= step.probability)
    .map(({ track, step }) => ({ padIndex: track.padIndex, microTiming: step.microTiming, trackId: track.id }));
}

export function getSwingOffset(stepIndex, swing, stepDuration) {
  return stepIndex % 2 === 1 ? clamp(Number(swing) || 0, 0, 0.5) * Math.max(0, Number(stepDuration) || 0) : 0;
}

export function createSequencerRunner({
  getBpm = () => 120,
  getSwing = () => 0,
  onStep = () => {},
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
} = {}) {
  let timer;
  let stepIndex = 0;
  let running = false;

  function pulse() {
    const bpm = clamp(Number(getBpm()) || 120, 20, 400);
    const stepDuration = 60 / bpm / 4;
    onStep({
      stepIndex,
      stepDuration,
      swingOffset: getSwingOffset(stepIndex, getSwing(), stepDuration),
    });
    stepIndex = (stepIndex + 1) % SEQUENCER_STEP_COUNT;
  }

  return {
    get running() {
      return running;
    },
    get stepIndex() {
      return stepIndex;
    },
    pulse,
    start() {
      if (running) return;
      running = true;
      stepIndex = 0;
      pulse();
      const interval = Math.max(20, (60 / clamp(Number(getBpm()) || 120, 20, 400) / 4) * 1000);
      timer = setIntervalFn(pulse, interval);
    },
    stop() {
      if (timer !== undefined) clearIntervalFn(timer);
      timer = undefined;
      running = false;
      stepIndex = 0;
    },
  };
}
