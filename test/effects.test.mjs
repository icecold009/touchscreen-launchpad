import assert from "node:assert/strict";
import test from "node:test";

import { createImpulseResponse, detectPeak, normalizeEffectSends, normalizeMasterEffects } from "../src/effects.js";

test("effect sends and master settings stay inside safe audio bounds", () => {
  assert.deepEqual(normalizeEffectSends({ delay: 2, reverb: -1 }), { delay: 1, reverb: 0 });
  assert.deepEqual(normalizeMasterEffects({ delayTime: 2, delayFeedback: -1, reverbDecay: 10 }), {
    delayTime: 0.8,
    delayFeedback: 0,
    reverbDecay: 4,
    eqLowDb: 0,
    eqMidDb: 0,
    eqHighDb: 0,
    compressorThreshold: -18,
    compressorRatio: 4,
    limiterThreshold: -1,
  });
});

test("master dynamics stay bounded and clipping detection is explicit", () => {
  assert.deepEqual(normalizeMasterEffects({ eqLowDb: 99, compressorThreshold: -99, compressorRatio: 99, limiterThreshold: 2 }), {
    delayTime: 0.24,
    delayFeedback: 0.28,
    reverbDecay: 1.4,
    eqLowDb: 12,
    eqMidDb: 0,
    eqHighDb: 0,
    compressorThreshold: -60,
    compressorRatio: 20,
    limiterThreshold: 0,
  });
  const peak = detectPeak(Float32Array.from([0.1, -0.99, 0.2]));
  assert.ok(Math.abs(peak.peak - 0.99) < 0.0001);
  assert.equal(peak.clipping, true);
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
