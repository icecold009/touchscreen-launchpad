import assert from "node:assert/strict";
import test from "node:test";

import {
  createHtdemucsOverlapAdder,
  getHtdemucsChunkCount,
  getHtdemucsChunkStart,
  getHtdemucsModelRow,
  HTDEMUCS_SAMPLE_RATE,
  HTDEMUCS_SEGMENT_SAMPLES,
  HTDEMUCS_STEM_NAMES,
} from "../src/htdemucs-separation-dsp.js";

test("HT-Demucs uses its 44.1 kHz fixed model contract and correct stem row order", () => {
  assert.equal(HTDEMUCS_SAMPLE_RATE, 44100);
  assert.equal(HTDEMUCS_SEGMENT_SAMPLES, 343980);
  assert.deepEqual(HTDEMUCS_STEM_NAMES, ["Drums", "Bass", "Vocals", "Other"]);
  assert.deepEqual(HTDEMUCS_STEM_NAMES.map((_, index) => getHtdemucsModelRow(index)), [0, 1, 3, 2]);
});

test("HT-Demucs chunk starts use the model's 25 percent overlap", () => {
  assert.equal(getHtdemucsChunkCount(HTDEMUCS_SEGMENT_SAMPLES), 1);
  assert.equal(getHtdemucsChunkCount(HTDEMUCS_SEGMENT_SAMPLES + 1), 2);
  assert.equal(getHtdemucsChunkStart(0), 0);
  assert.equal(getHtdemucsChunkStart(1), Math.floor(HTDEMUCS_SEGMENT_SAMPLES * 0.75));
  assert.throws(() => getHtdemucsChunkCount(0), RangeError);
});

test("streaming overlap-add preserves stereo samples through a two-chunk boundary", () => {
  const segmentSamples = 32;
  const overlapSamples = 8;
  const stride = segmentSamples - overlapSamples;
  const sampleCount = 55;
  const expected = Array.from({ length: 4 }, (_, stem) => Array.from({ length: 2 }, (_, channel) => Float32Array.from(
    { length: sampleCount },
    (_, sample) => Math.sin((sample + stem * 3 + channel) * 0.07) * 0.4,
  )));
  const actual = Array.from({ length: 4 }, () => Array.from({ length: 2 }, () => new Float32Array(sampleCount)));
  const adder = createHtdemucsOverlapAdder({
    sampleCount,
    segmentSamples,
    overlapSamples,
    onWrite({ start, stems, sampleCount: written }) {
      for (let stem = 0; stem < 4; stem += 1) {
        for (let channel = 0; channel < 2; channel += 1) actual[stem][channel].set(stems[stem][channel], start);
        assert.equal(stems[stem][0].length, written);
      }
    },
  });

  for (let chunkIndex = 0; chunkIndex < adder.chunkCount; chunkIndex += 1) {
    const start = getHtdemucsChunkStart(chunkIndex, segmentSamples, overlapSamples);
    const predictions = expected.map((channels) => channels.map((audio) => {
      const chunk = new Float32Array(segmentSamples);
      chunk.set(audio.subarray(start, Math.min(sampleCount, start + segmentSamples)));
      return chunk;
    }));
    adder.push(predictions, chunkIndex);
  }

  for (let stem = 0; stem < 4; stem += 1) {
    for (let channel = 0; channel < 2; channel += 1) {
      for (let sample = 0; sample < sampleCount; sample += 1) {
        assert.ok(Math.abs(actual[stem][channel][sample] - expected[stem][channel][sample]) < 1e-6, `stem ${stem}, channel ${channel}, sample ${sample}`);
      }
    }
  }
});

test("overlap-adder rejects out-of-order chunks and malformed model output", () => {
  const adder = createHtdemucsOverlapAdder({ sampleCount: 24, segmentSamples: 32, overlapSamples: 8, onWrite() {} });
  assert.throws(() => adder.push([], 1), RangeError);
  assert.throws(() => adder.push([], 0), TypeError);
});
