import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseRecordingMimeType,
  createRecordingSession,
  createTakeRecord,
  formatRecordingTime,
  isValidTakeRecord,
  normalizeTakeRecord,
} from "../src/recording.js";

class FakeRecorder {
  static isTypeSupported(type) {
    return type === "audio/webm";
  }

  constructor(stream, options = {}) {
    assert.ok(stream);
    this.mimeType = options.mimeType || "audio/webm";
    this.state = "inactive";
    this.listeners = new Map();
  }

  addEventListener(type, listener, options = {}) {
    this.listeners.set(type, { listener, once: options.once });
  }

  emit(type, event = {}) {
    const registration = this.listeners.get(type);
    if (!registration) return;
    if (registration.once) this.listeners.delete(type);
    registration.listener(event);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.emit("dataavailable", { data: new Blob(["take"], { type: this.mimeType }) });
    this.emit("stop");
  }

  pause() {
    this.state = "paused";
  }

  resume() {
    this.state = "recording";
  }
}

test("recording helpers choose safe formats and format elapsed time", () => {
  assert.equal(chooseRecordingMimeType(FakeRecorder), "audio/webm");
  assert.equal(formatRecordingTime(65_400), "01:05");
  assert.equal(formatRecordingTime(-1), "00:00");
});

test("recording session captures a bounded local take and reports lifecycle", async () => {
  let now = 1000;
  const states = [];
  const session = createRecordingSession({
    RecorderClass: FakeRecorder,
    now: () => now,
    maxDurationMs: 60_000,
    onStateChange: ({ state }) => states.push(state),
  });

  session.start({ getTracks: () => [] });
  assert.equal(session.state, "recording");
  now += 2_500;
  const blob = await session.stop();
  assert.equal(blob.type, "audio/webm");
  assert.equal(blob.size, 4);
  assert.equal(session.state, "ready");
  assert.deepEqual(states, ["recording", "stopping", "ready"]);
});

test("cancelling a session discards the pending recorder data", () => {
  const states = [];
  const session = createRecordingSession({ RecorderClass: FakeRecorder, onStateChange: ({ state }) => states.push(state) });
  session.start({ getTracks: () => [] });
  session.cancel();
  assert.equal(session.state, "idle");
  assert.deepEqual(states, ["recording", "idle", "idle"]);
});

test("recording pause and resume exclude the paused interval from duration", async () => {
  let now = 1000;
  const states = [];
  const session = createRecordingSession({ RecorderClass: FakeRecorder, now: () => now, onStateChange: ({ state }) => states.push(state) });
  session.start({ getTracks: () => [] });
  now += 500;
  session.pause();
  now += 2000;
  assert.equal(session.elapsedMs, 500);
  session.resume();
  now += 500;
  const blob = await session.stop();
  assert.equal(blob.size, 4);
  assert.equal(session.elapsedMs, 1000);
  assert.deepEqual(states, ["recording", "paused", "recording", "stopping", "ready"]);
});

test("take records reject empty or oversized blobs", () => {
  assert.throws(() => createTakeRecord({ blob: new Blob([]) }), /did not contain audio/);
  const take = createTakeRecord({
    id: "take-1",
    blob: new Blob(["audio"], { type: "audio/webm" }),
    name: "Room idea",
    durationMs: 1800,
  });
  assert.equal(take.name, "Room idea");
  assert.equal(take.durationMs, 1800);
  assert.deepEqual(take.markers, []);
  assert.equal(isValidTakeRecord(take), true);
  assert.equal(isValidTakeRecord({ ...take, size: 3 }), false);
});

test("take markers normalize to the recorded duration", () => {
  const take = normalizeTakeRecord({
    id: "take-markers",
    durationMs: 1000,
    markers: [{ label: "  Drop  ", atMs: 2000 }],
  });
  assert.deepEqual(take.markers, [{ id: "marker-1", label: "Drop", atMs: 1000 }]);
});
