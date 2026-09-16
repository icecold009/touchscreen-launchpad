import assert from "node:assert/strict";
import test from "node:test";

import { createHistory } from "../src/history.js";
import { createInputAdapter, normalizeInputEvent } from "../src/input-adapter.js";
import { createDefaultPad, normalizePadDefinition } from "../src/migrations.js";
import { createLookaheadScheduler, getNextQuantizedTime, normalizeTransport, quantizeBeat } from "../src/transport.js";
import { createVoiceRegistry } from "../src/voice-registry.js";

test("pad migration adds bounded professional defaults without changing legacy fields", () => {
  const pad = normalizePadDefinition({ id: 4, label: "Kick", key: "k", mode: "loop", volume: 4 }, 3);
  assert.equal(pad.id, 4);
  assert.equal(pad.label, "Kick");
  assert.equal(pad.mode, "loop");
  assert.equal(pad.volume, 1);
  assert.equal(pad.schemaVersion, 2);
  assert.equal(pad.triggerMode, "trigger");
  assert.deepEqual(pad.layerIds, []);
  assert.equal(pad.sampleRegion.end, 1);
  const bounded = normalizePadDefinition({ sampleRegion: { start: 0.9, end: 0.1, loopStart: -1, loopEnd: 2 } }, 0);
  assert.deepEqual(bounded.sampleRegion, { start: 0.9, end: 0.9, loopStart: 0.9, loopEnd: 0.9, reverse: false });
  assert.equal(createDefaultPad(0).key, "Q");
});

test("transport normalization and quantization are deterministic", () => {
  assert.deepEqual(normalizeTransport({ bpm: 999, swing: -1, subdivision: "bad" }), {
    bpm: 200,
    meter: "4/4",
    quantize: true,
    subdivision: "beat",
    swing: 0,
    countInBars: 0,
    metronome: false,
  });
  assert.equal(quantizeBeat(1.13, "sixteenth"), 1.25);
  assert.equal(getNextQuantizedTime(1.01, { bpm: 120, subdivision: "beat" }), 1.5);
  assert.equal(getNextQuantizedTime(1.01, { quantize: false }), 1.01);
});

test("lookahead scheduler reports monotonic timing and stops cleanly", () => {
  const timers = [];
  let now = 0;
  const ticks = [];
  const scheduler = createLookaheadScheduler({
    clock: () => now,
    setTimeoutFn: (callback) => {
      timers.push(callback);
      return timers.length - 1;
    },
    clearTimeoutFn: () => {},
    onTick: (tick) => ticks.push(tick),
  });
  scheduler.start();
  timers.shift()();
  now = 0.05;
  timers.shift()();
  scheduler.stop();
  assert.equal(ticks.length, 2);
  assert.equal(ticks[1].delta, 0.05);
  assert.equal(scheduler.running, false);
});

test("voice registry enforces per-pad and global limits with oldest-first stealing", () => {
  const registry = createVoiceRegistry({ maxVoices: 2, maxVoicesPerPad: 1 });
  const first = {};
  const second = {};
  const third = {};
  assert.deepEqual(registry.add(0, first).stolen, []);
  assert.deepEqual(registry.add(0, second).stolen, [{ padIndex: 0, voice: first, reason: "pad-limit" }]);
  assert.deepEqual(registry.add(1, third).stolen, []);
  assert.equal(registry.size(), 2);
  assert.deepEqual(registry.add(2, {}).stolen, [{ padIndex: 0, voice: second, reason: "global-limit" }]);
});

test("input adapter normalizes pointer, keyboard, MIDI, and invalid events", () => {
  assert.equal(normalizeInputEvent({ kind: "midi", padIndex: 1, velocity: 2, pressure: -1 }).velocity, 1);
  assert.equal(normalizeInputEvent({ kind: "midi", padIndex: 1, velocity: 2, pressure: -1 }).pressure, 0);
  assert.equal(normalizeInputEvent({ padIndex: 16 }), null);
  const received = [];
  const adapter = createInputAdapter({ onInput: (event) => received.push(event) });
  adapter.emit({ kind: "pointer", padIndex: 2, action: "trigger" });
  assert.equal(received[0].kind, "pointer");
  assert.equal(received[0].padIndex, 2);
});

test("history keeps bounded undo/redo state and clears redo after a new edit", () => {
  const history = createHistory({ limit: 2 });
  history.push({ value: 1 });
  history.push({ value: 2 });
  history.push({ value: 3 });
  assert.equal(history.length, 2);
  assert.deepEqual(history.peekUndo({ value: 4 }).state, { value: 3 });
  const undone = history.undo({ value: 4 });
  assert.deepEqual(undone.state, { value: 3 });
  assert.deepEqual(history.peekRedo({ value: 3 }).state, { value: 4 });
  const redone = history.redo({ value: 5 });
  assert.deepEqual(redone.state, { value: 4 });
  history.push({ value: 6 });
  assert.equal(history.canRedo, false);
});
