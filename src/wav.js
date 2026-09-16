function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

export function encodePcmWav(audioBuffer) {
  if (!audioBuffer || typeof audioBuffer.getChannelData !== "function") {
    throw new Error("A decoded audio buffer is required for WAV export.");
  }
  const channelCount = Math.max(1, Math.min(2, Math.floor(Number(audioBuffer.numberOfChannels) || 1)));
  const sampleRate = Math.max(8000, Math.min(192000, Math.floor(Number(audioBuffer.sampleRate) || 44100)));
  const frameCount = Math.max(1, Math.floor(Number(audioBuffer.length) || 0));
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const view = new DataView(new ArrayBuffer(44 + dataSize));
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channels = Array.from({ length: channelCount }, (_, channel) => audioBuffer.getChannelData(Math.min(channel, audioBuffer.numberOfChannels - 1)));
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = clamp(Number(channels[channel]?.[frame]) || 0, -1, 1);
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Uint8Array(view.buffer);
}
