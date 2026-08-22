const PAD_COUNT = 16;
const LAYOUT_STORAGE_KEY = "touchscreen-launchpad.layout.v1";
const DATABASE_NAME = "touchscreen-launchpad";
const DATABASE_VERSION = 1;
const MAX_SAMPLE_BYTES = 50 * 1024 * 1024;

const padGrid = document.querySelector("#pad-grid");
const statusMessage = document.querySelector("#status");
const beatIndicator = document.querySelector("#beat-indicator");
const persistenceNote = document.querySelector("#persistence-note");
const connectionStatus = document.querySelector("#connection-status");
const stopAllButton = document.querySelector("#stop-all");
const tempoInput = document.querySelector("#tempo");
const tempoValue = document.querySelector("#tempo-value");
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
const editorDirtyIndicator = document.querySelector("#editor-dirty");
const editorPanel = document.querySelector(".editor-panel");
const editorToggle = document.querySelector("#editor-toggle");
const saveLayoutButton = document.querySelector("#save-layout");
const exportLayoutButton = document.querySelector("#export-layout");
const importLayoutInput = document.querySelector("#import-layout");
const resetLayoutButton = document.querySelector("#reset-layout");
const sampleList = document.querySelector("#sample-list");
const sampleCount = document.querySelector("#sample-count");
const sampleSearchInput = document.querySelector("#sample-search");
const sampleSortInput = document.querySelector("#sample-sort");
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
let storageMode = "persistent";
let editorDirty = false;
let draftSampleCleared = false;
let playbackGeneration = 0;
let beatCountdownTimer;
const pointerPadById = new Map();
const pointerIdByPad = new Map();

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

function markMemoryOnlyMode(message) {
  storageMode = "memory";
  updateConnectionStatus("Memory-only mode", "muted");
  persistenceNote.textContent = message;
  persistenceNote.hidden = false;
}

function readLayout() {
  try {
    const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!savedLayout) return createDefaultPads();

    const parsedLayout = JSON.parse(savedLayout);
    return normalizePads(parsedLayout.pads);
  } catch {
    markMemoryOnlyMode("Layout storage is unavailable. Changes will last until this tab is reloaded.");
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
    setStatus(storageMode === "memory" ? `${message} Memory-only mode: a reload may discard changes.` : message, storageMode === "memory" ? "error" : "success");
  } catch {
    markMemoryOnlyMode("Layout storage failed. Changes remain in memory and may be lost on reload.");
    setStatus("This browser could not save the layout.", "error");
  }
}

function setStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.dataset.type = type;
}

function updateConnectionStatus(message, type = "ready") {
  if (storageMode === "memory" && type === "ready") return;
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
    markMemoryOnlyMode("Sample storage failed. This sample is available for this session only.");
  }
  samples.set(sample.id, sample);
  renderSampleLibrary();
  return sample;
}

function renderSampleLibrary() {
  const query = sampleSearchInput.value.trim().toLocaleLowerCase();
  const allSamples = [...samples.values()];
  const storedSamples = allSamples
    .filter((sample) => !query || sample.name.toLocaleLowerCase().includes(query))
    .sort((left, right) => {
      if (sampleSortInput.value === "newest") return right.createdAt.localeCompare(left.createdAt);
      if (sampleSortInput.value === "largest") return right.size - left.size;
      return left.name.localeCompare(right.name);
    });
  sampleCount.textContent = query
    ? `${storedSamples.length}/${allSamples.length} matches`
    : `${storedSamples.length} ${storedSamples.length === 1 ? "file" : "files"}`;
  sampleList.replaceChildren();

  if (!storedSamples.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = query ? "No samples match this search." : "No local samples yet.";
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

function clearBeatCountdown() {
  if (beatCountdownTimer) window.clearInterval(beatCountdownTimer);
  beatCountdownTimer = undefined;
  beatIndicator.hidden = true;
  beatIndicator.textContent = "";
}

function showBeatCountdown(time, message) {
  clearBeatCountdown();
  if (!quantizeInput.checked || !audioContext) return;

  const update = () => {
    const remaining = time - audioContext.currentTime;
    if (remaining <= 0) {
      clearBeatCountdown();
      return;
    }
    beatIndicator.textContent = `${message} in ${remaining.toFixed(2)}s`;
    beatIndicator.hidden = false;
  };

  update();
  beatCountdownTimer = window.setInterval(update, 50);
}

function releaseVoice(index, voice) {
  const voices = activeVoices.get(index);
  if (!voices) return;

  if (voice.startTimer) window.clearTimeout(voice.startTimer);
  voices.delete(voice);
  if (!voices.size) activeVoices.delete(index);
  updatePadState(index);
}

function registerVoice(index, source, startAt, { isLoop = false } = {}) {
  const startContextTime = audioContext?.currentTime || 0;
  const voice = {
    source,
    startAt,
    isLoop,
    started: startAt <= startContextTime + 0.02,
    startTimer: undefined,
  };
  const voices = getPadVoices(index);
  voices.add(voice);
  activeVoices.set(index, voices);
  source.addEventListener("ended", () => releaseVoice(index, voice), { once: true });
  if (!voice.started) {
    voice.startTimer = window.setTimeout(() => {
      voice.started = true;
      voice.startTimer = undefined;
      updatePadState(index);
    }, Math.max(0, (startAt - startContextTime) * 1000));
  }
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
    if (stopAt > audioContext.currentTime + 0.02) {
      setStatus(`${pad.label} loop will stop on the next beat.`);
      showBeatCountdown(stopAt, `${pad.label} stops`);
    } else {
      clearBeatCountdown();
      setStatus(`${pad.label} stopped.`);
    }
  }
  return true;
}

function stopAll() {
  playbackGeneration += 1;
  clearBeatCountdown();
  for (const [index, voices] of activeVoices) {
    for (const voice of voices) {
      if (voice.startTimer) window.clearTimeout(voice.startTimer);
      try {
        voice.source.stop();
      } catch {
        releaseVoice(index, voice);
      }
    }
  }

  activeVoices.clear();
  pendingPads.clear();
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

async function playSample(index, pad, sample, context, generation) {
  const buffer = await getSampleBuffer(sample, context);
  if (generation !== playbackGeneration) return false;
  const source = context.createBufferSource();
  const gain = createVoiceGain(context, pad);
  const isLoop = pad.mode === "loop";
  const startAt = isLoop && quantizeInput.checked ? getNextBeatTime(context) : context.currentTime;

  source.buffer = buffer;
  source.loop = isLoop;
  source.connect(gain);
  registerVoice(index, source, startAt, { isLoop });
  source.start(startAt);

  if (isLoop && startAt > context.currentTime + 0.02) {
    setStatus(`${pad.label} loop queued for the next beat.`);
    showBeatCountdown(startAt, `${pad.label} starts`);
  } else {
    setStatus(`${pad.label} triggered.`);
  }
  return true;
}

async function triggerPad(index) {
  if (pendingPads.has(index)) return;
  const pad = pads[index];
  const existingVoices = [...getPadVoices(index)].filter((voice) => voice.isLoop);

  if (pad.mode === "loop" && existingVoices.length) {
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
  const generation = playbackGeneration;

  try {
    const context = await prepareAudio();
    if (generation !== playbackGeneration) return;
    const sample = pad.sampleId ? samples.get(pad.sampleId) : null;

    if (pad.sampleId && !sample) {
      setStatus(`${pad.label} is missing its saved sample. Choose a new file.`, "error");
      selectPad(index);
      return;
    }

    if (sample) {
      await playSample(index, pad, sample, context, generation);
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
  const voices = getPadVoices(index);
  const isPlaying = [...voices].some((voice) => voice.started);
  const isQueued = !isPlaying && voices.size > 0;
  button.classList.toggle("is-playing", isPlaying);
  button.classList.toggle("is-queued", isQueued);
  button.classList.toggle("is-loading", pendingPads.has(index));
  button.classList.toggle("is-selected", selectedPadIndex === index);
  button.setAttribute("aria-pressed", String(isPlaying || isQueued));
  button.dataset.state = isPlaying ? "playing" : isQueued ? "queued" : "ready";
}

function releasePadPointer(button, event) {
  const index = Number(button.dataset.index);
  if (pointerPadById.get(event.pointerId) !== index) return;
  pointerPadById.delete(event.pointerId);
  if (pointerIdByPad.get(index) === event.pointerId) pointerIdByPad.delete(index);
  button.classList.remove("is-pressed");
}

function renderPads() {
  padGrid.replaceChildren();
  pointerPadById.clear();
  pointerIdByPad.clear();

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
    const selection = document.createElement("span");
    selection.className = "pad-selection";
    selection.textContent = "Selected";
    selection.setAttribute("aria-hidden", "true");
    button.append(label, key, selection);

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (pointerIdByPad.has(index)) return;
      pointerIdByPad.set(index, event.pointerId);
      pointerPadById.set(event.pointerId, index);
      button.classList.add("is-pressed");
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is not available in a few embedded browser contexts.
      }
      button.focus({ preventScroll: true });
      selectPad(index);
      void triggerPad(index);
    });
    button.addEventListener("pointerup", (event) => releasePadPointer(button, event));
    button.addEventListener("pointercancel", (event) => releasePadPointer(button, event));
    button.addEventListener("lostpointercapture", (event) => releasePadPointer(button, event));
    button.addEventListener("keydown", (event) => {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      selectPad(index);
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
  } else if (draftSampleCleared) {
    sampleName.textContent = "Preview tone (not saved)";
  } else if (pad.sampleId && samples.has(pad.sampleId)) {
    sampleName.textContent = samples.get(pad.sampleId).name;
  } else if (pad.sampleId) {
    sampleName.textContent = "Missing sample";
  } else {
    sampleName.textContent = "Preview tone";
  }
}

function setEditorDirty(value) {
  editorDirty = value;
  editorDirtyIndicator.hidden = !value;
  padEditor.classList.toggle("is-dirty", value);
}

function markEditorDirty() {
  if (!editorDirty) setEditorDirty(true);
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
  draftSampleCleared = false;
  setEditorDirty(false);
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

function updateTempoValue() {
  const tempo = clamp(Number(tempoInput.value) || 120, 60, 200);
  tempoValue.textContent = `${tempo} BPM`;
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
    let sampleId = draftSampleCleared ? null : pads[selectedPadIndex].sampleId;
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
  draftSampleCleared = true;
  sampleFileInput.value = "";
  updateSampleName();
  markEditorDirty();
  setStatus("Preview tone selected. Save the pad to apply it.");
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
  try {
    downloadText("launchpad-layout.json", `${JSON.stringify(serializeLayout(), null, 2)}\n`, "application/json");
    setStatus("Layout exported. Sample files remain local to this browser.", "success");
  } catch {
    setStatus("Layout export failed. Check browser download permissions and try again.", "error");
  }
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
  if (!window.confirm("Reset all pad names, shortcuts, and assignments? Saved audio files will remain in this browser; samples are never uploaded.")) return;
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
  padEditor.addEventListener("input", markEditorDirty);
  padEditor.addEventListener("change", markEditorDirty);
  sampleFileInput.addEventListener("change", () => {
    draftSampleCleared = false;
    updateSampleName();
    markEditorDirty();
  });
  padVolumeInput.addEventListener("input", updatePadVolumeLabel);
  masterVolumeInput.addEventListener("input", updateMasterVolume);
  tempoInput.addEventListener("input", updateTempoValue);
  tempoInput.addEventListener("change", () => {
    tempoInput.value = String(clamp(Number(tempoInput.value) || 120, 60, 200));
    updateTempoValue();
  });
  quantizeInput.addEventListener("change", () => {
    if (!quantizeInput.checked) clearBeatCountdown();
  });
  saveLayoutButton.addEventListener("click", () => saveLayout());
  exportLayoutButton.addEventListener("click", exportLayout);
  importLayoutInput.addEventListener("change", (event) => void importLayout(event));
  resetLayoutButton.addEventListener("click", resetLayout);
  sampleSearchInput.addEventListener("input", renderSampleLibrary);
  sampleSortInput.addEventListener("change", renderSampleLibrary);
  editorToggle.addEventListener("click", () => {
    const isCollapsed = editorPanel.classList.toggle("is-collapsed");
    editorToggle.setAttribute("aria-expanded", String(!isCollapsed));
    editorToggle.textContent = isCollapsed ? "Expand editor" : "Collapse editor";
  });

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
  updateTempoValue();
  renderSampleLibrary();

  try {
    const storedSamples = await readSamples();
    samples = new Map(storedSamples.map((sample) => [sample.id, sample]));
    renderSampleLibrary();
    updateSampleName();
  } catch {
    markMemoryOnlyMode("Sample storage is unavailable. Audio works, but sample files will not survive a reload.");
    setStatus("Audio works, but this browser cannot persist sample files.", "error");
  }

  await registerServiceWorker();
}

void init();
