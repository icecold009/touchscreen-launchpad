import assert from "node:assert/strict";
import test from "node:test";

import {
  createPattern,
  createSequencerRunner,
  getStepEvents,
  getSwingOffset,
  normalizePattern,
  toggleStep,
  updateStep,
} from "../src/sequencer.js";
import { createClockedSequencerRunner } from "../src/clocked-sequencer.js";

test("patterns keep four tracks, bounded steps, swing, and probability", () => {
  const pattern = createPattern();
  const toggled = toggleStep(pattern, 0, 0);
  assert.equal(toggled.tracks.length, 4);
  assert.equal(toggled.tracks[0].steps[0].on, true);
  assert.equal(getStepEvents({ ...toggled, tracks: toggled.tracks.map((track, index) => index === 0 ? { ...track, steps: [{ on: true, probability: 1, microTiming: 0 }] } : track) }, 0).length, 1);
  const normalized = normalizePattern({ swing: 4, tracks: [{ padIndex: -4, steps: [{ on: true, probability: 2, microTiming: 3 }] }] });
  assert.equal(normalized.swing, 0.5);
  assert.equal(normalized.tracks[0].padIndex, 0);
  assert.equal(normalized.tracks[0].steps[0].probability, 1);
  assert.equal(normalized.tracks[0].steps[0].microTiming, 0.5);
  assert.equal(getSwingOffset(1, 0.5, 0.1), 0.05);
  const edited = updateStep(toggled, 0, 0, { probability: 0.35, microTiming: -0.25 });
  assert.equal(edited.tracks[0].steps[0].probability, 0.35);
  assert.equal(edited.tracks[0].steps[0].microTiming, -0.25);
  assert.equal(updateStep(edited, 99, 99, { probability: 0 }).tracks[0].steps[0].probability, 0.35);
});

test("sequencer runner starts on step zero and stops its timer", () => {
  const timers = [];
  const events = [];
  const runner = createSequencerRunner({
    getBpm: () => 120,
    getSwing: () => 0.25,
    setIntervalFn: (callback, interval) => {
      timers.push({ callback, interval });
      return timers.length - 1;
    },
    clearIntervalFn: () => {},
    onStep: (event) => events.push(event),
  });
  runner.start();
  assert.equal(runner.running, true);
  assert.equal(events[0].stepIndex, 0);
  assert.equal(timers[0].interval, 125);
  timers[0].callback();
  assert.equal(events[1].stepIndex, 1);
  assert.equal(events[1].swingOffset, 0.03125);
  runner.stop();
  assert.equal(runner.running, false);
  assert.equal(runner.stepIndex, 0);
});

test("clocked sequencer schedules from an audio clock and stops cleanly", () => {
  let now = 10;
  const timers = [];
  const events = [];
  const runner = createClockedSequencerRunner({
    clock: () => now,
    getBpm: () => 120,
    scheduleAhead: 0.3,
    setTimeoutFn: (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length - 1;
    },
    clearTimeoutFn: () => {},
    onStep: (event) => events.push(event),
  });
  runner.start();
  assert.equal(runner.running, true);
  assert.equal(timers[0].delay, 0);
  timers[0].callback();
  assert.equal(events[0].stepIndex, 0);
  assert.equal(events[0].at, 10);
  assert.equal(events[1].stepIndex, 1);
  assert.equal(events[1].at, 10.125);
  runner.stop();
  assert.equal(runner.running, false);
  assert.equal(runner.stepIndex, 0);
});
