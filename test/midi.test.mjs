import assert from "node:assert/strict";
import test from "node:test";

import {
  createMidiLearnState,
  createMidiNoteMessage,
  getPadIndexForMidiNote,
  normalizeMidiMapping,
  parseMidiMessage,
} from "../src/midi.js";

test("MIDI messages normalize note-on, note-off, channels, and velocity", () => {
  assert.deepEqual(parseMidiMessage([0x92, 40, 96]), { command: "noteon", channel: 2, note: 40, velocity: 96 / 127, value: 96 });
  assert.equal(parseMidiMessage([0x90, 40, 0]).command, "noteoff");
  assert.equal(parseMidiMessage([0xb0, 1, 127]).command, "controlchange");
  assert.deepEqual(normalizeMidiMapping({ note: 140, channel: 20 }), { note: null, channel: null });
  assert.deepEqual(createMidiNoteMessage("noteon", 40, 0.5, 2), [0x92, 40, 64]);
});

test("MIDI mapping prefers learned notes and falls back to pads 1-16", () => {
  const pads = [{ midi: { note: 70, channel: 1 } }, {}, {}];
  assert.equal(getPadIndexForMidiNote(pads, 70, { channel: 1 }), 0);
  assert.equal(getPadIndexForMidiNote(pads, 38), 2);
  assert.equal(getPadIndexForMidiNote(pads, 99), -1);
  const learned = [];
  const state = createMidiLearnState({ onLearned: (mapping) => learned.push(mapping) });
  state.start();
  assert.equal(state.handle({ command: "noteon", note: 44, channel: 3 }), true);
  assert.deepEqual(learned, [{ note: 44, channel: 3 }]);
  assert.equal(state.active, false);
});
