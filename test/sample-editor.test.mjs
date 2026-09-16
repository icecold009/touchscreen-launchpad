import assert from "node:assert/strict";
import test from "node:test";

import {
  createPlaybackPlan,
  createReversedBuffer,
  createWaveformPeaks,
  getBufferPeak,
  normalizeSampleProcessing,
  normalizeSampleRegion,
} from "../src/sample-editor.js";

test("sample regions stay ordered and playback plans map reverse bounds", () => {
  const region = normalizeSampleRegion({ start: 0.8, end: 0.2, loopStart: 0.9, loopEnd: 0.1, reverse: true });
  assert.deepEqual(region, { start: 0.8, end: 0.8, loopStart: 0.8, loopEnd: 0.8, reverse: true });
  const plan = createPlaybackPlan({ duration: 4, region: { start: 0.25, end: 0.75, reverse: true }, timeStretch: 2, pitchCents: -120 });
  assert.equal(plan.offset, 1);
  assert.equal(plan.duration, 2);
  assert.equal(plan.playbackRate, 2);
  assert.equal(plan.detune, -120);
  assert.equal(plan.reverse, true);
});

test("waveform peaks and reverse-buffer helper are deterministic", () => {
  const samples = Float32Array.from([0, 0.5, -1, 0.25]);
  const buffer = { getChannelData: () => samples, numberOfChannels: 1, length: samples.length, sampleRate: 4, duration: 1 };
  assert.deepEqual(createWaveformPeaks(buffer, 4), [0, 0.5, 1, 0.25, 0, 0, 0, 0]);
  const context = {
    createBuffer: (channels, length, sampleRate) => {
      const data = Float32Array.from({ length });
      return { numberOfChannels: channels, length, sampleRate, data, getChannelData: () => data };
    },
  };
  const reversed = createReversedBuffer(context, buffer);
  assert.deepEqual([...reversed.getChannelData()], [0.25, -1, 0.5, 0]);
  assert.equal(getBufferPeak(buffer, { start: 0.25, end: 0.75 }), 1);
  assert.deepEqual(normalizeSampleProcessing({ zoom: 20, fadeIn: -1, fadeOut: 2, normalize: true }), {
    zoom: 8,
    fadeIn: 0,
    fadeOut: 1,
    normalize: true,
  });
});
