const PAD_COUNT = 16;
const LAYOUT_STORAGE_KEY = "touchscreen-launchpad.layout.v1";
const DATABASE_NAME = "touchscreen-launchpad";
const DATABASE_VERSION = 1;
const MAX_SAMPLE_BYTES = 50 * 1024 * 1024;

const padGrid = document.querySelector("#pad-grid");
const statusMessage = document.querySelector("#status");
const connectionStatus = document.querySelector("#connection-status");
const stopAllButton = document.querySelector("#stop-all");
const tempoInput = document.querySelector("#tempo");
const quantizeInput = document.querySelector("#quantize");
const masterVolumeInput = document.querySelector("#master-volume");
const masterVolumeValue = document.querySelector("#master-volume-value");
const padEditor = document.querySelector("#pad-editor");
const padLabelInput = document.querySelector("#pad-label");
const padKeyInput = document.querySelector("#pad-key");
const padModeInput = document.querySelector("#pad-mode");
const padVolumeInput = document.querySelector("#pad-volume");
const padVolumeValue = document.querySelector("#pad-volume-value");
const sampleFileInput = document.querySelector("#sample-file");
const sampleName = document.querySelector("#sample-name");
const clearSampleButton = document.querySelector("#clear-sample");
const selectedPadIndicator = document.querySelector("#selected-pad-indicator");
const saveLayoutButton = document.querySelector("#save-layout");
const exportLayoutButton = document.querySelector("#export-layout");
const importLayoutInput = document.querySelector("#import-layout");
const resetLayoutButton = document.querySelector("#reset-layout");
const sampleList = document.querySelector("#sample-list");
const sampleCount = document.querySelector("#sample-count");
const installAppButton = document.querySelector("#install-app");

const padColors = [
  "#ff5c77", "#ff7a59", "#ffb454", "#f1d36b",
  "#50c7a7", "#57d88d", "#65d3c0", "#81d69b",
  "#54a9dc", "#5688ff", "#6875ee", "#7a7fe0",
  "#a66cf1", "#bd80e8", "#d58de8", "#b694f4",
];

const keyboardKeys = ["Q", "W", "E", "R", "A", "S", "D", "F", "Z", "X", "C", "V", "1", "2", "3", "4"];
const activeVoices = new Map();
const pendingPads = new Set();
let pads = [];
let samples = new Map();
let selectedPadIndex = 0;
let audioContext;
let masterGain;
let databasePromise;
let deferredInstallPrompt;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function createDefaultPads() {
  return Array.from({ length: PAD_COUNT }, (_, index) => ({
    id: index + 1,
    label: `Pad ${String(index + 1).padStart(2, "0")}`,
    key: keyboardKeys[index],
    color: padColors[index],
    mode: "oneshot",
    volume: 0.8,
    sampleId: null,
  }));
}

function normalizePad(candidate, index) {
  const fallback = createDefaultPads()[index];
  const candidateKey = typeof candidate?.key === "string" ? candidate.key.trim().slice(0, 1).toUpperCase() : "";
  const candidateColor = typeof candidate?.color === "string" && /^#[\da-f]{6}$/i.test(candidate.color)
    ? candidate.color
    : fallback.color;
  const candidateVolume = Number(candidate?.volume);

  return {
    id: index + 1,
    label: typeof candidate?.label === "string" && candidate.label.trim() ? candidate.label.trim().slice(0, 32) : fallback.label,
    key: /^[A-Z0-9]$/.test(candidateKey) ? candidateKey : fallback.key,
    color: candidateColor,
    mode: candidate?.mode === "loop" ? "loop" : "oneshot",
    volume: Number.isFinite(candidateVolume) ? clamp(candidateVolume, 0, 1) : fallback.volume,
    sampleId: typeof candidate?.sampleId === "string" ? candidate.sampleId : null,
  };
}

function normalizePads(candidatePads) {
  return Array.from({ length: PAD_COUNT }, (_, index) => normalizePad(candidatePads?.[index], index));
}

function readLayout() {
  try {
    const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!savedLayout) return createDefaultPads();

    const parsedLayout = JSON.parse(savedLayout);
    return normalizePads(parsedLayout.pads);
  } catch {
    return createDefaultPads();
  }
}

function serializeLayout() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    pads: pads.map(({ id, label, key, color, mode, volume, sampleId }) => ({
      id,
      label,
      key,
      color,
      mode,
      volume,
      sampleId,
    })),
  };
}

function saveLayout(message = "Layout saved in this browser.") {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(serializeLayout()));
    setStatus(message, "success");
  } catch {
    setStatus("This browser could not save the layout.", "error");
  }
}

function setStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.dataset.type = type;
}

function updateConnectionStatus(message, type = "ready") {
  connectionStatus.textContent = message;
  connectionStatus.dataset.type = type;
}

function openDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("IndexedDB is unavailable."));
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

      request.addEventListener("upgradeneeded", () => {
        if (!request.result.objectStoreNames.contains("samples")) {
          request.result.createObjectStore("samples", { keyPath: "id" });
        }
      });
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error || new Error("Could not open sample storage.")));
    });
  }

  return databasePromise;
}

function requestFromStore(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction("samples", mode);
    const store = transaction.objectStore("samples");
    const request = operation(store);

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error || new Error("Sample storage failed.")));
  }));
}

function readSamples() {
  return requestFromStore("readonly", (store) => store.getAll());
}

function writeSample(sample) {
  return requestFromStore("readwrite", (store) => store.put(sample));
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `sample-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isAudioFile(file) {
  return file?.type?.startsWith("audio/") || /\.(wav|mp3|ogg|m4a|aac|flac)$/i.test(file?.name || "");
}

async function persistSample(file) {
  if (!file || !isAudioFile(file)) {
    throw new Error("Choose a supported audio file.");
  }

  if (file.size > MAX_SAMPLE_BYTES) {
    throw new Error("Samples must be smaller than 50 MB.");
  }

  const sample = {
    id: makeId(),
    name: file.name,
    mime: file.type || "audio/*",
    size: file.size,
    blob: file,
    createdAt: new Date().toISOString(),
  };

  try {
    await writeSample(sample);
  } catch {
    updateConnectionStatus("Memory-only mode", "muted");
  }
  samples.set(sample.id, sample);
  renderSampleLibrary();
  return sample;
}

function renderSampleLibrary() {
  const storedSamples = [...samples.values()].sort((left, right) => left.name.localeCompare(right.name));
  sampleCount.textContent = `${storedSamples.length} ${storedSamples.length === 1 ? "file" : "files"}`;
  sampleList.replaceChildren();

  if (!storedSamples.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No local samples yet.";
    sampleList.append(emptyItem);
    return;
  }

  for (const sample of storedSamples) {
    const item = document.createElement("li");
    item.className = "sample-item";
    const name = document.createElement("span");
    name.textContent = sample.name;
    const size = document.createElement("span");
    size.className = "muted";
    size.textContent = formatBytes(sample.size);
    item.append(name, size);
    sampleList.append(item);
  }
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio is not supported in this browser.");

    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = Number(masterVolumeInput.value);
    masterGain.connect(audioContext.destination);
  }

  return audioContext;
}

async function prepareAudio() {
  const context = getAudioContext();
  if (context.state === "suspended") void context.resume().catch(() => {});
  return context;
}

function getNextBeatTime(context) {
  const tempo = clamp(Number(tempoInput.value) || 120, 60, 200);
  const beatLength = 60 / tempo;
  return Math.ceil((context.currentTime + 0.025) / beatLength) * beatLength;
}

function getPadVoices(index) {
  return activeVoices.get(index) || new Set();
}

function releaseVoice(index, voice) {
  const voices = activeVoices.get(index);
  if (!voices) return;

  voices.delete(voice);
  if (!voices.size) activeVoices.delete(index);
  updatePadState(index);
}

function registerVoice(index, source, startAt) {
  const voice = { source, startAt };
  const voices = getPadVoices(index);
  voices.add(voice);
  activeVoices.set(index, voices);
  source.addEventListener("ended", () => releaseVoice(index, voice), { once: true });
  updatePadState(index);
  return voice;
}

function stopPad(index, { quantized = false, announce = false } = {}) {
  const voices = activeVoices.get(index);
  if (!voices?.size || !audioContext) return false;

  const stopAt = quantized && quantizeInput.checked ? getNextBeatTime(audioContext) : audioContext.currentTime;
  for (const voice of voices) {
    try {
      voice.source.stop(stopAt);
    } catch {
      releaseVoice(index, voice);
    }
  }

  if (announce) {
    const pad = pads[index];
    setStatus(stopAt > audioContext.currentTime + 0.02 ? `${pad.label} loop will stop on the next beat.` : `${pad.label} stopped.`);
  }
  return true;
}

function stopAll() {
  for (const [index, voices] of activeVoices) {
    for (const voice of voices) {
      try {
        voice.source.stop();
      } catch {
        releaseVoice(index, voice);
      }
    }
  }

  activeVoices.clear();
  for (let index = 0; index < PAD_COUNT; index += 1) updatePadState(index);
  setStatus("All pads stopped.");
}

async function getSampleBuffer(sample, context) {
  if (sample.buffer) return sample.buffer;
  if (!sample.bufferPromise) {
    sample.bufferPromise = sample.blob.arrayBuffer()
      .then((arrayBuffer) => context.decodeAudioData(arrayBuffer.slice(0)))
      .then((buffer) => {
        sample.buffer = buffer;
        return buffer;
      });
  }
  return sample.bufferPromise;
}

function createVoiceGain(context, pad) {
  const gain = context.createGain();
  gain.gain.value = clamp(Number(pad.volume) || 0, 0, 1);
  gain.connect(masterGain);
  return gain;
}

function playPreviewTone(index, pad, context) {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const frequency = 180 * Math.pow(2, (index % 8) / 8);

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.3 * pad.volume), now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
  oscillator.connect(gain);
  gain.connect(masterGain);
  registerVoice(index, oscillator, now);
  oscillator.start(now);
  oscillator.stop(now + 0.5);
  setStatus(`${pad.label} preview tone triggered.`);
}

async function playSample(index, pad, sample, context) {
  const buffer = await getSampleBuffer(sample, context);
  const source = context.createBufferSource();
  const gain = createVoiceGain(context, pad);
  const isLoop = pad.mode === "loop";
  const startAt = isLoop && quantizeInput.checked ? getNextBeatTime(context) : context.currentTime;

  source.buffer = buffer;
  source.loop = isLoop;
  source.connect(gain);
  registerVoice(index, source, startAt);
  source.start(startAt);

  if (isLoop && startAt > context.currentTime + 0.02) {
    setStatus(`${pad.label} loop queued for the next beat.`);
  } else {
    setStatus(`${pad.label} triggered.`);
  }
}

async function triggerPad(index) {
  if (pendingPads.has(index)) return;
  const pad = pads[index];
  const existingVoices = getPadVoices(index);

  if (pad.mode === "loop" && existingVoices.size) {
    stopPad(index, { quantized: true, announce: true });
    return;
  }

  if (pad.mode === "loop" && !pad.sampleId) {
    setStatus(`${pad.label} needs an audio sample before it can loop.`, "error");
    selectPad(index);
    return;
  }

  pendingPads.add(index);
  updatePadState(index);

  try {
    const context = await prepareAudio();
    const sample = pad.sampleId ? samples.get(pad.sampleId) : null;

    if (pad.sampleId && !sample) {
      setStatus(`${pad.label} is missing its saved sample. Choose a new file.`, "error");
      selectPad(index);
      return;
    }

    if (sample) {
      await playSample(index, pad, sample, context);
    } else {
      playPreviewTone(index, pad, context);
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The sample could not be played.", "error");
  } finally {
    pendingPads.delete(index);
    updatePadState(index);
  }
}

function updatePadState(index) {
  const button = padGrid.querySelector(`[data-index="${index}"]`);
  if (!button) return;
  button.classList.toggle("is-playing", getPadVoices(index).size > 0);
  button.classList.toggle("is-loading", pendingPads.has(index));
  button.classList.toggle("is-selected", selectedPadIndex === index);
}

function renderPads() {
  padGrid.replaceChildren();

  pads.forEach((pad, index) => {
    const button = document.createElement("button");
    button.className = "pad";
    button.type = "button";
    button.dataset.index = String(index);
    button.style.setProperty("--pad-color", pad.color);
    button.setAttribute("aria-label", `${pad.label}, keyboard shortcut ${pad.key}`);
    button.title = `${pad.label} · ${pad.key}`;

    const label = document.createElement("span");
    label.className = "pad-label";
    label.textContent = pad.label;
    const key = document.createElement("span");
    key.className = "pad-key";
    key.textContent = pad.key;
    button.append(label, key);

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.focus({ preventScroll: true });
      selectPad(index);
      void triggerPad(index);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      void triggerPad(index);
    });
    button.addEventListener("contextmenu", (event) => event.preventDefault());
    padGrid.append(button);
    updatePadState(index);
  });
}

function updateSampleName() {
  const pad = pads[selectedPadIndex];
  const selectedFile = sampleFileInput.files?.[0];

  if (selectedFile) {
    sampleName.textContent = selectedFile.name;
  } else if (pad.sampleId && samples.has(pad.sampleId)) {
    sampleName.textContent = samples.get(pad.sampleId).name;
  } else if (pad.sampleId) {
    sampleName.textContent = "Missing sample";
  } else {
    sampleName.textContent = "Preview tone";
  }
}

function selectPad(index) {
  selectedPadIndex = index;
  const pad = pads[index];
  selectedPadIndicator.textContent = pad.label;
  padLabelInput.value = pad.label;
  padKeyInput.value = pad.key;
  padModeInput.value = pad.mode;
  padVolumeInput.value = String(pad.volume);
  padVolumeValue.textContent = `${Math.round(pad.volume * 100)}%`;
  sampleFileInput.value = "";
  updateSampleName();

  for (let padIndex = 0; padIndex < PAD_COUNT; padIndex += 1) updatePadState(padIndex);
}

function updatePadVolumeLabel() {
  padVolumeValue.textContent = `${Math.round(Number(padVolumeInput.value) * 100)}%`;
}

function updateMasterVolume() {
  const volume = Number(masterVolumeInput.value);
  masterVolumeValue.textContent = `${Math.round(volume * 100)}%`;
  if (masterGain) masterGain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.01);
}

async function saveSelectedPad(event) {
  event.preventDefault();
  const nextLabel = padLabelInput.value.trim();
  const nextKey = padKeyInput.value.trim().slice(0, 1).toUpperCase();
  const duplicateKey = pads.some((pad, index) => index !== selectedPadIndex && pad.key === nextKey);

  if (!nextLabel || !/^[A-Z0-9]$/.test(nextKey)) {
    setStatus("Give the pad a name and a single letter or number shortcut.", "error");
    return;
  }
  if (duplicateKey) {
    setStatus(`${nextKey} is already assigned to another pad.`, "error");
    return;
  }

  try {
    const selectedFile = sampleFileInput.files?.[0];
    let sampleId = pads[selectedPadIndex].sampleId;
    if (selectedFile) {
      const sample = await persistSample(selectedFile);
      sampleId = sample.id;
    }

    pads[selectedPadIndex] = {
      ...pads[selectedPadIndex],
      label: nextLabel,
      key: nextKey,
      mode: padModeInput.value === "loop" ? "loop" : "oneshot",
      volume: clamp(Number(padVolumeInput.value), 0, 1),
      sampleId,
    };
    renderPads();
    selectPad(selectedPadIndex);
    saveLayout(`${pads[selectedPadIndex].label} updated and saved.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The pad could not be saved.", "error");
  }
}

function clearSelectedSample() {
  stopPad(selectedPadIndex);
  pads[selectedPadIndex].sampleId = null;
  sampleFileInput.value = "";
  updateSampleName();
  saveLayout("Preview tone restored for the selected pad.");
}

function downloadText(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportLayout() {
  downloadText("launchpad-layout.json", `${JSON.stringify(serializeLayout(), null, 2)}\n`, "application/json");
  setStatus("Layout exported. Sample files remain local to this browser.", "success");
}

async function importLayout(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const parsedLayout = JSON.parse(await file.text());
    if (!Array.isArray(parsedLayout.pads)) throw new Error("This file is not a launchpad layout.");
    stopAll();
    pads = normalizePads(parsedLayout.pads);
    renderPads();
    selectPad(0);
    saveLayout("Layout imported and saved.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The layout could not be imported.", "error");
  }
}

function resetLayout() {
  if (!window.confirm("Reset all pad names, shortcuts, and assignments? Saved audio files will remain in the library.")) return;
  stopAll();
  pads = createDefaultPads();
  renderPads();
  selectPad(0);
  saveLayout("Pads reset to the starter layout.");
}

function isEditableTarget(target) {
  return target instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

function bindEvents() {
  stopAllButton.addEventListener("click", stopAll);
  padEditor.addEventListener("submit", (event) => void saveSelectedPad(event));
  clearSampleButton.addEventListener("click", clearSelectedSample);
  sampleFileInput.addEventListener("change", updateSampleName);
  padVolumeInput.addEventListener("input", updatePadVolumeLabel);
  masterVolumeInput.addEventListener("input", updateMasterVolume);
  tempoInput.addEventListener("change", () => {
    tempoInput.value = String(clamp(Number(tempoInput.value) || 120, 60, 200));
  });
  saveLayoutButton.addEventListener("click", () => saveLayout());
  exportLayoutButton.addEventListener("click", exportLayout);
  importLayoutInput.addEventListener("change", (event) => void importLayout(event));
  resetLayoutButton.addEventListener("click", resetLayout);

  document.addEventListener("keydown", (event) => {
    if (event.repeat || isEditableTarget(event.target)) return;
    const padIndex = pads.findIndex((pad) => pad.key === event.key.toUpperCase());
    if (padIndex === -1) return;
    event.preventDefault();
    selectPad(padIndex);
    void triggerPad(padIndex);
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installAppButton.hidden = false;
  });
  installAppButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installAppButton.hidden = true;
  });
  window.addEventListener("appinstalled", () => {
    installAppButton.hidden = true;
    setStatus("Launchpad installed on this device.", "success");
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") {
    updateConnectionStatus("Browser mode", "muted");
    return;
  }

  try {
    await navigator.serviceWorker.register("./sw.js");
    updateConnectionStatus("Offline-ready", "ready");
  } catch {
    updateConnectionStatus("Browser mode", "muted");
  }
}

async function init() {
  pads = readLayout();
  bindEvents();
  renderPads();
  selectPad(0);
  updateMasterVolume();
  renderSampleLibrary();

  try {
    const storedSamples = await readSamples();
    samples = new Map(storedSamples.map((sample) => [sample.id, sample]));
    renderSampleLibrary();
    updateSampleName();
  } catch {
    updateConnectionStatus("Memory-only mode", "muted");
    setStatus("Audio works, but this browser cannot persist sample files.", "error");
  }

  await registerServiceWorker();
}

void init();
