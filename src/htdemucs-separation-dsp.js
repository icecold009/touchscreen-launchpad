export const HTDEMUCS_SAMPLE_RATE = 44100;
export const HTDEMUCS_SEGMENT_SAMPLES = 343980;
export const HTDEMUCS_OVERLAP_SAMPLES = Math.floor(HTDEMUCS_SEGMENT_SAMPLES / 4);
export const HTDEMUCS_STRIDE_SAMPLES = HTDEMUCS_SEGMENT_SAMPLES - HTDEMUCS_OVERLAP_SAMPLES;
export const HTDEMUCS_STEM_NAMES = ["Drums", "Bass", "Vocals", "Other"];

const MODEL_ROW_FOR_STEM = [0, 1, 3, 2];

export function getHtdemucsChunkCount(sampleCount, segmentSamples = HTDEMUCS_SEGMENT_SAMPLES, overlapSamples = Math.floor(segmentSamples / 4)) {
  if (!Number.isInteger(sampleCount) || sampleCount < 1) throw new RangeError("Audio must contain at least one sample.");
  if (!Number.isInteger(segmentSamples) || segmentSamples < 2) throw new RangeError("The model segment must contain at least two samples.");
  if (!Number.isInteger(overlapSamples) || overlapSamples < 1 || overlapSamples >= segmentSamples) throw new RangeError("The model overlap is outside the supported range.");
  const stride = segmentSamples - overlapSamples;
  return Math.max(1, Math.ceil(Math.max(0, sampleCount - overlapSamples) / stride));
}

export function getHtdemucsChunkStart(chunkIndex, segmentSamples = HTDEMUCS_SEGMENT_SAMPLES, overlapSamples = Math.floor(segmentSamples / 4)) {
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) throw new RangeError("The model chunk index is invalid.");
  if (!Number.isInteger(segmentSamples) || segmentSamples < 2) throw new RangeError("The model segment must contain at least two samples.");
  if (!Number.isInteger(overlapSamples) || overlapSamples < 1 || overlapSamples >= segmentSamples) throw new RangeError("The model overlap is outside the supported range.");
  return chunkIndex * (segmentSamples - overlapSamples);
}

function makeTransitionWindow(chunkIndex, chunkCount, segmentSamples, overlapSamples) {
  const window = new Float32Array(segmentSamples).fill(1);
  const lastRampIndex = Math.max(1, overlapSamples - 1);
  if (chunkIndex > 0) {
    for (let index = 0; index < overlapSamples; index += 1) window[index] = index / lastRampIndex;
  }
  if (chunkIndex < chunkCount - 1) {
    const transitionStart = segmentSamples - overlapSamples;
    for (let index = 0; index < overlapSamples; index += 1) window[transitionStart + index] = 1 - index / lastRampIndex;
  }
  return window;
}

export function createHtdemucsOverlapAdder({
  sampleCount,
  onWrite,
  segmentSamples = HTDEMUCS_SEGMENT_SAMPLES,
  overlapSamples = Math.floor(segmentSamples / 4),
  stemCount = HTDEMUCS_STEM_NAMES.length,
} = {}) {
  if (typeof onWrite !== "function") throw new TypeError("An output writer is required for separated audio.");
  if (!Number.isInteger(stemCount) || stemCount < 1) throw new RangeError("At least one output stem is required.");

  const chunkCount = getHtdemucsChunkCount(sampleCount, segmentSamples, overlapSamples);
  const stride = segmentSamples - overlapSamples;
  let nextChunk = 0;
  let carry = null;

  return {
    chunkCount,
    stride,
    push(predictions, chunkIndex) {
      if (chunkIndex !== nextChunk || chunkIndex >= chunkCount) throw new RangeError("HT-Demucs chunks must be added once, in order.");
      if (!Array.isArray(predictions) || predictions.length !== stemCount || predictions.some((stem) => !Array.isArray(stem) || stem.length !== 2 || stem.some((channel) => !(channel instanceof Float32Array) || channel.length !== segmentSamples))) {
        throw new TypeError("Each HT-Demucs prediction must contain one full stereo segment per stem.");
      }

      const start = getHtdemucsChunkStart(chunkIndex, segmentSamples, overlapSamples);
      const activeSamples = Math.min(segmentSamples, sampleCount - start);
      const transition = makeTransitionWindow(chunkIndex, chunkCount, segmentSamples, overlapSamples);
      const weights = new Float32Array(segmentSamples);
      const sums = Array.from({ length: stemCount }, () => [new Float32Array(segmentSamples), new Float32Array(segmentSamples)]);
      if (carry) {
        weights.set(carry.weights);
        for (let stem = 0; stem < stemCount; stem += 1) {
          for (let channel = 0; channel < 2; channel += 1) sums[stem][channel].set(carry.sums[stem][channel]);
        }
      }

      for (let sample = 0; sample < activeSamples; sample += 1) {
        const weight = transition[sample];
        weights[sample] += weight;
        for (let stem = 0; stem < stemCount; stem += 1) {
          for (let channel = 0; channel < 2; channel += 1) sums[stem][channel][sample] += predictions[stem][channel][sample] * weight;
        }
      }

      const isLast = chunkIndex === chunkCount - 1;
      const flushSamples = isLast ? activeSamples : stride;
      const output = Array.from({ length: stemCount }, () => [new Float32Array(flushSamples), new Float32Array(flushSamples)]);
      for (let sample = 0; sample < flushSamples; sample += 1) {
        const weight = weights[sample];
        for (let stem = 0; stem < stemCount; stem += 1) {
          for (let channel = 0; channel < 2; channel += 1) output[stem][channel][sample] = weight > 1e-8 ? sums[stem][channel][sample] / weight : 0;
        }
      }
      onWrite({ start, stems: output, sampleCount: flushSamples });

      carry = isLast ? null : {
        sums: sums.map((channels) => channels.map((samples) => samples.slice(stride))),
        weights: weights.slice(stride),
      };
      nextChunk += 1;
      return { complete: isLast, activeSamples, start };
    },
  };
}

export function getHtdemucsModelRow(outputStemIndex) {
  return MODEL_ROW_FOR_STEM[outputStemIndex] ?? -1;
}
