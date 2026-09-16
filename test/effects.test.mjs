import assert from "node:assert/strict";
import test from "node:test";

import { createImpulseResponse, normalizeEffectSends, normalizeMasterEffects } from "../src/effects.js";

test("effect sends and master settings stay inside safe audio bounds", () => {
  assert.deepEqual(normalizeEffectSends({ delay: 2, reverb: -1 }), { delay: 1, reverb: 0 });
  assert.deepEqual(normalizeMasterEffects({ delayTime: 2, delayFeedback: -1, reverbDecay: 10 }), {
    delayTime: 0.8,
    delayFeedback: 0,
    reverbDecay: 4,
  });
});

test("impulse response creation is bounded to the requested decay", () => {
  const context = {
    sampleRate: 100,
    createBuffer: (channels, length, sampleRate) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { numberOfChannels: channels, length, sampleRate, getChannelData: (channel) => data[channel] };
    },
  };
  const impulse = createImpulseResponse(context, 1);
  assert.equal(impulse.numberOfChannels, 2);
  assert.equal(impulse.length, 100);
  assert.equal(impulse.sampleRate, 100);
});
