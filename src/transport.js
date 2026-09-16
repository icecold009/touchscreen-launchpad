const GRID_BEATS = Object.freeze({
  beat: 1,
  eighth: 0.5,
  sixteenth: 0.25,
  thirtysecond: 0.125,
  bar: 4,
  phrase: 16,
});

export const TRANSPORT_GRIDS = Object.freeze(Object.keys(GRID_BEATS));
export const DEFAULT_TRANSPORT = Object.freeze({
  bpm: 120,
  meter: "4/4",
  quantize: true,
  subdivision: "beat",
  swing: 0,
  countInBars: 0,
  metronome: false,
});

export function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeTransport(candidate = {}) {
  const bpm = Number(candidate.bpm);
  const swing = Number(candidate.swing);
  const countInBars = Number(candidate.countInBars);
  const subdivision = TRANSPORT_GRIDS.includes(candidate.subdivision)
    ? candidate.subdivision
    : DEFAULT_TRANSPORT.subdivision;

  return {
    bpm: Number.isFinite(bpm) ? clamp(bpm, 60, 200) : DEFAULT_TRANSPORT.bpm,
    meter: candidate.meter === "3/4" || candidate.meter === "6/8" ? candidate.meter : DEFAULT_TRANSPORT.meter,
    quantize: candidate.quantize !== false,
    subdivision,
    swing: Number.isFinite(swing) ? clamp(swing, 0, 0.5) : DEFAULT_TRANSPORT.swing,
    countInBars: Number.isFinite(countInBars) ? Math.round(clamp(countInBars, 0, 4)) : DEFAULT_TRANSPORT.countInBars,
    metronome: candidate.metronome === true,
  };
}

export function getBeatDuration(bpm = DEFAULT_TRANSPORT.bpm) {
  return 60 / clamp(Number(bpm) || DEFAULT_TRANSPORT.bpm, 20, 400);
}

export function getGridBeats(grid = DEFAULT_TRANSPORT.subdivision) {
  return GRID_BEATS[grid] || GRID_BEATS[DEFAULT_TRANSPORT.subdivision];
}

export function quantizeBeat(beat, grid = DEFAULT_TRANSPORT.subdivision, mode = "nearest") {
  const interval = getGridBeats(grid);
  const value = Number.isFinite(Number(beat)) ? Number(beat) : 0;
  if (mode === "ceil") return Math.ceil(value / interval) * interval;
  if (mode === "floor") return Math.floor(value / interval) * interval;
  return Math.round(value / interval) * interval;
}

export function getNextQuantizedTime(currentTime, transport = {}, offset = 0.025) {
  const normalized = normalizeTransport(transport);
  const now = Number.isFinite(Number(currentTime)) ? Number(currentTime) : 0;
  if (!normalized.quantize) return now;
  const interval = getBeatDuration(normalized.bpm) * getGridBeats(normalized.subdivision);
  return Math.ceil((now + Math.max(0, Number(offset) || 0)) / interval) * interval;
}

export function createLookaheadScheduler({
  clock = () => 0,
  scheduleAhead = 0.1,
  intervalMs = 25,
  onTick = () => {},
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
  let timer;
  let running = false;
  let previousTime;

  const tick = () => {
    if (!running) return;
    const now = Number(clock());
    const safeNow = Number.isFinite(now) ? now : 0;
    onTick({
      now: safeNow,
      until: safeNow + Math.max(0, Number(scheduleAhead) || 0),
      delta: previousTime === undefined ? 0 : Math.max(0, safeNow - previousTime),
    });
    previousTime = safeNow;
    timer = setTimeoutFn(tick, Math.max(5, Number(intervalMs) || 25));
  };

  return {
    start() {
      if (running) return;
      running = true;
      previousTime = undefined;
      timer = setTimeoutFn(tick, 0);
    },
    stop() {
      if (timer !== undefined) clearTimeoutFn(timer);
      timer = undefined;
      running = false;
      previousTime = undefined;
    },
    pulse() {
      if (!running) return;
      const now = Number(clock());
      const safeNow = Number.isFinite(now) ? now : 0;
      onTick({
        now: safeNow,
        until: safeNow + Math.max(0, Number(scheduleAhead) || 0),
        delta: previousTime === undefined ? 0 : Math.max(0, safeNow - previousTime),
      });
      previousTime = safeNow;
    },
    get running() {
      return running;
    },
  };
}
