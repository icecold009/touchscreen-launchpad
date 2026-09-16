import assert from "node:assert/strict";
import test from "node:test";

import { encodePcmWav } from "../src/wav.js";

test("PCM WAV export writes deterministic RIFF metadata and clamped samples", () => {
  const channels = [[-1, -0.5, 0, 0.5, 1]];
  const buffer = {
    numberOfChannels: 1,
    sampleRate: 8000,
    length: 5,
    getChannelData: () => Float32Array.from(channels[0]),
  };
  const bytes = encodePcmWav(buffer);
  assert.equal(bytes.byteLength, 54);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), "WAVE");
  assert.equal(new DataView(bytes.buffer).getUint32(24, true), 8000);
  assert.equal(new DataView(bytes.buffer).getUint32(40, true), 10);
  assert.deepEqual([...bytes.slice(44, 54)], [0, 128, 0, 192, 0, 0, 255, 63, 255, 127]);
});
