import * as ort from "onnxruntime-web/webgpu";
import FFT from "fft.js";
import {
  STEM_FFT_SIZE,
  STEM_FRONT_PAD,
  STEM_FRAMES_PER_SPLIT,
  STEM_HOP_SIZE,
  STEM_MODEL_BINS,
  STEM_NAMES,
  STEM_SAMPLE_RATE,
  applyStemRatioMasksInPlace,
  createPeriodicHann,
  createStemModelInput,
  getStemFrameCount,
  synthesizeStemSplit,
} from "./stem-separation-dsp.js";

const MODEL_REVISION = "c716977ab2ac15b83411fa7d96f642b82e767a9c";
const MODEL_BASE = `https://huggingface.co/Best-Practice/spleeter-4stems-onnx/resolve/${MODEL_REVISION}`;
const MODEL_CACHE = "launchpad-spleeter-4stems-v1";
const MAX_MODEL_BYTES = 25 * 1024 * 1024;
const ESTIMATED_MODEL_BYTES = 20 * 1024 * 1024;
const MAX_STEM_BYTES = 50 * 1024 * 1024;
const AUDIO_DATA_START = 44;

function reportProgress(value, text) {
  self.postMessage({ type: "progress", value: Math.min(100, Math.max(0, value)), text });
}

async function cacheModel(cache, url, bytes) {
  if (!cache) return;
  try {
    await cache.put(url, new Response(bytes.slice(0), {
      headers: { "Content-Type": "application/octet-stream" },
    }));
  } catch {
    // The model stays usable for this run even if browser cache quota is unavailable.
  }
}

async function downloadModel(name, index, cache) {
  const url = `${MODEL_BASE}/${name.toLowerCase()}.fp16.onnx`;
  const cached = await cache?.match(url);
  if (cached) {
    const bytes = await cached.arrayBuffer();
    if (bytes.byteLength > 0 && bytes.byteLength <= MAX_MODEL_BYTES) {
      reportProgress(((index + 1) / STEM_NAMES.length) * 28, `Using cached ${name.toLowerCase()} model · ${index + 1}/${STEM_NAMES.length}`);
      return bytes;
    }
    await cache.delete(url);
  }

  const response = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!response.ok) throw new Error(`The ${name.toLowerCase()} separation model could not be downloaded (${response.status}).`);
  const expectedSize = Number(response.headers.get("content-length")) || ESTIMATED_MODEL_BYTES;
  if (expectedSize > MAX_MODEL_BYTES) throw new Error(`The ${name.toLowerCase()} separation model exceeds the 25 MB safety limit.`);

  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_MODEL_BYTES) throw new Error(`The ${name.toLowerCase()} separation model exceeds the 25 MB safety limit.`);
    await cacheModel(cache, url, new Uint8Array(bytes));
    reportProgress(((index + 1) / STEM_NAMES.length) * 28, `Downloaded ${name.toLowerCase()} model · ${index + 1}/${STEM_NAMES.length}`);
    return bytes;
  }

  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_MODEL_BYTES) {
      await reader.cancel();
      throw new Error(`The ${name.toLowerCase()} separation model exceeds the 25 MB safety limit.`);
    }
    chunks.push(value);
    const fileFraction = Math.min(1, received / expectedSize);
    const overall = ((index + fileFraction) / STEM_NAMES.length) * 28;
    reportProgress(overall, `Downloading ${name.toLowerCase()} model · ${Math.round(fileFraction * 100)}%`);
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (bytes.byteLength === 0) throw new Error(`The ${name.toLowerCase()} separation model download was empty.`);
  await cacheModel(cache, url, bytes);
  reportProgress(((index + 1) / STEM_NAMES.length) * 28, `Downloaded ${name.toLowerCase()} model · ${index + 1}/${STEM_NAMES.length}`);
  return bytes.buffer;
}

async function loadSessions(models, provider) {
  const sessions = [];
  try {
    for (let index = 0; index < models.length; index += 1) {
      sessions.push(await ort.InferenceSession.create(models[index], {
        executionProviders: [provider],
        graphOptimizationLevel: "all",
        enableCpuMemArena: provider === "wasm",
      }));
      reportProgress(28 + ((index + 1) / models.length) * 12, `Preparing ${STEM_NAMES[index].toLowerCase()} model · ${index + 1}/${models.length}`);
    }
    return sessions;
  } catch (error) {
    await Promise.allSettled(sessions.map((session) => session.release()));
    throw error;
  }
}

async function createInferenceSessions(models) {
  let webgpuFailure = null;
  if (globalThis.navigator?.gpu) {
    try {
      const adapter = await globalThis.navigator.gpu.requestAdapter();
      if (adapter) {
        const sessions = await loadSessions(models, "webgpu");
        return { provider: "WebGPU", sessions };
      }
    } catch (error) {
      webgpuFailure = error;
      reportProgress(28, "GPU setup unavailable · switching to browser CPU inference");
    }
  }
  try {
    return { provider: "CPU", sessions: await loadSessions(models, "wasm") };
  } catch (error) {
    const cpuFailure = error instanceof Error ? error.message : "runtime unavailable";
    const gpuFailure = webgpuFailure instanceof Error ? ` WebGPU setup also failed: ${webgpuFailure.message}` : "";
    throw new Error(`The local separation model could not start in this browser: ${cpuFailure}.${gpuFailure}`);
  }
}

function createWavBuffer(frameCount) {
  const dataSize = frameCount * 2 * 2;
  const bytes = new Uint8Array(AUDIO_DATA_START + dataSize);
  const view = new DataView(bytes.buffer);
  const ascii = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, STEM_SAMPLE_RATE, true);
  view.setUint32(28, STEM_SAMPLE_RATE * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataSize, true);
  return { bytes, view };
}

function writeSplitToWavs({ synthesis, wavs, chunkStart, flushUntil, sampleCount }) {
  const firstOutputSample = Math.max(0, STEM_FRONT_PAD - chunkStart);
  const lastOutputSample = Math.min(flushUntil, STEM_FRONT_PAD + sampleCount - chunkStart);
  for (let sourceOffset = firstOutputSample; sourceOffset < lastOutputSample; sourceOffset += 1) {
    const outputFrame = chunkStart + sourceOffset - STEM_FRONT_PAD;
    const weight = synthesis.windowSum[sourceOffset];
    const leftFactor = weight > 1e-8 ? 1 / weight : 0;
    for (let stem = 0; stem < wavs.length; stem += 1) {
      for (let channel = 0; channel < 2; channel += 1) {
        const value = synthesis.accumulators[stem][channel][sourceOffset] * leftFactor;
        const safe = Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));
        const byteOffset = AUDIO_DATA_START + (outputFrame * 2 + channel) * 2;
        wavs[stem].view.setInt16(byteOffset, safe < 0 ? Math.round(safe * 0x8000) : Math.round(safe * 0x7fff), true);
      }
    }
  }
}

async function separateSong({ channels, sampleRate }) {
  if (sampleRate !== STEM_SAMPLE_RATE) throw new Error("The audio must be resampled to 44.1 kHz before stem separation.");
  if (!Array.isArray(channels) || channels.length !== 2 || channels.some((channel) => !(channel instanceof Float32Array) || channel.length === 0)) {
    throw new Error("A decoded stereo song is required for stem separation.");
  }
  if (channels[0].length !== channels[1].length) throw new Error("The decoded stereo channels have different lengths.");
  const sampleCount = channels[0].length;
  const outputByteLength = AUDIO_DATA_START + sampleCount * 4;
  if (outputByteLength > MAX_STEM_BYTES) throw new Error("Each generated stem must fit within the 50 MB sample limit. Use a shorter song.");

  const cache = globalThis.caches ? await caches.open(MODEL_CACHE).catch(() => null) : null;
  const models = [];
  for (let index = 0; index < STEM_NAMES.length; index += 1) {
    models.push(await downloadModel(STEM_NAMES[index], index, cache));
  }
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.proxy = false;
  ort.env.wasm.wasmPaths = {
    mjs: new URL("./ort/ort-wasm-simd-threaded.asyncify.mjs", import.meta.url).href,
    wasm: new URL("./ort/ort-wasm-simd-threaded.asyncify.wasm", import.meta.url).href,
  };
  const { provider, sessions } = await createInferenceSessions(models);
  models.length = 0;
  const wavs = STEM_NAMES.map(() => createWavBuffer(sampleCount));
  const fft = new FFT(STEM_FFT_SIZE);
  const window = createPeriodicHann();
  const frameCount = getStemFrameCount(sampleCount);
  const chunkCount = Math.ceil(frameCount / STEM_FRAMES_PER_SPLIT);
  let carry;

  try {
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      const firstFrame = chunkIndex * STEM_FRAMES_PER_SPLIT;
      const activeFrames = Math.min(STEM_FRAMES_PER_SPLIT, frameCount - firstFrame);
      const { magnitudes, originalSpectrum } = createStemModelInput({ channels, firstFrame, activeFrames, fft, window });
      const tensor = new ort.Tensor("float32", magnitudes, [2, 1, STEM_FRAMES_PER_SPLIT, STEM_MODEL_BINS]);
      const estimates = [];
      for (let stem = 0; stem < sessions.length; stem += 1) {
        const session = sessions[stem];
        const result = await session.run({ [session.inputNames[0]]: tensor });
        const output = result[session.outputNames[0]];
        if (!output || output.dims.reduce((product, dimension) => product * dimension, 1) !== magnitudes.length) {
          throw new Error(`The ${STEM_NAMES[stem].toLowerCase()} model returned an unexpected output shape.`);
        }
        estimates.push(output.data instanceof Float32Array ? output.data : Float32Array.from(output.data));
      }
      const maskAverages = applyStemRatioMasksInPlace(estimates);
      const synthesis = synthesizeStemSplit({ fft, originalSpectrum, estimates, maskAverages, activeFrames, window, carry });
      const chunkStart = firstFrame * STEM_HOP_SIZE;
      const isFinal = chunkIndex === chunkCount - 1;
      const flushUntil = isFinal ? Math.min(synthesis.splitSpan, STEM_FRONT_PAD + sampleCount - chunkStart) : synthesis.splitSpan;
      writeSplitToWavs({ synthesis, wavs, chunkStart, flushUntil, sampleCount });
      carry = isFinal ? undefined : {
        accumulators: synthesis.accumulators.map((channelsForStem) => channelsForStem.map((channel) => channel.slice(synthesis.splitSpan))),
        windowSum: synthesis.windowSum.slice(synthesis.splitSpan),
      };
      const value = 40 + ((chunkIndex + 1) / chunkCount) * 60;
      reportProgress(value, `Separated ${chunkIndex + 1}/${chunkCount} song section${chunkCount === 1 ? "" : "s"} · ${provider}`);
    }
  } finally {
    await Promise.allSettled(sessions.map((session) => session.release()));
  }

  return wavs.map((wav, index) => ({ name: STEM_NAMES[index], audio: wav.bytes.buffer }));
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
