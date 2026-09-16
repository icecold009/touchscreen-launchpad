export const DEFAULT_MASTER_EFFECTS = Object.freeze({
  delayTime: 0.24,
  delayFeedback: 0.28,
  reverbDecay: 1.4,
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
  return {
    delayTime: clamp(Number(candidate.delayTime) || DEFAULT_MASTER_EFFECTS.delayTime, 0.05, 0.8),
    delayFeedback: clamp(Number(candidate.delayFeedback) || DEFAULT_MASTER_EFFECTS.delayFeedback, 0, 0.8),
    reverbDecay: clamp(Number(candidate.reverbDecay) || DEFAULT_MASTER_EFFECTS.reverbDecay, 0.2, 4),
  };
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
