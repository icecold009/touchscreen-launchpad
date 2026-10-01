import * as ort from "onnxruntime-web/webgpu";
import {
  createHtdemucsOverlapAdder,
  getHtdemucsChunkStart,
  getHtdemucsModelRow,
  HTDEMUCS_SAMPLE_RATE,
  HTDEMUCS_SEGMENT_SAMPLES,
  HTDEMUCS_STEM_NAMES,
} from "./htdemucs-separation-dsp.js";

const MODEL_REVISION = "d54ed9eb60e258ea82131c6ee14578628816456a";
const MODEL_URL = `https://huggingface.co/StemSplitio/htdemucs-onnx/resolve/${MODEL_REVISION}/htdemucs_fp16weights.onnx`;
const MODEL_SHA256 = "d05c269d0178d2a72ad484b10b11dd370193fc923201c3b27a99f848745db70a";
const MODEL_CACHE = "launchpad-htdemucs-onnx-v1";
const MODEL_BYTES = 165612636;
const MAX_STEM_BYTES = 50 * 1024 * 1024;
const WAV_HEADER_BYTES = 44;

function reportProgress(value, text) {
  self.postMessage({ type: "progress", value: Math.max(0, Math.min(100, value)), text });
}

async function hasExpectedDigest(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error("This browser cannot verify the separation model. Open the site on localhost or HTTPS and try again.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const actual = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return actual === MODEL_SHA256;
}

async function cacheModel(cache, bytes) {
  if (!cache) return;
  try {
    await cache.put(MODEL_URL, new Response(bytes.slice(0), { headers: { "Content-Type": "application/octet-stream" } }));
  } catch {
    // The downloaded weights remain usable if the browser cache is full.
  }
}

async function downloadModel() {
  const cache = globalThis.caches ? await caches.open(MODEL_CACHE).catch(() => null) : null;
  const cached = await cache?.match(MODEL_URL);
  if (cached) {
    const bytes = await cached.arrayBuffer();
    if (bytes.byteLength === MODEL_BYTES && await hasExpectedDigest(bytes)) {
      reportProgress(26, "Loaded cached HT-Demucs model · verified");
      return bytes;
    }
    await cache.delete(MODEL_URL);
  }

  const response = await fetch(MODEL_URL, { mode: "cors", credentials: "omit" });
  if (!response.ok) throw new Error(`The HT-Demucs model could not be downloaded (${response.status}).`);
  const sizeHeader = Number(response.headers.get("content-length"));
  if (sizeHeader && sizeHeader !== MODEL_BYTES) throw new Error("The HT-Demucs model download has an unexpected size.");
  const reader = response.body?.getReader();
  let bytes;
  if (reader) {
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MODEL_BYTES) {
        await reader.cancel();
        throw new Error("The HT-Demucs model is larger than the verified download.");
      }
      chunks.push(value);
      reportProgress((received / MODEL_BYTES) * 26, `Downloading HT-Demucs · ${Math.round((received / MODEL_BYTES) * 100)}%`);
    }
    bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } else {
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  if (bytes.byteLength !== MODEL_BYTES || !(await hasExpectedDigest(bytes))) {
    throw new Error("The HT-Demucs model failed its size or integrity check. No stems were created.");
  }
  await cacheModel(cache, bytes);
  reportProgress(26, "Downloaded HT-Demucs model · verified");
  return bytes.buffer;
}

async function createInferenceSession(model) {
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = {
    mjs: new URL("./ort/ort-wasm-simd-threaded.asyncify.mjs", import.meta.url).href,
    wasm: new URL("./ort/ort-wasm-simd-threaded.asyncify.wasm", import.meta.url).href,
  };

  let webgpuError = null;
  if (globalThis.navigator?.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        const session = await ort.InferenceSession.create(model, {
          executionProviders: ["webgpu", "wasm"],
          graphOptimizationLevel: "all",
        });
        return { provider: "WebGPU", session };
      }
    } catch (error) {
      webgpuError = error;
      reportProgress(26, "GPU is unavailable · using browser CPU inference");
    }
  }

  try {
    const session = await ort.InferenceSession.create(model, {
      executionProviders: ["wasm"],
      graphOptimizationLevel: "all",
      enableCpuMemArena: true,
    });
    return { provider: "CPU", session };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "runtime unavailable";
    const gpuReason = webgpuError instanceof Error ? ` GPU setup also failed: ${webgpuError.message}` : "";
    throw new Error(`HT-Demucs could not start in this browser: ${reason}.${gpuReason}`);
  }
}

function createWavBuffer(sampleCount) {
  const dataBytes = sampleCount * 4;
  const bytes = new Uint8Array(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(bytes.buffer);
  const ascii = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, HTDEMUCS_SAMPLE_RATE, true);
  view.setUint32(28, HTDEMUCS_SAMPLE_RATE * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);
  return { bytes, view };
}

function writeAudioBlock({ wavs, start, stems, sampleCount }) {
  for (let stem = 0; stem < wavs.length; stem += 1) {
    for (let channel = 0; channel < 2; channel += 1) {
      for (let sample = 0; sample < sampleCount; sample += 1) {
        const value = stems[stem][channel][sample];
        const safe = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
        const frame = start + sample;
        const byteOffset = WAV_HEADER_BYTES + (frame * 2 + channel) * 2;
        wavs[stem].view.setInt16(byteOffset, safe < 0 ? Math.round(safe * 0x8000) : Math.round(safe * 0x7fff), true);
      }
    }
  }
}

async function separateSong({ channels, sampleRate }) {
  if (sampleRate !== HTDEMUCS_SAMPLE_RATE) throw new Error("The song must be resampled to 44.1 kHz before HT-Demucs separation.");
  if (!Array.isArray(channels) || channels.length !== 2 || channels.some((channel) => !(channel instanceof Float32Array) || channel.length === 0)) {
    throw new Error("A decoded stereo song is required for HT-Demucs separation.");
  }
  if (channels[0].length !== channels[1].length) throw new Error("The decoded stereo channels have different lengths.");
  const sampleCount = channels[0].length;
  if (WAV_HEADER_BYTES + sampleCount * 4 > MAX_STEM_BYTES) throw new Error("Each generated stem must fit within the 50 MB sample limit. Use a shorter song.");

  const model = await downloadModel();
  reportProgress(27, "Preparing HT-Demucs model · browser-local inference");
  const { provider, session } = await createInferenceSession(model);
  const wavs = HTDEMUCS_STEM_NAMES.map(() => createWavBuffer(sampleCount));
  const overlapAdder = createHtdemucsOverlapAdder({
    sampleCount,
    onWrite: (block) => writeAudioBlock({ wavs, ...block }),
  });

  try {
    for (let chunkIndex = 0; chunkIndex < overlapAdder.chunkCount; chunkIndex += 1) {
      const start = getHtdemucsChunkStart(chunkIndex);
      const activeSamples = Math.min(HTDEMUCS_SEGMENT_SAMPLES, sampleCount - start);
      const input = new Float32Array(2 * HTDEMUCS_SEGMENT_SAMPLES);
      input.set(channels[0].subarray(start, start + activeSamples), 0);
      input.set(channels[1].subarray(start, start + activeSamples), HTDEMUCS_SEGMENT_SAMPLES);
      const tensor = new ort.Tensor("float32", input, [1, 2, HTDEMUCS_SEGMENT_SAMPLES]);
      let result;
      try {
        result = await session.run({ mix: tensor });
      } finally {
        tensor.dispose?.();
      }

      const prediction = result?.stems;
      const expectedValues = 4 * 2 * HTDEMUCS_SEGMENT_SAMPLES;
      if (!prediction || prediction.dims.reduce((product, dimension) => product * dimension, 1) !== expectedValues) {
        throw new Error("HT-Demucs returned an unexpected four-stem shape.");
      }
      const values = prediction.data instanceof Float32Array ? prediction.data : Float32Array.from(prediction.data);
      const separated = HTDEMUCS_STEM_NAMES.map((_, stemIndex) => {
        const modelRow = getHtdemucsModelRow(stemIndex);
        const rowStart = modelRow * 2 * HTDEMUCS_SEGMENT_SAMPLES;
        return [
          values.subarray(rowStart, rowStart + HTDEMUCS_SEGMENT_SAMPLES),
          values.subarray(rowStart + HTDEMUCS_SEGMENT_SAMPLES, rowStart + 2 * HTDEMUCS_SEGMENT_SAMPLES),
        ];
      });
      overlapAdder.push(separated, chunkIndex);
      reportProgress(27 + ((chunkIndex + 1) / overlapAdder.chunkCount) * 73, `Separated ${chunkIndex + 1}/${overlapAdder.chunkCount} song section${overlapAdder.chunkCount === 1 ? "" : "s"} · HT-Demucs ${provider}`);
      prediction.dispose?.();
    }
  } finally {
    await session.release();
  }

  return wavs.map((wav, index) => ({ name: HTDEMUCS_STEM_NAMES[index], audio: wav.bytes.buffer }));
}

self.addEventListener("message", async (event) => {
  if (event.data?.type !== "separate") return;
  try {
    const stems = await separateSong(event.data);
    self.postMessage({ type: "complete", stems }, stems.map((stem) => stem.audio));
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : "The song could not be separated." });
  }
});
