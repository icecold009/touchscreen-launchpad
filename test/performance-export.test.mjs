import assert from "node:assert/strict";
import test from "node:test";

import {
  createPerformanceEvents,
  createPerformanceLog,
  estimateRenderBytes,
  isRenderWithinGuardrails,
  normalizeRenderOptions,
} from "../src/performance-export.js";

test("render options and event logs are deterministic and bounded", () => {
  const options = normalizeRenderOptions({ bpm: 20, bars: 100, sampleRate: 192000, channels: 8 });
  assert.deepEqual(options, { bpm: 60, bars: 16, sampleRate: 96000, channels: 2, seconds: 64 });
  const scene = {
    id: "scene-a",
    name: "Scene A",
    pattern: {
      swing: 0.25,
      tracks: [{ padIndex: 3, steps: [{ on: true, probability: 0.5, microTiming: 0.1 }] }],
    },
  };
  const events = createPerformanceEvents({ scene, bpm: 120, bars: 2 });
  assert.equal(events.length, 2);
  assert.equal(events[0].padIndex, 3);
  assert.equal(events[0].velocity, 0.75);
  assert.ok(events[1].at > events[0].at);
  const log = createPerformanceLog({ scenes: [scene], pads: [{ id: 1, label: "Kick", sampleId: "sample-1" }], bpm: 120, bars: 2 });
  assert.equal(log.schema, "touchscreen-launchpad.performance-log");
  assert.equal(log.scenes[0].events.length, 2);
  assert.equal(isRenderWithinGuardrails({ bpm: 120, bars: 2, sampleRate: 44100, channels: 2 }), true);
  assert.ok(estimateRenderBytes({ bpm: 120, bars: 2 }) > 44);
});
