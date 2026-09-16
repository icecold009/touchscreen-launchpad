export const DEFAULT_MASTER_EFFECTS = Object.freeze({
  delayTime: 0.24,
  delayFeedback: 0.28,
  reverbDecay: 1.4,
  eqLowDb: 0,
  eqMidDb: 0,
  eqHighDb: 0,
  compressorThreshold: -18,
  compressorRatio: 4,
  limiterThreshold: -1,
});

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeEffectSends(candidate = {}) {
  return {
    reverb: clamp(Number(candidate.reverb) || 0, 0, 1),
    delay: clamp(Number(candidate.delay) || 0, 0, 1),
  };
}

export function normalizeMasterEffects(candidate = {}) {
  const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  return {
    delayTime: clamp(numberOr(candidate.delayTime, DEFAULT_MASTER_EFFECTS.delayTime), 0.05, 0.8),
    delayFeedback: clamp(numberOr(candidate.delayFeedback, DEFAULT_MASTER_EFFECTS.delayFeedback), 0, 0.8),
    reverbDecay: clamp(numberOr(candidate.reverbDecay, DEFAULT_MASTER_EFFECTS.reverbDecay), 0.2, 4),
    eqLowDb: clamp(numberOr(candidate.eqLowDb, DEFAULT_MASTER_EFFECTS.eqLowDb), -12, 12),
    eqMidDb: clamp(numberOr(candidate.eqMidDb, DEFAULT_MASTER_EFFECTS.eqMidDb), -12, 12),
    eqHighDb: clamp(numberOr(candidate.eqHighDb, DEFAULT_MASTER_EFFECTS.eqHighDb), -12, 12),
    compressorThreshold: clamp(numberOr(candidate.compressorThreshold, DEFAULT_MASTER_EFFECTS.compressorThreshold), -60, 0),
    compressorRatio: clamp(numberOr(candidate.compressorRatio, DEFAULT_MASTER_EFFECTS.compressorRatio), 1, 20),
    limiterThreshold: clamp(numberOr(candidate.limiterThreshold, DEFAULT_MASTER_EFFECTS.limiterThreshold), -12, 0),
  };
}

export function detectPeak(samples, threshold = 0.98) {
  if (!samples || typeof samples.length !== "number") return { peak: 0, clipping: false };
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(Number(sample) || 0));
  return { peak, clipping: peak >= clamp(Number(threshold) || 0.98, 0.1, 1) };
}

export function createImpulseResponse(audioContext, decaySeconds = 1.4) {
  if (!audioContext?.createBuffer) return null;
  const duration = clamp(Number(decaySeconds) || 1.4, 0.2, 4);
  const length = Math.max(1, Math.floor(audioContext.sampleRate * duration));
  const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, 2);
    }
  }
  return impulse;
}
