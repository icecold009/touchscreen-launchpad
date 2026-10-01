import assert from "node:assert/strict";
import test from "node:test";

import FFT from "fft.js";
import {
  STEM_FFT_SIZE,
  STEM_FRAMES_PER_SPLIT,
  STEM_HOP_SIZE,
  STEM_MODEL_BINS,
  STEM_NAMES,
  STEM_FRONT_PAD,
  applyStemRatioMasksInPlace,
  createPeriodicHann,
  createStemModelInput,
  getStemFrameCount,
  synthesizeStemSplit,
} from "../src/stem-separation-dsp.js";

test("the source spectrogram follows the padded, periodic-Hann Spleeter input contract", () => {
  const fft = new FFT(STEM_FFT_SIZE);
  const audio = [new Float32Array(2400), new Float32Array(2400)];
  audio[0][1200] = 1;
  audio[1][1200] = -1;
  const window = createPeriodicHann();
  const { magnitudes, originalSpectrum } = createStemModelInput({
    channels: audio,
    firstFrame: 0,
    activeFrames: getStemFrameCount(audio[0].length),
    fft,
    window,
  });

  assert.equal(window[0], 0);
  assert.ok(window[1] > 0);
  assert.equal(magnitudes.length, 2 * STEM_FRAMES_PER_SPLIT * STEM_MODEL_BINS);
  assert.equal(originalSpectrum.length, 2 * STEM_FRAMES_PER_SPLIT * (STEM_FFT_SIZE + 2));
  assert.ok(magnitudes.some((value) => value > 0));
  assert.equal(getStemFrameCount(2400), Math.ceil((STEM_FRONT_PAD + 2400) / STEM_HOP_SIZE));
});

test("the four soft-ratio masks sum to one at every model bin", () => {
  const estimates = STEM_NAMES.map((_, stem) => {
    const values = new Float32Array(2 * STEM_FRAMES_PER_SPLIT * STEM_MODEL_BINS);
    for (let index = 0; index < values.length; index += 1) values[index] = stem + 1;
    return values;
  });
  const averages = applyStemRatioMasksInPlace(estimates);
  const sampleOffsets = [0, STEM_MODEL_BINS - 1, STEM_MODEL_BINS * 93 + 7, estimates[0].length - 1];
  for (const offset of sampleOffsets) {
    assert.ok(Math.abs(estimates.reduce((sum, mask) => sum + mask[offset], 0) - 1) < 1e-6);
  }
  assert.equal(averages.length, STEM_NAMES.length);
  assert.ok(averages.every((mask) => mask.length === 2 * STEM_FRAMES_PER_SPLIT));
});

test("overlap-add reconstructs the source when all four estimates are equal", () => {
  const fft = new FFT(STEM_FFT_SIZE);
  const sampleCount = 2400;
  const channels = Array.from({ length: 2 }, (_, channel) => Float32Array.from(
    { length: sampleCount },
    (_, index) => Math.sin((index + channel * 7) * 0.037) * 0.35 + (index === 1150 + channel ? 0.2 : 0),
  ));
  const activeFrames = getStemFrameCount(sampleCount);
  const { originalSpectrum } = createStemModelInput({
    channels,
    firstFrame: 0,
    activeFrames,
    fft,
  });
  const estimates = STEM_NAMES.map(() => new Float32Array(2 * STEM_FRAMES_PER_SPLIT * STEM_MODEL_BINS).fill(1));
  const averages = applyStemRatioMasksInPlace(estimates);
  const result = synthesizeStemSplit({ fft, originalSpectrum, estimates, maskAverages: averages, activeFrames });
  let maximumError = 0;

  for (let channel = 0; channel < 2; channel += 1) {
    for (let index = 0; index < sampleCount; index += 1) {
      const frameIndex = STEM_FRONT_PAD + index;
      let reconstructed = 0;
      for (let stem = 0; stem < STEM_NAMES.length; stem += 1) {
        reconstructed += result.accumulators[stem][channel][frameIndex] / result.windowSum[frameIndex];
      }
      maximumError = Math.max(maximumError, Math.abs(reconstructed - channels[channel][index]));
    }
  }

  assert.ok(maximumError < 2e-5, `round-trip maximum error was ${maximumError}`);
});

test("overlap-add preserves continuity across 512-frame model splits", () => {
  const fft = new FFT(STEM_FFT_SIZE);
  const sampleCount = STEM_FRAMES_PER_SPLIT * STEM_HOP_SIZE + 1200;
  const channels = Array.from({ length: 2 }, (_, channel) => Float32Array.from(
    { length: sampleCount },
    (_, index) => Math.sin((index + channel * 11) * 0.019) * 0.3 + (index === STEM_FRAMES_PER_SPLIT * STEM_HOP_SIZE - 1 ? 0.2 : 0),
  ));
  const frameCount = getStemFrameCount(sampleCount);
  assert.ok(frameCount > STEM_FRAMES_PER_SPLIT);
  const reconstructed = channels.map(() => new Float32Array(sampleCount));
  const window = createPeriodicHann();
  let carry;

  for (let firstFrame = 0; firstFrame < frameCount; firstFrame += STEM_FRAMES_PER_SPLIT) {
    const activeFrames = Math.min(STEM_FRAMES_PER_SPLIT, frameCount - firstFrame);
    const { originalSpectrum } = createStemModelInput({ channels, firstFrame, activeFrames, fft, window });
    const estimates = STEM_NAMES.map(() => new Float32Array(2 * STEM_FRAMES_PER_SPLIT * STEM_MODEL_BINS).fill(1));
    const maskAverages = applyStemRatioMasksInPlace(estimates);
    const synthesis = synthesizeStemSplit({ fft, originalSpectrum, estimates, maskAverages, activeFrames, window, carry });
    const chunkStart = firstFrame * STEM_HOP_SIZE;
    const isFinal = firstFrame + activeFrames >= frameCount;
    const flushUntil = isFinal ? Math.min(synthesis.splitSpan, STEM_FRONT_PAD + sampleCount - chunkStart) : synthesis.splitSpan;
    const firstOutputSample = Math.max(0, STEM_FRONT_PAD - chunkStart);
    const lastOutputSample = Math.min(flushUntil, STEM_FRONT_PAD + sampleCount - chunkStart);

    for (let sourceOffset = firstOutputSample; sourceOffset < lastOutputSample; sourceOffset += 1) {
      const outputIndex = chunkStart + sourceOffset - STEM_FRONT_PAD;
      const windowSum = synthesis.windowSum[sourceOffset];
      for (let channel = 0; channel < 2; channel += 1) {
        for (const stemChannels of synthesis.accumulators) reconstructed[channel][outputIndex] += stemChannels[channel][sourceOffset] / windowSum;
      }
    }

    carry = isFinal ? undefined : {
      accumulators: synthesis.accumulators.map((stemChannels) => stemChannels.map((audio) => audio.slice(synthesis.splitSpan))),
      windowSum: synthesis.windowSum.slice(synthesis.splitSpan),
    };
  }

  let maximumError = 0;
  for (let channel = 0; channel < 2; channel += 1) {
    for (let index = 0; index < sampleCount; index += 1) {
      maximumError = Math.max(maximumError, Math.abs(reconstructed[channel][index] - channels[channel][index]));
    }
  }
  assert.ok(maximumError < 2e-5, `two-split round-trip maximum error was ${maximumError}`);
});
