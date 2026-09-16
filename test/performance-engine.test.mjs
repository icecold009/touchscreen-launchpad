import assert from "node:assert/strict";
import test from "node:test";

import {
  getCountInBeatCount,
  getGroupPeers,
  getRepeatIntervalMs,
  normalizePerformanceSettings,
  shouldReleaseOnPointer,
} from "../src/performance-engine.js";

test("performance settings normalize expressive modes and group names", () => {
  const settings = normalizePerformanceSettings({ triggerMode: "gate", launchQuantize: "sixteenth", chokeGroup: " hats " });
  assert.deepEqual(settings, {
    triggerMode: "gate",
    launchQuantize: "sixteenth",
    stopQuantize: "off",
    chokeGroup: "hats",
    muteGroup: null,
    linkGroup: null,
  });
  assert.equal(shouldReleaseOnPointer("gate"), true);
  assert.equal(shouldReleaseOnPointer("hold"), true);
  assert.equal(shouldReleaseOnPointer("repeat"), false);
});

test("group peers exclude the triggering pad and repeat/count-in timing is bounded", () => {
  const pads = [
    { chokeGroup: "hats" },
    { chokeGroup: "hats" },
    { chokeGroup: "bass" },
    { linkGroup: "stack" },
    { linkGroup: "stack" },
  ];
  assert.deepEqual(getGroupPeers(pads, 0, "chokeGroup"), [1]);
  assert.deepEqual(getGroupPeers(pads, 3, "linkGroup"), [4]);
  assert.equal(getRepeatIntervalMs(120), 125);
  assert.equal(getRepeatIntervalMs(2), 750);
  assert.equal(getCountInBeatCount(2), 8);
  assert.equal(getCountInBeatCount(99), 16);
});
