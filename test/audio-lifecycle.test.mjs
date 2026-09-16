import assert from "node:assert/strict";
import test from "node:test";

import { describeAudioState, hasLiveMediaTracks, normalizeAudioContextState } from "../src/audio-lifecycle.js";

test("audio lifecycle states and diagnostics are explicit", () => {
  assert.equal(normalizeAudioContextState("running"), "running");
  assert.equal(normalizeAudioContextState("bogus"), "unavailable");
  assert.equal(describeAudioState("running", { sampleRate: 48000, baseLatency: 0.01 }), "running · 48000 Hz · 10 ms latency");
  assert.equal(describeAudioState("suspended"), "suspended · interact to resume");
  assert.equal(describeAudioState("closed"), "closed · reload required");
  assert.equal(describeAudioState("bogus"), "unavailable · Web Audio not supported");
});

test("live media track detection treats device loss as a recoverable state", () => {
  assert.equal(hasLiveMediaTracks({ getTracks: () => [{ readyState: "live" }, { readyState: "ended" }] }), true);
  assert.equal(hasLiveMediaTracks({ getTracks: () => [{ readyState: "ended" }] }), false);
  assert.equal(hasLiveMediaTracks(undefined), false);
});
