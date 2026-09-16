import assert from "node:assert/strict";
import test from "node:test";

import {
  createMidiClockMessage,
  createMidiClockTracker,
  createMidiControllerMessage,
  createMidiLearnState,
  createMidiNoteMessage,
  getMidiControllerValue,
  getMidiMappingConflicts,
  getPadIndexForMidiNote,
  normalizeMidiConfig,
  normalizeMidiControllerMapping,
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

test("MIDI controllers, aftertouch, and profiles stay bounded", () => {
  assert.deepEqual(parseMidiMessage([0xb3, 21, 64]), {
    command: "controlchange",
    channel: 3,
    note: 21,
    velocity: 64 / 127,
    value: 64,
  });
  assert.equal(parseMidiMessage([0xd1, 100]).command, "channelaftertouch");
  assert.equal(parseMidiMessage([0xa1, 40, 90]).command, "polyaftertouch");
  assert.deepEqual(createMidiControllerMessage("cc", 21, 64, 3), [0xb3, 21, 64]);
  assert.deepEqual(createMidiControllerMessage("aftertouch", null, 100, 1), [0xd1, 100]);
  assert.deepEqual(createMidiClockMessage("start"), [0xfa]);
  assert.deepEqual(normalizeMidiControllerMapping({ controller: 200, channel: 20, target: "unknown" }), {
    id: "controller-1",
    type: "cc",
    controller: null,
    channel: null,
    target: "masterVolume",
    enabled: true,
  });
  assert.deepEqual(normalizeMidiConfig({ profileName: "  Stage A  ", clockIn: true, controllerMappings: [{ type: "cc", controller: 7, target: "masterVolume" }] }), {
    profileName: "Stage A",
    inputId: "",
    outputId: "",
    clockIn: true,
    clockOut: false,
    controllerMappings: [{ id: "controller-1", type: "cc", controller: 7, channel: null, target: "masterVolume", enabled: true }],
  });
  const mapping = normalizeMidiControllerMapping({ type: "cc", controller: 7, target: "masterVolume" });
  assert.equal(getMidiControllerValue(parseMidiMessage([0xb0, 7, 127]), mapping), 1);
});

test("MIDI learn detects conflicts and clock-in follows quarter-note tempo", () => {
  const pads = [{ midi: { note: 40, channel: null } }, { midi: { note: 41, channel: 2 } }];
  assert.deepEqual(getMidiMappingConflicts(pads, { note: 40, channel: 3 }, 1), [0]);
  assert.deepEqual(getMidiMappingConflicts(pads, { note: 41, channel: 1 }, 0), []);
  const tempos = [];
  const tracker = createMidiClockTracker({ onTempo: (tempo) => tempos.push(tempo) });
  tracker.start();
  for (let index = 0; index < 24; index += 1) tracker.tick(0);
  for (let index = 0; index < 24; index += 1) tracker.tick(500);
  assert.equal(Math.round(tempos[0]), 120);
  const learned = [];
  const state = createMidiLearnState({ onLearned: (message) => learned.push(message) });
  state.start({ mode: "controller" });
  assert.equal(state.handle(parseMidiMessage([0xb0, 16, 80])), true);
  assert.equal(learned[0].command, "controlchange");
  state.start({ mode: "controller" });
  state.cancel();
  assert.equal(state.handle(parseMidiMessage([0xb0, 16, 80])), false);
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
