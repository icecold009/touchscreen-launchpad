import assert from "node:assert/strict";
import test from "node:test";

import { createMidiFile } from "../src/midi-file.js";

function ascii(bytes, start, length) {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

test("MIDI export is deterministic and contains tempo, scene, and note events", () => {
  const scene = {
    name: "Scene A",
    pattern: {
      swing: 0.1,
      tracks: [{
        padIndex: 0,
        steps: [{ on: true, probability: 1, microTiming: 0 }, { on: false }, { on: true, probability: 0.5, microTiming: -0.1 }],
      }],
    },
  };
  const first = createMidiFile({ scenes: [scene], padNotes: [36], bpm: 120 });
  const second = createMidiFile({ scenes: [scene], padNotes: [36], bpm: 120 });
  assert.deepEqual(first, second);
  assert.equal(ascii(first, 0, 4), "MThd");
  assert.equal(ascii(first, 14, 4), "MTrk");
  assert.ok(first.includes(0x51));
  assert.ok(first.includes(0x90));
  assert.ok(first.includes(0x80));
  assert.ok(first.includes(0x24));
});

test("MIDI export bounds tempo, tracks, notes, and empty scenes safely", () => {
  const bytes = createMidiFile({ scenes: Array.from({ length: 8 }, (_, index) => ({ name: `Scene ${index}`, pattern: {} })), bpm: 9999, padNotes: [-4] });
  assert.equal(ascii(bytes, 0, 4), "MThd");
  assert.equal(bytes[9], 1);
  assert.equal(bytes[10], 0);
  assert.equal(bytes[11], 3);
});
