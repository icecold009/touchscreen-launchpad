import { createLookaheadScheduler } from "./transport.js";

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function createClockedSequencerRunner({
  clock = () => 0,
  getBpm = () => 120,
  getSwing = () => 0,
  onStep = () => {},
  scheduleAhead = 0.1,
  intervalMs = 25,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
  let running = false;
  let stepIndex = 0;
  let nextStepTime = 0;

  function getStepDuration() {
    return 60 / clamp(Number(getBpm()) || 120, 20, 400) / 4;
  }

  function scheduleSteps({ until }) {
    if (!running) return;
    const now = Number(clock());
    const safeNow = Number.isFinite(now) ? now : 0;
    let guard = 0;
    while (nextStepTime <= until && guard < 64) {
      const stepDuration = getStepDuration();
      const at = nextStepTime;
      onStep({
        stepIndex,
        stepDuration,
        swingOffset: stepIndex % 2 === 1 ? clamp(Number(getSwing()) || 0, 0, 0.5) * stepDuration : 0,
        at,
        lateBy: Math.max(0, safeNow - at),
      });
      stepIndex = (stepIndex + 1) % 16;
      nextStepTime = at + stepDuration;
      guard += 1;
    }
  }

  const scheduler = createLookaheadScheduler({
    clock,
    scheduleAhead,
    intervalMs,
    onTick: scheduleSteps,
    setTimeoutFn,
    clearTimeoutFn,
  });

  return {
    get running() {
      return running;
    },
    get stepIndex() {
      return stepIndex;
    },
    start() {
      if (running) return;
      running = true;
      stepIndex = 0;
      nextStepTime = Number(clock()) || 0;
      scheduler.start();
    },
    stop() {
      scheduler.stop();
      running = false;
      stepIndex = 0;
      nextStepTime = 0;
    },
    pulse() {
      if (!running) return;
      scheduler.pulse();
    },
  };
}
