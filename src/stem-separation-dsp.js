export const STEM_SAMPLE_RATE = 44100;
export const STEM_FFT_SIZE = 4096;
export const STEM_HOP_SIZE = 1024;
export const STEM_FRAMES_PER_SPLIT = 512;
export const STEM_MODEL_BINS = 1024;
export const STEM_SPECTRUM_BINS = STEM_FFT_SIZE / 2 + 1;
export const STEM_FRONT_PAD = STEM_FFT_SIZE - STEM_HOP_SIZE;
export const STEM_NAMES = ["Drums", "Bass", "Vocals", "Other"];

const MASK_EPSILON = 1e-10;
const PRESERVED_OVERLAP = STEM_FFT_SIZE - STEM_HOP_SIZE;

export function createPeriodicHann(size = STEM_FFT_SIZE) {
  if (!Number.isInteger(size) || size <= 1) throw new RangeError("A window size greater than one is required.");
  return Float32Array.from({ length: size }, (_, index) => 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / size));
}

export function getStemFrameCount(sampleCount) {
  if (!Number.isInteger(sampleCount) || sampleCount < 1) throw new RangeError("Audio must contain at least one sample.");
  return Math.ceil((STEM_FRONT_PAD + sampleCount) / STEM_HOP_SIZE);
}

export function createStemModelInput({ channels, firstFrame, activeFrames, fft, window = createPeriodicHann() }) {
  if (!Array.isArray(channels) || channels.length !== 2 || channels.some((channel) => !(channel instanceof Float32Array))) {
    throw new TypeError("Stem separation needs two decoded Float32 audio channels.");
  }
  if (!Number.isInteger(firstFrame) || firstFrame < 0 || !Number.isInteger(activeFrames) || activeFrames < 1 || activeFrames > STEM_FRAMES_PER_SPLIT) {
    throw new RangeError("The stem audio split is outside the supported frame range.");
  }
  if (!fft || fft.size !== STEM_FFT_SIZE) throw new TypeError("A 4096-point FFT instance is required.");
  if (!(window instanceof Float32Array) || window.length !== STEM_FFT_SIZE) throw new TypeError("The periodic Hann window is invalid.");

  const frameSpectrumSize = STEM_SPECTRUM_BINS * 2;
  const originalSpectrum = new Float32Array(2 * STEM_FRAMES_PER_SPLIT * frameSpectrumSize);
  const magnitudes = new Float32Array(2 * STEM_FRAMES_PER_SPLIT * STEM_MODEL_BINS);
  const timeFrame = new Float32Array(STEM_FFT_SIZE);
  const complexFrame = new Float64Array(STEM_FFT_SIZE * 2);

  for (let channel = 0; channel < 2; channel += 1) {
    const channelFrameOffset = channel * STEM_FRAMES_PER_SPLIT;
    for (let frame = 0; frame < activeFrames; frame += 1) {
      const sourceStart = (firstFrame + frame) * STEM_HOP_SIZE - STEM_FRONT_PAD;
      for (let sample = 0; sample < STEM_FFT_SIZE; sample += 1) {
        const sourceIndex = sourceStart + sample;
        timeFrame[sample] = (sourceIndex >= 0 && sourceIndex < channels[channel].length ? channels[channel][sourceIndex] : 0) * window[sample];
      }

      complexFrame.fill(0);
      fft.realTransform(complexFrame, timeFrame);
      fft.completeSpectrum(complexFrame);
      const frameIndex = channelFrameOffset + frame;
      const spectrumOffset = frameIndex * frameSpectrumSize;
      const magnitudeOffset = frameIndex * STEM_MODEL_BINS;
      for (let bin = 0; bin < STEM_SPECTRUM_BINS; bin += 1) {
        const real = complexFrame[bin * 2];
        const imaginary = complexFrame[bin * 2 + 1];
        originalSpectrum[spectrumOffset + bin * 2] = real;
        originalSpectrum[spectrumOffset + bin * 2 + 1] = imaginary;
        if (bin < STEM_MODEL_BINS) magnitudes[magnitudeOffset + bin] = Math.hypot(real, imaginary);
      }
    }
  }

  return { magnitudes, originalSpectrum };
}

export function applyStemRatioMasksInPlace(estimates) {
  if (!Array.isArray(estimates) || estimates.length !== STEM_NAMES.length) {
    throw new TypeError("Four model estimates are required to build ratio masks.");
  }
  const expectedSize = 2 * STEM_FRAMES_PER_SPLIT * STEM_MODEL_BINS;
  if (estimates.some((estimate) => !(estimate instanceof Float32Array) || estimate.length !== expectedSize)) {
    throw new RangeError("A model returned a stem estimate with an unexpected shape.");
  }

  const averages = estimates.map(() => new Float32Array(2 * STEM_FRAMES_PER_SPLIT));
  for (let channel = 0; channel < 2; channel += 1) {
    for (let frame = 0; frame < STEM_FRAMES_PER_SPLIT; frame += 1) {
      const frameOffset = (channel * STEM_FRAMES_PER_SPLIT + frame) * STEM_MODEL_BINS;
      const frameAverageOffset = channel * STEM_FRAMES_PER_SPLIT + frame;
      const maskTotals = new Float64Array(estimates.length);
      for (let bin = 0; bin < STEM_MODEL_BINS; bin += 1) {
        const offset = frameOffset + bin;
        const drum = Math.max(0, estimates[0][offset] || 0);
        const bass = Math.max(0, estimates[1][offset] || 0);
        const vocals = Math.max(0, estimates[2][offset] || 0);
        const other = Math.max(0, estimates[3][offset] || 0);
        const energyTotal = MASK_EPSILON + drum * drum + bass * bass + vocals * vocals + other * other;
        const drumMask = (drum * drum + MASK_EPSILON / STEM_NAMES.length) / energyTotal;
        const bassMask = (bass * bass + MASK_EPSILON / STEM_NAMES.length) / energyTotal;
        const vocalsMask = (vocals * vocals + MASK_EPSILON / STEM_NAMES.length) / energyTotal;
        const otherMask = (other * other + MASK_EPSILON / STEM_NAMES.length) / energyTotal;
        estimates[0][offset] = drumMask;
        estimates[1][offset] = bassMask;
        estimates[2][offset] = vocalsMask;
        estimates[3][offset] = otherMask;
        maskTotals[0] += drumMask;
        maskTotals[1] += bassMask;
        maskTotals[2] += vocalsMask;
        maskTotals[3] += otherMask;
      }
      for (let stem = 0; stem < estimates.length; stem += 1) averages[stem][frameAverageOffset] = maskTotals[stem] / STEM_MODEL_BINS;
    }
  }
  return averages;
}

export function synthesizeStemSplit({ fft, originalSpectrum, estimates, maskAverages, activeFrames, window = createPeriodicHann(), carry }) {
  if (!fft || fft.size !== STEM_FFT_SIZE) throw new TypeError("A 4096-point FFT instance is required.");
  if (!Number.isInteger(activeFrames) || activeFrames < 1 || activeFrames > STEM_FRAMES_PER_SPLIT) throw new RangeError("The active frame count is invalid.");
  const frameSpectrumSize = STEM_SPECTRUM_BINS * 2;
  const expectedSpectrumSize = 2 * STEM_FRAMES_PER_SPLIT * frameSpectrumSize;
  if (!(originalSpectrum instanceof Float32Array) || originalSpectrum.length !== expectedSpectrumSize) throw new RangeError("The source spectrogram has an unexpected shape.");
  if (!Array.isArray(estimates) || estimates.length !== STEM_NAMES.length || !Array.isArray(maskAverages) || maskAverages.length !== STEM_NAMES.length) {
    throw new TypeError("Four masked estimates are required for synthesis.");
  }

  const splitSpan = activeFrames * STEM_HOP_SIZE;
  const bufferLength = splitSpan + PRESERVED_OVERLAP;
  const accumulators = estimates.map(() => [new Float32Array(bufferLength), new Float32Array(bufferLength)]);
  const windowSum = new Float32Array(bufferLength);
  if (carry) {
    const preserved = Math.min(PRESERVED_OVERLAP, carry.windowSum.length, bufferLength);
    windowSum.set(carry.windowSum.subarray(0, preserved));
    for (let stem = 0; stem < STEM_NAMES.length; stem += 1) {
      for (let channel = 0; channel < 2; channel += 1) {
        accumulators[stem][channel].set(carry.accumulators[stem][channel].subarray(0, preserved));
      }
    }
  }

  const frameOutput = new Float64Array(STEM_FFT_SIZE * 2);
  const maskedSpectrum = new Float64Array(STEM_FFT_SIZE * 2);
  for (let frame = 0; frame < activeFrames; frame += 1) {
    const start = frame * STEM_HOP_SIZE;
    for (let sample = 0; sample < STEM_FFT_SIZE; sample += 1) {
      windowSum[start + sample] += window[sample] * window[sample];
    }

    for (let channel = 0; channel < 2; channel += 1) {
      const sourceFrameIndex = channel * STEM_FRAMES_PER_SPLIT + frame;
      const sourceOffset = sourceFrameIndex * frameSpectrumSize;
      const modelOffset = sourceFrameIndex * STEM_MODEL_BINS;
      for (let stem = 0; stem < STEM_NAMES.length; stem += 1) {
        for (let bin = 0; bin < STEM_FFT_SIZE; bin += 1) {
          const sourceBin = bin <= STEM_FFT_SIZE / 2 ? bin : STEM_FFT_SIZE - bin;
          const mask = sourceBin < STEM_MODEL_BINS
            ? estimates[stem][modelOffset + sourceBin]
            : maskAverages[stem][sourceFrameIndex];
          const sourceReal = originalSpectrum[sourceOffset + sourceBin * 2];
          const sourceImaginary = originalSpectrum[sourceOffset + sourceBin * 2 + 1];
          const conjugateSign = bin > STEM_FFT_SIZE / 2 ? -1 : 1;
          maskedSpectrum[bin * 2] = sourceReal * mask;
          maskedSpectrum[bin * 2 + 1] = sourceImaginary * mask * conjugateSign;
        }

        fft.inverseTransform(frameOutput, maskedSpectrum);
        const left = accumulators[stem][channel];
        for (let sample = 0; sample < STEM_FFT_SIZE; sample += 1) {
          left[start + sample] += frameOutput[sample * 2] * window[sample];
        }
      }
    }
  }

  return { accumulators, windowSum, splitSpan };
}
