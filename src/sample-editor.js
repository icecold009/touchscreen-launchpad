function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeSampleRegion(region = {}) {
  const start = clamp(Number(region.start) || 0, 0, 1);
  const end = Math.max(start, clamp(Number.isFinite(Number(region.end)) ? Number(region.end) : 1, 0, 1));
  const loopStart = clamp(Number.isFinite(Number(region.loopStart)) ? Number(region.loopStart) : start, start, end);
  const loopEnd = Math.max(loopStart, clamp(Number.isFinite(Number(region.loopEnd)) ? Number(region.loopEnd) : end, start, end));
  return { start, end, loopStart, loopEnd, reverse: region.reverse === true };
}

export function createPlaybackPlan({ duration, region, timeStretch = 1, pitchCents = 0 } = {}) {
  const safeDuration = Math.max(0.001, Number(duration) || 0.001);
  const normalized = normalizeSampleRegion(region);
  const mappedRegion = normalized.reverse
    ? {
      start: 1 - normalized.end,
      end: 1 - normalized.start,
      loopStart: 1 - normalized.loopEnd,
      loopEnd: 1 - normalized.loopStart,
      reverse: true,
    }
    : normalized;
  const offset = mappedRegion.start * safeDuration;
  const end = mappedRegion.end * safeDuration;
  return {
    offset,
    duration: Math.max(0.001, end - offset),
    loopStart: mappedRegion.loopStart * safeDuration,
    loopEnd: Math.max(mappedRegion.loopStart * safeDuration + 0.001, mappedRegion.loopEnd * safeDuration),
    playbackRate: clamp(Number(timeStretch) || 1, 0.25, 4),
    detune: clamp(Number(pitchCents) || 0, -2400, 2400),
    reverse: normalized.reverse,
  };
}

export function createWaveformPeaks(buffer, pointCount = 160) {
  if (!buffer || typeof buffer.getChannelData !== "function") return [];
  const data = buffer.getChannelData(0);
  const count = Math.max(8, Math.floor(Number(pointCount) || 160));
  const peaks = [];
  const step = Math.max(1, Math.floor(data.length / count));
  for (let index = 0; index < count; index += 1) {
    const start = index * step;
    const end = Math.min(data.length, start + step);
    let peak = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) peak = Math.max(peak, Math.abs(data[sampleIndex]));
    peaks.push(peak);
  }
  return peaks;
}

export function drawWaveform(canvas, buffer, region = {}) {
  if (!canvas?.getContext) return false;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f3f4f8";
  context.fillRect(0, 0, width, height);
  const peaks = createWaveformPeaks(buffer, width);
  context.fillStyle = "#7891e8";
  const midpoint = height / 2;
  peaks.forEach((peak, index) => {
    const barHeight = Math.max(1, peak * height * 0.85);
    context.fillRect(index, midpoint - barHeight / 2, 1, barHeight);
  });
  const normalized = normalizeSampleRegion(region);
  context.fillStyle = "rgba(48, 69, 128, 0.12)";
  context.fillRect(0, 0, width * normalized.start, height);
  context.fillRect(width * normalized.end, 0, width * (1 - normalized.end), height);
  context.strokeStyle = "#304580";
  context.lineWidth = 2;
  for (const position of [normalized.start, normalized.end]) {
    const x = Math.round(width * position) + 0.5;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  return true;
}

export function createReversedBuffer(audioContext, buffer) {
  if (!audioContext?.createBuffer || !buffer) return null;
  const reversed = audioContext.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const source = buffer.getChannelData(channel);
    const target = reversed.getChannelData(channel);
    for (let index = 0; index < source.length; index += 1) target[index] = source[source.length - index - 1];
  }
  return reversed;
}
