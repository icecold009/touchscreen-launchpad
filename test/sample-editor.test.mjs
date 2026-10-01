import assert from "node:assert/strict";
import test from "node:test";

import {
  createPlaybackPlan,
  createReversedBuffer,
  createWaveformPeaks,
  drawWaveform,
  getBufferSourceStartArgs,
  getPlaybackDurationSeconds,
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

test("sixteen song pads start at distinct offsets and play only their own region", () => {
  const regions = Array.from({ length: 16 }, (_, index) => ({ start: index / 16, end: (index + 1) / 16 }));
  const args = regions.map((region) => getBufferSourceStartArgs(createPlaybackPlan({ duration: 160, region })));
  assert.equal(new Set(args.map(([offset]) => offset)).size, 16);
  assert.deepEqual(args[0], [0, 10]);
  assert.deepEqual(args[15], [150, 10]);
  assert.deepEqual(getBufferSourceStartArgs(createPlaybackPlan({ duration: 160, region: regions[8] }), { loop: true }), [80]);
});

test("one-shot playback end time follows pitch and speed", () => {
  const plan = createPlaybackPlan({ duration: 80, region: { start: 0.25, end: 0.5 }, timeStretch: 2, pitchCents: 1200 });
  assert.equal(plan.duration, 20);
  assert.equal(getPlaybackDurationSeconds(plan), 5);
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

test("waveform preview draws visible guides for each slice boundary", () => {
  const samples = Float32Array.from([0, 0.5, -1, 0.25]);
  const strokes = [];
  const context = {
    clearRect() {},
    fillRect() {},
    beginPath() {},
    moveTo(x, y) { this.from = [x, y]; },
    lineTo(x, y) { this.to = [x, y]; },
    stroke() { strokes.push({ from: this.from, to: this.to, dash: this.dash }); },
    save() {},
    restore() {},
    setLineDash(value) { this.dash = value; },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    textAlign: "",
  };
  const canvas = { width: 64, height: 24, getContext: () => context };
  const buffer = { getChannelData: () => samples, length: samples.length };
  const slices = Array.from({ length: 16 }, (_, index) => ({ start: index / 16, end: (index + 1) / 16 }));

  assert.equal(drawWaveform(canvas, buffer, {}, { zoom: 1 }, slices), true);
  assert.equal(strokes.filter((stroke) => stroke.dash?.[0] === 3 && stroke.from?.[1] === 0 && stroke.to?.[1] === 24).length, 15);
});
