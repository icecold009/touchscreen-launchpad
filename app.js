const PAD_COUNT = 16;
const KIT_COUNT = 5;
import { createHistory } from "./src/history.js?version=44";
import { createInputAdapter } from "./src/input-adapter.js?version=44";
import { createDefaultPad, normalizeKitRecord, normalizePadDefinition, normalizeSampleRecord } from "./src/migrations.js?version=44";
import { createPointerState } from "./src/pointer-state.js?version=44";
import { attachStorageRequest } from "./src/storage-request.js?version=44";
import { downloadBlob as triggerBlobDownload, downloadText as triggerTextDownload } from "./src/download.js?version=44";
import { getNextQuantizedTime } from "./src/transport.js?version=44";
import { createRecordingSession, createTakeRecord, formatRecordingTime, isValidTakeRecord, normalizeTakeRecord } from "./src/recording.js?version=44";
import { createPlaybackPlan, createReversedBuffer, drawWaveform, normalizeSampleRegion } from "./src/sample-editor.js?version=44";
import { getCountInBeatCount, getGroupPeers, getRepeatIntervalMs, normalizePerformanceSettings, shouldReleaseOnPointer } from "./src/performance-engine.js?version=44";
import { createPattern, getStepEvents, normalizePattern, toggleStep, updateStep } from "./src/sequencer.js?version=44";
import { createClockedSequencerRunner } from "./src/clocked-sequencer.js?version=44";
import { createMidiClockMessage, createMidiClockTracker, createMidiControllerMessage, createMidiLearnState, createMidiNoteMessage, getMidiControllerValue, getMidiMappingConflicts, getPadIndexForMidiNote, normalizeMidiConfig, normalizeMidiControllerMapping, normalizeMidiMapping, parseMidiMessage } from "./src/midi.js?version=44";
import { createMidiFile } from "./src/midi-file.js?version=44";
import { createImpulseResponse, detectPeak, normalizeEffectSends, normalizeMasterEffects } from "./src/effects.js?version=44";
import { createVoiceRegistry } from "./src/voice-registry.js?version=44";
import { describeAudioState, hasLiveMediaTracks, normalizeAudioContextState } from "./src/audio-lifecycle.js?version=44";
import { MAX_SLICE_COUNT, createEvenSlices, normalizeSliceDefinitions, updateSliceDefinition } from "./src/slices.js?version=44";
import { encodePcmWav } from "./src/wav.js?version=44";

const LAYOUT_STORAGE_KEY = "touchscreen-launchpad.layout.v1";
const CURRENT_KIT_STORAGE_KEY = "touchscreen-launchpad.current-kit.v1";
const KITS_MIRROR_STORAGE_KEY = "touchscreen-launchpad.kits-mirror.v1";
const DATABASE_NAME = "touchscreen-launchpad";
const DATABASE_VERSION = 3;
const MAX_LAYOUT_BYTES = 256 * 1024;
const MAX_SAMPLE_BYTES = 50 * 1024 * 1024;
const MAX_SAMPLE_COUNT = 128;
const MAX_SAMPLE_STORAGE_BYTES = 512 * 1024 * 1024;
const MAX_LAUNCHPACK_BYTES = 700 * 1024 * 1024;
const MAX_SAMPLE_ID_LENGTH = 128;
const MAX_KIT_NAME_LENGTH = 40;
const MAX_PACK_PATH_LENGTH = 240;
const MAX_DECODED_AUDIO_BYTES = 256 * 1024 * 1024;
const MAX_DECODED_AUDIO_SECONDS = 15 * 60;
const MAX_TAKE_COUNT = 32;
const MAX_TAKE_STORAGE_BYTES = 256 * 1024 * 1024;

const padGrid = document.querySelector("#pad-grid");
const statusMessage = document.querySelector("#status");
const beatIndicator = document.querySelector("#beat-indicator");
const recordButton = document.querySelector("#record-performance");
const recordPauseButton = document.querySelector("#pause-recording");
const recordingTimer = document.querySelector("#recording-timer");
const recordingState = document.querySelector("#recording-state");
const takeList = document.querySelector("#take-list");
const takeCount = document.querySelector("#take-count");
const sequencerPanel = document.querySelector("#sequencer-panel");
const sequencerGrid = document.querySelector("#sequencer-grid");
const sequencerStatus = document.querySelector("#sequencer-status");
const sequencerPlayButton = document.querySelector("#sequencer-play");
const exportMidiButton = document.querySelector("#export-midi");
const duplicateSceneButton = document.querySelector("#sequencer-duplicate");
const undoSceneButton = document.querySelector("#sequencer-undo");
const redoSceneButton = document.querySelector("#sequencer-redo");
const sequencerStepTrackInput = document.querySelector("#sequencer-step-track");
const sequencerStepIndexInput = document.querySelector("#sequencer-step-index");
const sequencerStepProbabilityInput = document.querySelector("#sequencer-step-probability");
const sequencerStepProbabilityValue = document.querySelector("#sequencer-step-probability-value");
const sequencerStepMicroInput = document.querySelector("#sequencer-step-micro");
const sequencerStepMicroValue = document.querySelector("#sequencer-step-micro-value");
const sequencerStepStatus = document.querySelector("#sequencer-step-status");
const sceneAButton = document.querySelector("#scene-a");
const sceneBButton = document.querySelector("#scene-b");
const sequencerSwingInput = document.querySelector("#sequencer-swing");
const sequencerSwingValue = document.querySelector("#sequencer-swing-value");
const midiConnectButton = document.querySelector("#midi-connect");
const midiLearnButton = document.querySelector("#midi-learn");
const midiStatus = document.querySelector("#midi-status");
const midiInputSelect = document.querySelector("#midi-input");
const midiOutputSelect = document.querySelector("#midi-output");
const midiProfileNameInput = document.querySelector("#midi-profile-name");
const midiClockInInput = document.querySelector("#midi-clock-in");
const midiClockOutInput = document.querySelector("#midi-clock-out");
const midiMappingTargetSelect = document.querySelector("#midi-mapping-target");
const midiLearnControllerButton = document.querySelector("#midi-learn-controller");
const midiCancelLearnButton = document.querySelector("#midi-cancel-learn");
const midiClearMappingsButton = document.querySelector("#midi-clear-mappings");
const midiMappingStatus = document.querySelector("#midi-mapping-status");
const midiMappingsList = document.querySelector("#midi-mappings");
const delayTimeInput = document.querySelector("#delay-time");
const delayFeedbackInput = document.querySelector("#delay-feedback");
const reverbDecayInput = document.querySelector("#reverb-decay");
const masterEqLowInput = document.querySelector("#master-eq-low");
const masterEqMidInput = document.querySelector("#master-eq-mid");
const masterEqHighInput = document.querySelector("#master-eq-high");
const compressorThresholdInput = document.querySelector("#compressor-threshold");
const compressorRatioInput = document.querySelector("#compressor-ratio");
const limiterThresholdInput = document.querySelector("#limiter-threshold");
const macroWarmthInput = document.querySelector("#macro-warmth");
const macroSpaceInput = document.querySelector("#macro-space");
const macroPunchInput = document.querySelector("#macro-punch");
const masterSnapshotSelect = document.querySelector("#master-snapshot");
const saveMasterSnapshotButton = document.querySelector("#save-master-snapshot");
const recallMasterSnapshotButton = document.querySelector("#recall-master-snapshot");
const masterLevelStatus = document.querySelector("#master-level-status");
const masterLevelCheckButton = document.querySelector("#master-level-check");
const audioDiagnosticsButton = document.querySelector("#audio-diagnostics");
const audioDiagnostics = document.querySelector("#audio-diagnostics-status");
const sampleWaveform = document.querySelector("#sample-waveform");
const sampleEditStatus = document.querySelector("#sample-edit-status");
const sampleStartInput = document.querySelector("#sample-start");
const sampleEndInput = document.querySelector("#sample-end");
const sampleLoopStartInput = document.querySelector("#sample-loop-start");
const sampleLoopEndInput = document.querySelector("#sample-loop-end");
const sampleReverseInput = document.querySelector("#sample-reverse");
const sliceCountInput = document.querySelector("#slice-count");
const createSlicesButton = document.querySelector("#create-slices");
const clearSlicesButton = document.querySelector("#clear-slices");
const sliceCountValue = document.querySelector("#slice-count-value");
const sliceList = document.querySelector("#slice-list");
const pitchInput = document.querySelector("#pad-pitch");
const pitchValue = document.querySelector("#pad-pitch-value");
const stretchInput = document.querySelector("#pad-stretch");
const stretchValue = document.querySelector("#pad-stretch-value");
const panInput = document.querySelector("#pad-pan");
const panValue = document.querySelector("#pad-pan-value");
const filterTypeInput = document.querySelector("#pad-filter-type");
const filterFrequencyInput = document.querySelector("#pad-filter-frequency");
const filterFrequencyValue = document.querySelector("#pad-filter-frequency-value");
const attackInput = document.querySelector("#pad-attack");
const attackValue = document.querySelector("#pad-attack-value");
const releaseInput = document.querySelector("#pad-release");
const releaseValue = document.querySelector("#pad-release-value");
const padDelaySendInput = document.querySelector("#pad-delay-send");
const padReverbSendInput = document.querySelector("#pad-reverb-send");
const padDelaySendValue = document.querySelector("#pad-delay-send-value");
const padReverbSendValue = document.querySelector("#pad-reverb-send-value");
const persistenceNote = document.querySelector("#persistence-note");
const connectionStatus = document.querySelector("#connection-status");
const stopAllButton = document.querySelector("#stop-all");
const tempoInput = document.querySelector("#tempo");
const tempoValue = document.querySelector("#tempo-value");
const quantizeInput = document.querySelector("#quantize");
const metronomeInput = document.querySelector("#metronome");
const countInInput = document.querySelector("#count-in");
const performanceModeButton = document.querySelector("#performance-mode");
const masterVolumeInput = document.querySelector("#master-volume");
const masterVolumeValue = document.querySelector("#master-volume-value");
const loopToggleButton = document.querySelector("#loop-toggle");
const padEditor = document.querySelector("#pad-editor");
const padLabelInput = document.querySelector("#pad-label");
const padKeyInput = document.querySelector("#pad-key");
const padModeInput = document.querySelector("#pad-mode");
const triggerModeInput = document.querySelector("#trigger-mode");
const launchQuantizeInput = document.querySelector("#launch-quantize");
const stopQuantizeInput = document.querySelector("#stop-quantize");
const chokeGroupInput = document.querySelector("#choke-group");
const muteGroupInput = document.querySelector("#mute-group");
const linkGroupInput = document.querySelector("#link-group");
const padVolumeInput = document.querySelector("#pad-volume");
const padVolumeValue = document.querySelector("#pad-volume-value");
const sampleFileInput = document.querySelector("#sample-file");
const sampleName = document.querySelector("#sample-name");
const clearSampleButton = document.querySelector("#clear-sample");
const selectedPadIndicator = document.querySelector("#selected-pad-indicator");
const editorDirtyIndicator = document.querySelector("#editor-dirty");
const undoPadButton = document.querySelector("#undo-pad");
const redoPadButton = document.querySelector("#redo-pad");
const editorPanel = document.querySelector(".editor-panel");
const editorToggle = document.querySelector("#editor-toggle");
const editorNavLinks = [...document.querySelectorAll(".editor-nav-link")];
const saveLayoutButton = document.querySelector("#save-layout");
const exportLayoutButton = document.querySelector("#export-layout");
const importLayoutInput = document.querySelector("#import-layout");
const resetLayoutButton = document.querySelector("#reset-layout");
const sampleList = document.querySelector("#sample-list");
const sampleCount = document.querySelector("#sample-count");
const sampleSearchInput = document.querySelector("#sample-search");
const sampleSortInput = document.querySelector("#sample-sort");
const kitSelect = document.querySelector("#kit-select");
const kitNameInput = document.querySelector("#kit-name");
const kitCount = document.querySelector("#kit-count");
const renameKitButton = document.querySelector("#rename-kit");
const duplicateKitButton = document.querySelector("#duplicate-kit");
const deleteKitButton = document.querySelector("#delete-kit");
const exportPackButton = document.querySelector("#export-pack");
const importPackInput = document.querySelector("#import-pack");
const importLaunchpackInput = document.querySelector("#import-launchpack");
const installAppButton = document.querySelector("#install-app");
const persistenceMessage = document.querySelector("#persistence-message");
const repairStorageButton = document.querySelector("#repair-storage");
const resetStorageButton = document.querySelector("#reset-storage");

const padColors = [
  "#f7b7bd", "#f8c6aa", "#f4e6a8", "#b7e3d0",
  "#f8dcaa", "#c6e6c8", "#bce4e3", "#c5c6ed",
  "#bde9c5", "#b9dced", "#d4c9ed", "#e0c8ec",
  "#c1cef2", "#d6cbed", "#e4d0ea", "#e7c8df",
];

const keyboardKeys = ["Q", "W", "E", "R", "A", "S", "D", "F", "Z", "X", "C", "V", "1", "2", "3", "4"];
const voiceRegistry = createVoiceRegistry({ maxVoices: 32, maxVoicesPerPad: 4 });
const activeVoices = voiceRegistry.byPad;
const pendingPads = new Set();
let pads = [];
let samples = new Map();
let takes = new Map();
let kits = new Map();
let currentKitId = "kit-1";
let selectedPadIndex = 0;
let audioContext;
let masterGain;
let delayNode;
let delayFeedbackGain;
let delayReturnGain;
let reverbNode;
let reverbReturnGain;
let masterEqLow;
let masterEqMid;
let masterEqHigh;
let masterCompressor;
let masterLimiter;
let masterAnalyser;
let recordingDestination;
let recordingMicStream;
let recordingMicSource;
let recordingMicGain;
let recordingTicker;
const takePreviewUrls = new Map();
const takeWaveformTokens = new Map();
let lastTakeId;
let waveformRenderToken = 0;
let masterEffects = normalizeMasterEffects();
let metronomeTimer;
let countInPromise;
let repeatTimers = new Map();
const sequencerTimers = new Set();
let activeSceneId = "scene-a";
let selectedSequencerStep = { trackIndex: 0, stepIndex: 0 };
let midiAccess;
let midiInputs = new Map();
let midiOutputs = new Map();
let activeMidiInput;
let activeMidiOutput;
let midiClockTimer;
let midiConfig = normalizeMidiConfig();
const midiLearnState = createMidiLearnState({
  onLearned: ({ note, channel }) => void saveMidiMapping({ note, channel }),
});
const midiControllerLearnState = createMidiLearnState({
  onLearned: (message) => void saveMidiControllerMapping(message),
});
const midiClockTracker = createMidiClockTracker({
  onTempo: (tempo) => {
    if (!midiConfig.clockIn) return;
    tempoInput.value = String(Math.round(tempo * 10) / 10);
    updateTempoValue();
    midiStatus.textContent = `MIDI clock in · ${Math.round(tempo)} BPM`;
  },
});
const sequencerRunner = createClockedSequencerRunner({
  clock: () => audioContext?.currentTime || 0,
  getBpm: () => Number(tempoInput.value) || 120,
  getSwing: () => Number(sequencerSwingInput.value) || 0,
  onStep: ({ stepIndex, swingOffset, stepDuration, at }) => {
    const pattern = getActiveSequencerPattern();
    sequencerStatus.textContent = `${activeSceneId === "scene-a" ? "Scene A" : "Scene B"} · Step ${stepIndex + 1}/16`;
    for (const event of getStepEvents(pattern, stepIndex)) {
      const targetTime = at + swingOffset + event.microTiming * stepDuration;
      const delay = Math.max(0, (targetTime - (audioContext?.currentTime || targetTime)) * 1000);
      const generation = playbackGeneration;
      const timer = window.setTimeout(() => {
        sequencerTimers.delete(timer);
        if (sequencerRunner.running && generation === playbackGeneration) {
          void triggerPad(event.padIndex, { linked: true, bypassCountIn: true, fromRepeat: true });
        }
      }, delay);
      sequencerTimers.add(timer);
    }
    renderSequencer();
  },
});
let databasePromise;
let sampleDatabase;
let deferredInstallPrompt;
let storageMode = "persistent";
let storageState = "saved";
let pendingSampleBytes = 0;
let pendingSampleCount = 0;
let editorDirty = false;
let kitDirty = false;
let draftSampleCleared = false;
let draftSampleId = null;
let draftSliceId = null;
let playbackGeneration = 0;
let beatCountdownTimer;
let lastPlaybackStatusAt = 0;
const recordingSession = createRecordingSession({
  onStateChange: updateRecordingState,
});
const pointerState = createPointerState();
const layoutHistory = createHistory({
  limit: 20,
  clone: (value) => value.map((pad) => ({ ...pad })),
});
const sequencerHistories = new Map([
  ["scene-a", createHistory({ limit: 32 })],
  ["scene-b", createHistory({ limit: 32 })],
]);
const inputAdapter = createInputAdapter({
  padCount: PAD_COUNT,
  onInput: ({ action, padIndex, velocity }) => {
    if (action === "release") {
      if (shouldReleaseOnPointer(pads[padIndex]?.triggerMode)) stopPad(padIndex, { quantized: true, announce: false });
      sendMidiForPad(padIndex, "noteoff");
      return;
    }
    if (action !== "trigger") return;
    selectPad(padIndex);
    void triggerPad(padIndex, { velocity });
  },
});

function clearPointerState() {
  for (const { pointerId, index } of pointerState.activeEntries()) {
    const button = padGrid.querySelector(`[data-index="${index}"]`);
    if (!button?.hasPointerCapture?.(pointerId)) continue;
    try {
      button.releasePointerCapture(pointerId);
    } catch {
      // Pointer capture can disappear while the page is being torn down.
    }
  }
  pointerState.clear();
  for (const button of padGrid.querySelectorAll(".is-pressed")) {
    button.classList.remove("is-pressed");
  }
}

function handleVisibilityChange() {
  if (document.hidden || document.visibilityState === "hidden") {
    clearPointerState();
    stopAll({ announce: false });
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function createDefaultPads() {
  return Array.from({ length: PAD_COUNT }, (_, index) => createDefaultPad(index, {
    padColors,
    keyboardKeys,
  }));
}

function defaultPadName(index) {
  return `Pad ${String(index + 1).padStart(2, "0")}`;
}

function getPadName(pad, index = Math.max(0, Number(pad?.id) - 1)) {
  return pad?.label?.trim() || `#${String(index + 1).padStart(2, "0")}`;
}

function getVisiblePadLabel(pad, index) {
  const label = typeof pad?.label === "string" ? pad.label.trim() : "";
  return label && label !== defaultPadName(index) ? label : "";
}

function normalizePad(candidate, index) {
  return normalizePadDefinition(candidate, index, { padColors, keyboardKeys });
}

function normalizePads(candidatePads) {
  return Array.from({ length: PAD_COUNT }, (_, index) => normalizePad(candidatePads?.[index], index));
}

function clonePads(sourcePads = pads) {
  return sourcePads.map((pad) => ({ ...pad }));
}

function kitSlotNumber(kitId) {
  const match = /^kit-([1-5])$/.exec(kitId || "");
  return match ? Number(match[1]) : 0;
}

function defaultKitName(slot) {
  return `Kit ${slot}`;
}

function createKitRecord(slot, kitPads = createDefaultPads(), { name, empty = false, createdAt } = {}) {
  const timestamp = createdAt || new Date().toISOString();
  return {
    id: `kit-${slot}`,
    name: typeof name === "string" && name.trim() ? name.trim().slice(0, MAX_KIT_NAME_LENGTH) : defaultKitName(slot),
    pads: normalizePads(kitPads),
    empty: Boolean(empty),
    createdAt: timestamp,
    updatedAt: timestamp,
    schemaVersion: 2,
    transport: undefined,
    patterns: [],
    scenes: [],
    masterEffects: normalizeMasterEffects(),
    masterSnapshots: [],
    midiConfig: normalizeMidiConfig(),
  };
}

function normalizeKit(candidate, slot) {
  const normalized = normalizeKitRecord(candidate, slot, normalizePads);
  return {
    ...normalized,
    masterEffects: normalizeMasterEffects(candidate?.masterEffects),
    masterSnapshots: Array.isArray(candidate?.masterSnapshots)
      ? candidate.masterSnapshots.slice(0, 4).map((snapshot, index) => ({
        id: typeof snapshot?.id === "string" ? snapshot.id.slice(0, 80) : `snapshot-${index + 1}`,
        name: typeof snapshot?.name === "string" && snapshot.name.trim() ? snapshot.name.trim().slice(0, 40) : `Snapshot ${index + 1}`,
        effects: normalizeMasterEffects(snapshot?.effects),
      }))
      : [],
    midiConfig: normalizeMidiConfig(candidate?.midiConfig),
  };
}

function isValidStoredKit(kit) {
  const slot = kitSlotNumber(kit?.id);
  return Boolean(
    slot
      && typeof kit?.name === "string"
      && kit.name.trim()
      && kit.name.length <= MAX_KIT_NAME_LENGTH
      && Array.isArray(kit.pads)
      && kit.pads.length === PAD_COUNT
      && typeof kit.createdAt === "string"
      && typeof kit.updatedAt === "string",
  );
}

function createDefaultKitMap(legacyPads = createDefaultPads()) {
  return new Map(Array.from({ length: KIT_COUNT }, (_, index) => {
    const slot = index + 1;
    return [`kit-${slot}`, createKitRecord(
      slot,
      slot === 1 ? legacyPads : createDefaultPads(),
      { name: slot === 1 ? "Kit 1 — Starter" : defaultKitName(slot), empty: slot !== 1 },
    )];
  }));
}

function setKitDirty(value) {
  kitDirty = Boolean(value);
  if (kitDirty && !editorDirty) editorDirtyIndicator.textContent = "Unsaved kit changes";
  if (!kitDirty && !editorDirty) editorDirtyIndicator.textContent = "Unsaved changes";
  editorDirtyIndicator.hidden = !(editorDirty || kitDirty);
}

function readCurrentKitId() {
  try {
    const storedId = localStorage.getItem(CURRENT_KIT_STORAGE_KEY);
    return kitSlotNumber(storedId) ? storedId : "kit-1";
  } catch {
    return "kit-1";
  }
}

function writeCurrentKitId() {
  try {
    localStorage.setItem(CURRENT_KIT_STORAGE_KEY, currentKitId);
  } catch {
    // The active kit remains usable in memory if the compatibility mirror is unavailable.
  }
}

function readKitMirror() {
  try {
    const value = localStorage.getItem(KITS_MIRROR_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeKitMirror() {
  try {
    localStorage.setItem(KITS_MIRROR_STORAGE_KEY, JSON.stringify(getKitRecords()));
  } catch {
    // IndexedDB remains the canonical store when the small metadata mirror is unavailable.
  }
}

function isQuotaError(error) {
  return error?.name === "QuotaExceededError" || error?.code === 22;
}

function getStorageStateLabel(state) {
  return {
    saved: "Saved locally",
    saving: "Saving…",
    quota: "Storage full",
    upgrade: "Updating storage…",
    corrupt: "Repair needed",
    unavailable: "Storage unavailable",
    "memory-only": "Memory-only mode",
  }[state] || "Storage status unknown";
}

function setStorageState(state, message = "") {
  storageState = state;
  updateConnectionStatus(getStorageStateLabel(state), state === "saved" ? "ready" : "muted");
  persistenceMessage.textContent = message;
  persistenceNote.hidden = !message;
  const showRecoveryActions = ["quota", "corrupt", "unavailable"].includes(state);
  repairStorageButton.hidden = !showRecoveryActions;
  resetStorageButton.hidden = !showRecoveryActions;
}

function markMemoryOnlyMode(message, state = "memory-only") {
  storageMode = "memory";
  setStorageState(state, message);
}

function readLayout() {
  try {
    const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!savedLayout) return createDefaultPads();

    const parsedLayout = JSON.parse(savedLayout);
    return normalizePads(parsedLayout.pads);
  } catch {
    markMemoryOnlyMode("Layout storage is unavailable. Changes will last until this tab is reloaded.", "unavailable");
    return createDefaultPads();
  }
}

function serializeLayout() {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    pads: pads.map((pad) => ({ ...pad })),
  };
}

function saveLayout(message = "Layout saved in this browser.") {
  if (storageMode === "persistent") setStorageState("saving", "Saving layout…");
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(serializeLayout()));
    if (storageMode === "persistent") setStorageState("saved");
    setStatus(storageMode === "memory" ? `${message} Memory-only mode: a reload may discard changes.` : message, storageMode === "memory" ? "error" : "success");
    return true;
  } catch (error) {
    markMemoryOnlyMode(
      isQuotaError(error)
        ? "Layout storage is full. Export the layout, then remove browser data or continue in memory-only mode."
        : "Layout storage failed. Changes remain in memory and may be lost on reload.",
      isQuotaError(error) ? "quota" : "unavailable",
    );
    setStatus("This browser could not save the layout.", "error");
    return false;
  }
}

function setStatus(message, type = "info") {
  statusMessage.textContent = message;
  statusMessage.dataset.type = type;
}

function setPlaybackStatus(message, type = "info", { force = false } = {}) {
  const now = performance.now();
  if (!force && type === "info" && now - lastPlaybackStatusAt < 250) return;
  lastPlaybackStatusAt = now;
  setStatus(message, type);
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
        if (storageMode === "persistent") setStorageState("upgrade", "Updating local storage…");
        if (!request.result.objectStoreNames.contains("samples")) {
          request.result.createObjectStore("samples", { keyPath: "id" });
        }
        if (!request.result.objectStoreNames.contains("kits")) {
          request.result.createObjectStore("kits", { keyPath: "id" });
        }
        if (!request.result.objectStoreNames.contains("takes")) {
          request.result.createObjectStore("takes", { keyPath: "id" });
        }
        if (!request.result.objectStoreNames.contains("history")) {
          request.result.createObjectStore("history", { keyPath: "id" });
        }
      });
      request.addEventListener("success", () => {
        sampleDatabase = request.result;
        sampleDatabase.addEventListener("versionchange", () => sampleDatabase.close());
        if (storageMode === "persistent") setStorageState("saved");
        resolve(sampleDatabase);
      });
      request.addEventListener("error", () => {
        markMemoryOnlyMode("Sample storage is unavailable. Audio works, but sample files will not survive a reload.", "unavailable");
        reject(request.error || new Error("Could not open sample storage."));
      });
    });
  }

  return databasePromise;
}

function requestFromStore(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction("samples", mode);
    const store = transaction.objectStore("samples");
    const request = operation(store);
    attachStorageRequest(request, transaction, resolve, reject);
  }));
}

function readSamples() {
  return requestFromStore("readonly", (store) => store.getAll());
}

function writeSample(sample) {
  return runStorageTransaction("readwrite", ["samples"], (transaction) => {
    transaction.objectStore("samples").put(sample);
  });
}

function deleteSample(sampleId) {
  return runStorageTransaction("readwrite", ["samples"], (transaction) => {
    transaction.objectStore("samples").delete(sampleId);
  });
}

function requestFromTakeStore(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction("takes", mode);
    const store = transaction.objectStore("takes");
    const request = operation(store);
    attachStorageRequest(request, transaction, resolve, reject);
  }));
}

function readTakes() {
  return requestFromTakeStore("readonly", (store) => store.getAll());
}

function writeTake(take) {
  return runStorageTransaction("readwrite", ["takes"], (transaction) => {
    transaction.objectStore("takes").put(take);
  });
}

function deleteTakeRecord(takeId) {
  return runStorageTransaction("readwrite", ["takes"], (transaction) => {
    transaction.objectStore("takes").delete(takeId);
  });
}

function requestFromKitStore(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction("kits", mode);
    const store = transaction.objectStore("kits");
    const request = operation(store);
    attachStorageRequest(request, transaction, resolve, reject);
  }));
}

function readKits() {
  return requestFromKitStore("readonly", (store) => store.getAll());
}

function writeKit(kit) {
  return runStorageTransaction("readwrite", ["kits"], (transaction) => {
    transaction.objectStore("kits").put(kit);
  });
}

function runStorageTransaction(mode, storeNames, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(storeNames, mode);
    let result;
    let settled = false;
    const rejectTransaction = () => {
      if (settled) return;
      settled = true;
      reject(transaction.error || new Error("Local storage transaction failed."));
    };

    transaction.addEventListener("complete", () => {
      if (settled) return;
      settled = true;
      resolve(result);
    }, { once: true });
    transaction.addEventListener("error", rejectTransaction, { once: true });
    transaction.addEventListener("abort", rejectTransaction, { once: true });

    try {
      result = operation(transaction);
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already be inactive.
      }
      if (!settled) {
        settled = true;
        reject(error);
      }
    }
  }));
}

function writeKitsAndSamples(kitRecords, sampleRecords) {
  return runStorageTransaction("readwrite", ["kits", "samples"], (transaction) => {
    const kitStore = transaction.objectStore("kits");
    const sampleStore = transaction.objectStore("samples");
    for (const kit of kitRecords) kitStore.put(kit);
    for (const sample of sampleRecords) sampleStore.put(sample);
  });
}

function deleteSamples(sampleIds) {
  if (!sampleIds.length) return Promise.resolve();
  return runStorageTransaction("readwrite", ["samples"], (transaction) => {
    const store = transaction.objectStore("samples");
    for (const sampleId of sampleIds) store.delete(sampleId);
  });
}

async function initializeKitLibrary(legacyPads) {
  const storedKits = await readKits();
  const mirrorKits = storedKits.length ? [] : readKitMirror();
  const validKits = storedKits
    .concat(mirrorKits)
    .filter(isValidStoredKit)
    .reduce((result, kit) => {
      if (!result.some((candidate) => candidate.id === kit.id)) result.push(kit);
      return result;
    }, [])
    .map((kit) => normalizeKit(kit, kitSlotNumber(kit.id)));

  if (!validKits.length) {
    kits = createDefaultKitMap(legacyPads);
    await runStorageTransaction("readwrite", ["kits"], (transaction) => {
      const store = transaction.objectStore("kits");
      for (const kit of kits.values()) store.put(kit);
    });
  } else {
    kits = new Map(validKits.map((kit) => [kit.id, kit]));
    const missingKits = [];
    for (let slot = 1; slot <= KIT_COUNT; slot += 1) {
      if (!kits.has(`kit-${slot}`)) {
        const kit = createKitRecord(slot, slot === 1 ? legacyPads : createDefaultPads(), {
          name: slot === 1 ? "Kit 1 — Starter" : defaultKitName(slot),
          empty: slot !== 1,
        });
        kits.set(kit.id, kit);
        missingKits.push(kit);
      }
    }
    if (missingKits.length) {
      await runStorageTransaction("readwrite", ["kits"], (transaction) => {
        const store = transaction.objectStore("kits");
        for (const kit of missingKits) store.put(kit);
      });
    }
  }

  currentKitId = kits.has(readCurrentKitId()) ? readCurrentKitId() : "kit-1";
  writeCurrentKitId();
  writeKitMirror();
}

function getKitRecords() {
  return Array.from({ length: KIT_COUNT }, (_, index) => kits.get(`kit-${index + 1}`) || createKitRecord(index + 1, createDefaultPads(), {
    name: index === 0 ? "Kit 1 — Starter" : defaultKitName(index + 1),
    empty: index !== 0,
  }));
}

function renderKitControls() {
  const records = getKitRecords();
  kitSelect.replaceChildren();

  for (const kit of records) {
    const option = document.createElement("option");
    option.value = kit.id;
    option.textContent = kit.empty ? `${kit.name} · Empty` : kit.name;
    kitSelect.append(option);
  }

  currentKitId = kits.has(currentKitId) ? currentKitId : "kit-1";
  kitSelect.value = currentKitId;
  const currentKit = kits.get(currentKitId) || records[0];
  kitNameInput.value = currentKit.name;
  kitCount.textContent = `${records.filter((kit) => !kit.empty).length}/${KIT_COUNT} used`;
  const hasOtherEmptySlot = records.some((kit) => kit.id !== currentKitId && kit.empty);
  duplicateKitButton.disabled = !hasOtherEmptySlot;
  deleteKitButton.disabled = !currentKit || currentKit.empty;
}

function getSequencerPattern(sceneId = activeSceneId) {
  const kit = kits.get(currentKitId);
  if (!kit) return createPattern();
  const existing = Array.isArray(kit.patterns) ? kit.patterns.find((pattern) => pattern?.id === sceneId) : null;
  return normalizePattern(existing || createPattern());
}

function getActiveSequencerPattern() {
  return getSequencerPattern(activeSceneId);
}

function getSequencerHistory(sceneId = activeSceneId) {
  if (!sequencerHistories.has(sceneId)) sequencerHistories.set(sceneId, createHistory({ limit: 32 }));
  return sequencerHistories.get(sceneId);
}

function updateHistoryControls() {
  undoPadButton.disabled = !layoutHistory.canUndo;
  redoPadButton.disabled = !layoutHistory.canRedo;
  undoSceneButton.disabled = !getSequencerHistory(activeSceneId).canUndo;
  redoSceneButton.disabled = !getSequencerHistory(activeSceneId).canRedo;
  duplicateSceneButton.textContent = `Duplicate to ${activeSceneId === "scene-a" ? "Scene B" : "Scene A"}`;
}

async function persistSequencerPattern(pattern, message = "Pattern saved locally.", sceneId = activeSceneId, { recordHistory = true } = {}) {
  const kit = kits.get(currentKitId);
  if (!kit) return false;
  const previousPattern = getSequencerPattern(sceneId);
  const nextPattern = normalizePattern(pattern);
  const changed = JSON.stringify(previousPattern) !== JSON.stringify(nextPattern);
  const nextPatterns = Array.isArray(kit.patterns) ? kit.patterns.filter((candidate) => candidate?.id !== sceneId) : [];
  nextPatterns.push({ id: sceneId, name: sceneId === "scene-a" ? "Scene A" : "Scene B", ...nextPattern });
  const nextKit = { ...kit, patterns: nextPatterns, updatedAt: new Date().toISOString() };
  if (!(await persistKitRecord(nextKit))) return false;
  if (recordHistory && changed) getSequencerHistory(sceneId).push(previousPattern);
  renderSequencer();
  setStatus(message, "success");
  return true;
}

function formatMicroTiming(value) {
  const percent = Math.round(Number(value || 0) * 100);
  return percent === 0 ? "0%" : `${percent > 0 ? "+" : ""}${percent}%`;
}

function renderSequencerStepEditor() {
  const pattern = getActiveSequencerPattern();
  const trackIndex = clamp(Number(selectedSequencerStep.trackIndex) || 0, 0, pattern.tracks.length - 1);
  const stepIndex = clamp(Number(selectedSequencerStep.stepIndex) || 0, 0, pattern.tracks[trackIndex].steps.length - 1);
  selectedSequencerStep = { trackIndex, stepIndex };
  const step = pattern.tracks[trackIndex].steps[stepIndex];
  sequencerStepTrackInput.value = String(trackIndex);
  sequencerStepIndexInput.value = String(stepIndex);
  sequencerStepProbabilityInput.value = String(step.probability);
  sequencerStepProbabilityValue.textContent = `${Math.round(step.probability * 100)}%`;
  sequencerStepMicroInput.value = String(step.microTiming);
  sequencerStepMicroValue.textContent = formatMicroTiming(step.microTiming);
  sequencerStepStatus.textContent = `Track ${trackIndex + 1}, step ${stepIndex + 1} · ${step.on ? "On" : "Off"}`;
}

async function updateSelectedSequencerStep(changes) {
  const next = updateStep(getActiveSequencerPattern(), selectedSequencerStep.trackIndex, selectedSequencerStep.stepIndex, changes);
  await persistSequencerPattern(next, "Step detail saved locally.");
}

function renderSequencer() {
  const pattern = getActiveSequencerPattern();
  sequencerSwingInput.value = String(pattern.swing);
  sequencerSwingValue.textContent = `${Math.round(pattern.swing * 100)}%`;
  sequencerGrid.replaceChildren();
  pattern.tracks.forEach((track, trackIndex) => {
    const row = document.createElement("div");
    row.className = "sequencer-track";
    const label = document.createElement("label");
    label.className = "sequencer-track-label";
    label.textContent = `Track ${trackIndex + 1}`;
    const select = document.createElement("select");
    select.className = "sequencer-pad-select";
    select.setAttribute("aria-label", `Scene pad for track ${trackIndex + 1}`);
    pads.forEach((pad, padIndex) => {
      const option = document.createElement("option");
      option.value = String(padIndex);
      option.textContent = `${String(padIndex + 1).padStart(2, "0")} ${getPadName(pad, padIndex)}`;
      option.selected = padIndex === track.padIndex;
      select.append(option);
    });
    select.addEventListener("change", () => {
      const next = normalizePattern(getActiveSequencerPattern());
      next.tracks[trackIndex].padIndex = Number(select.value);
      void persistSequencerPattern(next, "Track pad saved locally.");
    });
    const steps = document.createElement("div");
    steps.className = "sequencer-steps";
    track.steps.forEach((step, stepIndex) => {
      const button = document.createElement("button");
      button.className = "sequencer-step";
      button.type = "button";
      button.textContent = String(stepIndex + 1);
      button.setAttribute("aria-label", `Track ${trackIndex + 1}, step ${stepIndex + 1}, ${step.on ? "on" : "off"}, probability ${Math.round(step.probability * 100)} percent, micro timing ${formatMicroTiming(step.microTiming)}`);
      button.setAttribute("aria-pressed", String(step.on));
      button.classList.toggle("is-on", step.on);
      button.classList.toggle("is-selected", selectedSequencerStep.trackIndex === trackIndex && selectedSequencerStep.stepIndex === stepIndex);
      button.addEventListener("click", () => {
        selectedSequencerStep = { trackIndex, stepIndex };
        const next = toggleStep(getActiveSequencerPattern(), trackIndex, stepIndex);
        void persistSequencerPattern(next, "Step saved locally.");
      });
      steps.append(button);
    });
    row.append(label, select, steps);
    sequencerGrid.append(row);
  });
  sceneAButton.setAttribute("aria-pressed", String(activeSceneId === "scene-a"));
  sceneBButton.setAttribute("aria-pressed", String(activeSceneId === "scene-b"));
  sceneAButton.classList.toggle("is-active", activeSceneId === "scene-a");
  sceneBButton.classList.toggle("is-active", activeSceneId === "scene-b");
  sequencerStatus.textContent = `${activeSceneId === "scene-a" ? "Scene A" : "Scene B"} · ${sequencerRunner.running ? "Playing" : "Ready"}`;
  renderSequencerStepEditor();
  updateHistoryControls();
}

function setSequencerScene(sceneId) {
  activeSceneId = sceneId === "scene-b" ? "scene-b" : "scene-a";
  renderSequencer();
}

async function toggleSequencer() {
  if (sequencerRunner.running) {
    sequencerRunner.stop();
    stopMidiClockOutput();
    sequencerPlayButton.textContent = "Play sequence";
    renderSequencer();
    return;
  }
  try {
    await prepareAudio();
    sequencerRunner.start();
    startMidiClockOutput();
    sequencerPlayButton.textContent = "Stop sequence";
    renderSequencer();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The sequence could not start.", "error");
  }
}

async function clearSequencer() {
  if (!window.confirm(`Clear ${activeSceneId === "scene-a" ? "Scene A" : "Scene B"}?`)) return;
  await persistSequencerPattern(createPattern(), "Scene cleared and saved locally.");
}

async function duplicateSequencerScene() {
  const destination = activeSceneId === "scene-a" ? "scene-b" : "scene-a";
  await persistSequencerPattern(
    getActiveSequencerPattern(),
    `${activeSceneId === "scene-a" ? "Scene A" : "Scene B"} duplicated to ${destination === "scene-a" ? "Scene A" : "Scene B"}.`,
    destination,
  );
}

async function restoreSequencerHistory(direction) {
  const history = getSequencerHistory(activeSceneId);
  const current = getActiveSequencerPattern();
  const result = direction === "undo" ? history.peekUndo(current) : history.peekRedo(current);
  if (!result.changed) return;
  const message = direction === "undo" ? "Scene edit undone." : "Scene edit redone.";
  if (!(await persistSequencerPattern(result.state, message, activeSceneId, { recordHistory: false }))) return;
  if (direction === "undo") history.undo(current);
  else history.redo(current);
  renderSequencer();
}

function exportSceneMidi() {
  try {
    const scenes = ["scene-a", "scene-b"].map((sceneId) => ({
      name: sceneId === "scene-a" ? "Scene A" : "Scene B",
      pattern: getSequencerPattern(sceneId),
    }));
    const padNotes = pads.map((pad, index) => normalizeMidiMapping(pad.midi, 36 + index).note ?? 36 + index);
    const bytes = createMidiFile({ scenes, padNotes, bpm: Number(tempoInput.value) || 120 });
    triggerBlobDownload(
      { documentRef: document, windowRef: window },
      "touchscreen-launchpad-scenes.mid",
      new Blob([bytes], { type: "audio/midi" }),
    );
    setStatus("Scene MIDI exported. Open it in a DAW or hardware sequencer.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Scene MIDI export failed. Check browser download permissions and try again.", "error");
  }
}

function renderMidiDevices() {
  midiInputSelect.replaceChildren();
  midiOutputSelect.replaceChildren();
  const noInput = document.createElement("option");
  noInput.value = "";
  noInput.textContent = midiInputs.size ? "Choose MIDI input" : "No MIDI input detected";
  midiInputSelect.append(noInput);
  for (const [id, input] of midiInputs) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = input.name || input.manufacturer || id;
    midiInputSelect.append(option);
  }
  const noOutput = document.createElement("option");
  noOutput.value = "";
  noOutput.textContent = midiOutputs.size ? "Choose MIDI output" : "No MIDI output detected";
  midiOutputSelect.append(noOutput);
  for (const [id, output] of midiOutputs) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = output.name || output.manufacturer || id;
    midiOutputSelect.append(option);
  }
  if (activeMidiInput) midiInputSelect.value = activeMidiInput.id;
  if (activeMidiOutput) midiOutputSelect.value = activeMidiOutput.id;
}

function getMidiTargetLabel(target) {
  return {
    masterVolume: "Master volume",
    warmth: "Warmth macro",
    space: "Space macro",
    punch: "Punch macro",
    tempo: "Tempo",
  }[target] || "Master volume";
}

function renderMidiMappings() {
  if (!midiMappingsList) return;
  midiMappingsList.replaceChildren();
  const mappings = midiConfig.controllerMappings || [];
  if (!mappings.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "No CC or aftertouch mappings yet.";
    midiMappingsList.append(empty);
    return;
  }
  for (const mapping of mappings) {
    const item = document.createElement("li");
    item.className = "midi-mapping-item";
    const label = document.createElement("span");
    const source = mapping.type === "cc" ? `CC ${mapping.controller}` : "Aftertouch";
    const channel = mapping.channel === null ? "omni" : `ch ${mapping.channel + 1}`;
    label.textContent = `${source} · ${channel} → ${getMidiTargetLabel(mapping.target)}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      midiConfig = normalizeMidiConfig({
        ...midiConfig,
        controllerMappings: mappings.filter((candidate) => candidate.id !== mapping.id),
      });
      renderMidiMappings();
      void persistMidiConfig("MIDI mapping removed.");
    });
    item.append(label, remove);
    midiMappingsList.append(item);
  }
}

function syncMidiConfigInputs() {
  if (!midiProfileNameInput) return;
  midiProfileNameInput.value = midiConfig.profileName;
  midiClockInInput.checked = midiConfig.clockIn;
  midiClockOutInput.checked = midiConfig.clockOut;
  renderMidiMappings();
  renderMidiDevices();
}

async function persistMidiConfig(message = "MIDI profile saved locally.") {
  const kit = kits.get(currentKitId);
  if (!kit) return false;
  const nextKit = { ...kit, midiConfig: normalizeMidiConfig(midiConfig), updatedAt: new Date().toISOString() };
  if (!(await persistKitRecord(nextKit))) return false;
  midiConfig = normalizeMidiConfig(nextKit.midiConfig);
  setKitDirty(false);
  renderKitControls();
  setStatus(storageMode === "memory" ? `${message} Memory-only mode: a reload may discard changes.` : message, storageMode === "memory" ? "error" : "success");
  return true;
}

function handleMidiClockMessage(message) {
  if (!midiConfig.clockIn || !["clock", "start", "continue", "stop"].includes(message.command)) return false;
  if (message.command === "start" || message.command === "continue") midiClockTracker.start();
  else if (message.command === "stop") midiClockTracker.stop();
  else midiClockTracker.tick(performance.now());
  if (message.command === "start") midiStatus.textContent = "MIDI clock in · started";
  if (message.command === "stop") midiStatus.textContent = "MIDI clock in · stopped";
  return true;
}

function handleMidiMessage(event) {
  const message = parseMidiMessage(event.data);
  if (!message) return;
  if (handleMidiClockMessage(message)) return;
  if (midiControllerLearnState.handle(message)) {
    midiMappingStatus.textContent = "Controller learned and saved.";
    return;
  }
  if (midiLearnState.handle(message)) {
    midiStatus.textContent = `Learned MIDI note ${message.note}.`;
    return;
  }
  if (applyMidiControllerMessage(message)) return;
  if (message.command !== "noteon" && message.command !== "noteoff") return;
  const padIndex = getPadIndexForMidiNote(pads, message.note, { channel: message.channel });
  if (padIndex < 0) return;
  inputAdapter.emit({
    kind: "midi",
    action: message.command === "noteon" ? "trigger" : "release",
    padIndex,
    velocity: message.velocity,
    timestamp: performance.now(),
  });
}

function selectMidiInput(inputId) {
  if (activeMidiInput) activeMidiInput.onmidimessage = null;
  activeMidiInput = midiInputs.get(inputId) || undefined;
  if (activeMidiInput) activeMidiInput.onmidimessage = handleMidiMessage;
  midiConfig = normalizeMidiConfig({ ...midiConfig, inputId: activeMidiInput?.id || "" });
  if (activeMidiInput) void persistMidiConfig("MIDI input profile saved locally.");
}

function selectMidiOutput(outputId) {
  activeMidiOutput = midiOutputs.get(outputId) || undefined;
  midiConfig = normalizeMidiConfig({ ...midiConfig, outputId: activeMidiOutput?.id || "" });
  if (activeMidiOutput) {
    void persistMidiConfig("MIDI output profile saved locally.");
    if (sequencerRunner.running) startMidiClockOutput();
  }
}

function refreshMidiDevices() {
  const savedInputId = midiConfig.inputId;
  const savedOutputId = midiConfig.outputId;
  if (activeMidiInput && !midiInputs.has(activeMidiInput.id)) {
    stopAll({ announce: false });
    activeMidiInput.onmidimessage = null;
    activeMidiInput = undefined;
  }
  if (activeMidiOutput && !midiOutputs.has(activeMidiOutput.id)) {
    stopMidiClockOutput({ sendStop: false });
    activeMidiOutput = undefined;
  }
  if (!activeMidiInput && savedInputId && midiInputs.has(savedInputId)) selectMidiInput(savedInputId);
  if (!activeMidiOutput && savedOutputId && midiOutputs.has(savedOutputId)) selectMidiOutput(savedOutputId);
  renderMidiDevices();
}

function sendMidiData(data) {
  if (!activeMidiOutput) return false;
  try {
    activeMidiOutput.send(data);
    return true;
  } catch {
    activeMidiOutput = undefined;
    renderMidiDevices();
    midiStatus.textContent = "MIDI output disconnected. Reconnect the device to resume feedback.";
    return false;
  }
}

async function connectMidi() {
  if (!navigator.requestMIDIAccess) {
    midiStatus.textContent = "Web MIDI is unavailable in this browser.";
    setStatus("This browser does not expose Web MIDI. Keyboard and touch controls remain available.", "error");
    return;
  }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    midiInputs = new Map(midiAccess.inputs);
    midiOutputs = new Map(midiAccess.outputs);
    midiAccess.onstatechange = () => {
      midiInputs = new Map(midiAccess.inputs);
      midiOutputs = new Map(midiAccess.outputs);
      const hadActiveDevice = Boolean(activeMidiInput || activeMidiOutput);
      refreshMidiDevices();
      midiStatus.textContent = hadActiveDevice && !activeMidiInput && !activeMidiOutput
        ? "MIDI device disconnected. Reconnect to restore the saved profile."
        : `${midiInputs.size} input${midiInputs.size === 1 ? "" : "s"} · ${midiOutputs.size} output${midiOutputs.size === 1 ? "" : "s"}`;
    };
    refreshMidiDevices();
    midiConnectButton.textContent = "MIDI connected";
    midiStatus.textContent = `${midiInputs.size} input${midiInputs.size === 1 ? "" : "s"} · ${midiOutputs.size} output${midiOutputs.size === 1 ? "" : "s"}`;
    setStatus("MIDI is ready. Choose an input or learn a note for the selected pad.", "success");
  } catch {
    midiStatus.textContent = "MIDI permission was not granted.";
    setStatus("MIDI permission was not granted. The launchpad still works locally.", "error");
  }
}

async function saveMidiMapping(mapping) {
  const normalized = normalizeMidiMapping(mapping);
  const conflicts = getMidiMappingConflicts(pads, normalized, selectedPadIndex);
  if (conflicts.length) {
    midiLearnButton.textContent = "Learn selected pad";
    midiStatus.textContent = `That note is already mapped to ${getPadName(pads[conflicts[0]], conflicts[0])}.`;
    return false;
  }
  midiLearnButton.textContent = "Learn selected pad";
  pads[selectedPadIndex] = { ...pads[selectedPadIndex], midi: normalized };
  renderPads();
  selectPad(selectedPadIndex);
  await saveActiveKit(`MIDI note ${normalized.note} mapped to ${getPadName(pads[selectedPadIndex], selectedPadIndex)}.`);
}

function learnMidiForSelectedPad() {
  if (midiLearnState.active) {
    midiLearnState.cancel();
    midiLearnButton.textContent = "Learn selected pad";
    midiStatus.textContent = "Pad learn cancelled.";
    return;
  }
  midiLearnState.start();
  midiLearnButton.textContent = "Play a MIDI note…";
  midiStatus.textContent = `Listening for a note for ${getPadName(pads[selectedPadIndex], selectedPadIndex)}.`;
}

function cancelMidiLearn() {
  midiLearnState.cancel();
  midiControllerLearnState.cancel();
  midiLearnButton.textContent = "Learn selected pad";
  midiLearnControllerButton.textContent = "Learn CC / aftertouch";
  midiCancelLearnButton.disabled = true;
  midiStatus.textContent = "MIDI learn cancelled.";
  midiMappingStatus.textContent = "Choose a target, then learn a controller.";
}

function learnMidiController() {
  if (midiControllerLearnState.active) {
    cancelMidiLearn();
    return;
  }
  midiLearnState.cancel();
  midiLearnButton.textContent = "Learn selected pad";
  midiControllerLearnState.start({ mode: "controller" });
  midiLearnControllerButton.textContent = "Move a CC or touch…";
  midiCancelLearnButton.disabled = false;
  midiMappingStatus.textContent = `Listening for ${getMidiTargetLabel(midiMappingTargetSelect.value)}.`;
}

async function saveMidiControllerMapping(message) {
  const type = message.command === "controlchange" ? "cc" : "aftertouch";
  const controller = type === "cc" ? message.note : null;
  const candidate = normalizeMidiControllerMapping({
    id: `controller-${type}-${controller ?? "aftertouch"}-${message.channel ?? "omni"}`,
    type,
    controller,
    channel: message.channel,
    target: midiMappingTargetSelect.value,
  }, midiConfig.controllerMappings.length);
  const conflict = midiConfig.controllerMappings.find((mapping) => getMidiControllerValue(message, mapping) !== null);
  if (conflict && conflict.target !== candidate.target) {
    midiMappingStatus.textContent = `${message.command === "controlchange" ? `CC ${message.note}` : "Aftertouch"} already controls ${getMidiTargetLabel(conflict.target)}.`;
    midiLearnControllerButton.textContent = "Learn CC / aftertouch";
    midiCancelLearnButton.disabled = true;
    return false;
  }
  midiConfig = normalizeMidiConfig({
    ...midiConfig,
    controllerMappings: [
      ...midiConfig.controllerMappings.filter((mapping) => getMidiControllerValue(message, mapping) === null),
      candidate,
    ],
  });
  midiLearnControllerButton.textContent = "Learn CC / aftertouch";
  midiCancelLearnButton.disabled = true;
  renderMidiMappings();
  return persistMidiConfig(`${getMidiTargetLabel(candidate.target)} mapping saved locally.`);
}

function applyMidiControllerMessage(message) {
  const mapping = midiConfig.controllerMappings.find((candidate) => getMidiControllerValue(message, candidate) !== null);
  if (!mapping) return false;
  const value = getMidiControllerValue(message, mapping);
  switch (mapping.target) {
    case "masterVolume":
      masterVolumeInput.value = String(value);
      updateMasterVolume();
      break;
    case "warmth":
      macroWarmthInput.value = String(value);
      applyMasterMacro();
      break;
    case "space":
      macroSpaceInput.value = String(value);
      applyMasterMacro();
      break;
    case "punch":
      macroPunchInput.value = String(value);
      applyMasterMacro();
      break;
    case "tempo":
      tempoInput.value = String(Math.round(60 + value * 140));
      updateTempoValue();
      break;
    default:
      return false;
  }
  midiMappingStatus.textContent = `${getMidiTargetLabel(mapping.target)} · ${Math.round(value * 100)}%`;
  return true;
}

function startMidiClockOutput() {
  stopMidiClockOutput({ sendStop: false });
  if (!midiConfig.clockOut || !activeMidiOutput) return;
  sendMidiData(createMidiClockMessage("start"));
  const period = Math.max(2, 60000 / (clamp(Number(tempoInput.value) || 120, 40, 240) * 24));
  midiClockTimer = window.setInterval(() => sendMidiData(createMidiClockMessage("clock")), period);
}

function stopMidiClockOutput({ sendStop = true } = {}) {
  if (midiClockTimer) window.clearInterval(midiClockTimer);
  midiClockTimer = undefined;
  if (sendStop && activeMidiOutput && midiConfig.clockOut) sendMidiData(createMidiClockMessage("stop"));
}

function sendMidiForPad(index, command, velocity = 1) {
  if (!activeMidiOutput) return;
  const mapping = normalizeMidiMapping(pads[index]?.midi, 36 + index);
  if (mapping.note === null) return;
  sendMidiData(createMidiNoteMessage(command, mapping.note, velocity, mapping.channel || 0));
}

function applyKit(kit) {
  pads = kit?.empty ? createDefaultPads() : normalizePads(kit?.pads);
  masterEffects = normalizeMasterEffects(kit?.masterEffects);
  midiConfig = normalizeMidiConfig(kit?.midiConfig);
  syncMasterEffectInputs();
  renderMasterSnapshots();
  syncMidiConfigInputs();
  if (audioContext) configureMasterEffects();
  layoutHistory.clear();
  for (const history of sequencerHistories.values()) history.clear();
  setKitDirty(false);
  renderPads();
  selectPad(0);
  renderSequencer();
}

async function persistKitRecord(record) {
  try {
    if (storageMode !== "memory") {
      await writeKit(record);
    }
    kits.set(record.id, record);
    writeKitMirror();
    return true;
  } catch (error) {
    markMemoryOnlyMode(
      isQuotaError(error)
        ? "Kit storage is full. Export a .launchpack backup and free browser storage."
        : "Kit storage failed. This kit remains available in memory for this session.",
      isQuotaError(error) ? "quota" : "unavailable",
    );
    return false;
  }
}

async function saveActiveKit(message = "Kit saved locally.") {
  const previousKit = kits.get(currentKitId);
  const nextKit = {
    ...(previousKit || createKitRecord(kitSlotNumber(currentKitId) || 1)),
    id: currentKitId,
    pads: clonePads(),
    midiConfig: normalizeMidiConfig(midiConfig),
    empty: false,
    updatedAt: new Date().toISOString(),
  };

  if (!saveLayout(message)) return false;
  if (!(await persistKitRecord(nextKit))) return false;
  setKitDirty(false);
  renderKitControls();
  setStatus(storageMode === "memory" ? `${message} Memory-only mode: a reload may discard changes.` : message, storageMode === "memory" ? "error" : "success");
  return true;
}

function hasUnsavedKitChanges() {
  return editorDirty || kitDirty;
}

function confirmKitSwitch() {
  return !hasUnsavedKitChanges() || window.confirm("This kit has unsaved edits. Switch kits and discard them?");
}

async function switchKit(nextKitId) {
  if (nextKitId === currentKitId) return;
  if (!confirmKitSwitch()) {
    kitSelect.value = currentKitId;
    return;
  }

  const nextKit = kits.get(nextKitId);
  if (!nextKit) {
    kitSelect.value = currentKitId;
    setStatus("That kit is no longer available.", "error");
    return;
  }

  stopAll({ announce: false });
  currentKitId = nextKitId;
  writeCurrentKitId();
  applyKit(nextKit);
  renderKitControls();
  setStatus(`${nextKit.name} loaded.`, "success");
}

async function renameActiveKit() {
  const nextName = kitNameInput.value.trim();
  if (!nextName || nextName.length > MAX_KIT_NAME_LENGTH) {
    setStatus(`Kit names must be 1–${MAX_KIT_NAME_LENGTH} characters.`, "error");
    kitNameInput.value = kits.get(currentKitId)?.name || defaultKitName(kitSlotNumber(currentKitId));
    return;
  }

  const previousKit = kits.get(currentKitId);
  const nextKit = {
    ...(previousKit || createKitRecord(kitSlotNumber(currentKitId) || 1)),
    name: nextName,
    updatedAt: new Date().toISOString(),
  };
  if (!(await persistKitRecord(nextKit))) {
    kitNameInput.value = previousKit?.name || nextName;
    return;
  }
  renderKitControls();
  setStatus(`${nextName} renamed and saved.`, "success");
}

async function duplicateActiveKit() {
  if (hasUnsavedKitChanges() && !confirmKitSwitch()) return;
  const targetKit = getKitRecords().find((kit) => kit.id !== currentKitId && kit.empty);
  if (!targetKit) {
    setStatus("All five kit slots are in use. Delete a kit before duplicating.", "error");
    return;
  }

  const sourceKit = kits.get(currentKitId) || createKitRecord(kitSlotNumber(currentKitId) || 1, pads);
  const nextKit = {
    ...targetKit,
    name: `${sourceKit.name} Copy`.slice(0, MAX_KIT_NAME_LENGTH),
    pads: clonePads(),
    empty: false,
    updatedAt: new Date().toISOString(),
  };
  if (!(await persistKitRecord(nextKit))) return;
  stopAll({ announce: false });
  currentKitId = nextKit.id;
  writeCurrentKitId();
  applyKit(nextKit);
  renderKitControls();
  setStatus(`${nextKit.name} duplicated and loaded.`, "success");
}

async function deleteActiveKit() {
  const currentKit = kits.get(currentKitId);
  if (!currentKit || currentKit.empty) {
    setStatus("That kit slot is already empty.", "info");
    return;
  }
  if (!window.confirm(`Delete ${currentKit.name}? Its pad arrangement will be removed, but shared audio stays in the library.`)) return;

  const slot = kitSlotNumber(currentKitId);
  const emptyKit = createKitRecord(slot, createDefaultPads(), { name: defaultKitName(slot), empty: true, createdAt: currentKit.createdAt });
  stopAll({ announce: false });
  if (!(await persistKitRecord(emptyKit))) return;
  applyKit(emptyKit);
  renderKitControls();
  setStatus(`${currentKit.name} deleted. The ${emptyKit.name} slot is ready for a duplicate or new kit.`, "success");
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `sample-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isAudioFile(file) {
  return file?.type?.startsWith("audio/") || /\.(wav|mp3|ogg|m4a|aac|flac)$/i.test(file?.name || "");
}

async function hashBlob(blob) {
  if (!globalThis.crypto?.subtle) throw new Error("This browser cannot hash local audio files safely.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function findSampleByHash(hash) {
  for (const sample of samples.values()) {
    if (sample.hash === hash) return sample;
    if (!sample.hash && isValidStoredSample(sample)) {
      try {
        sample.hash = await hashBlob(sample.blob);
        if (sample.hash === hash) return sample;
      } catch {
        // A legacy sample without a readable blob cannot participate in deduplication.
      }
    }
  }
  return null;
}

async function persistSample(file) {
  if (!file || !isAudioFile(file)) {
    throw new Error("Choose a supported audio file.");
  }

  if (!Number.isFinite(file.size) || file.size < 0 || file.size > MAX_SAMPLE_BYTES) {
    throw new Error("Samples must be smaller than 50 MB each.");
  }

  const hash = await hashBlob(file);
  const duplicate = await findSampleByHash(hash);
  if (duplicate) return { sample: duplicate, created: false };

  if (samples.size + pendingSampleCount >= MAX_SAMPLE_COUNT) {
    throw new Error("This browser already has the maximum number of saved samples (128).");
  }
  if (getStoredSampleBytes() + pendingSampleBytes + file.size > MAX_SAMPLE_STORAGE_BYTES) {
    throw new Error("This browser has reached the 512 MB saved-sample limit.");
  }

  pendingSampleCount += 1;
  pendingSampleBytes += file.size;

  const sample = normalizeSampleRecord({
    id: makeId(),
    name: file.name,
    mime: file.type || "audio/*",
    size: file.size,
    blob: file,
    hash,
    createdAt: new Date().toISOString(),
    slices: [],
  });

  if (storageMode === "persistent") setStorageState("saving", "Saving sample…");
  try {
    await writeSample(sample);
    if (storageMode === "persistent") setStorageState("saved");
  } catch (error) {
    markMemoryOnlyMode(
      isQuotaError(error)
        ? "Sample storage is full. This sample is available for this session only; export your layout before resetting storage."
        : "Sample storage failed. This sample is available for this session only.",
      isQuotaError(error) ? "quota" : "unavailable",
    );
  } finally {
    pendingSampleCount -= 1;
    pendingSampleBytes -= file.size;
  }
  samples.set(sample.id, sample);
  renderSampleLibrary();
  return { sample, created: true };
}

function getPersistedSampleRecord(sample) {
  if (!sample) return sample;
  const { buffer, bufferPromise, reverseBuffer, ...record } = sample;
  return normalizeSampleRecord(record);
}

function getEditorSample() {
  const pad = pads[selectedPadIndex];
  return (draftSampleId && samples.get(draftSampleId)) || (pad?.sampleId && samples.get(pad.sampleId)) || null;
}

function getSampleSlice(sample, sliceId) {
  return normalizeSliceDefinitions(sample?.slices).find((slice) => slice.id === sliceId) || null;
}

async function persistSampleSlices(sample, nextSlices, message = "Slices saved locally.") {
  if (!sample) return false;
  const previousSlices = normalizeSliceDefinitions(sample.slices);
  sample.slices = normalizeSliceDefinitions(nextSlices);
  if (storageMode === "memory") {
    setStatus(`${message} Memory-only mode: a reload may discard changes.`, "error");
    renderSliceEditor(sample);
    return true;
  }
  try {
    await writeSample(getPersistedSampleRecord(sample));
    setStorageState("saved");
    renderSliceEditor(sample);
    setStatus(message, "success");
    return true;
  } catch (error) {
    sample.slices = previousSlices;
    markMemoryOnlyMode("Sample storage failed. Slice edits are available for this session only.", isQuotaError(error) ? "quota" : "unavailable");
    renderSliceEditor(sample);
    setStatus(error instanceof Error ? error.message : "Slice metadata could not be saved.", "error");
    return false;
  }
}

function renderSliceEditor(sample) {
  if (!sliceList) return;
  const slices = normalizeSliceDefinitions(sample?.slices);
  sliceCountValue.textContent = `${slices.length}/${MAX_SLICE_COUNT}`;
  createSlicesButton.disabled = !sample;
  clearSlicesButton.disabled = !sample || !slices.length;
  sliceList.replaceChildren();

  if (!sample) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "Load and save a sample before creating slices.";
    sliceList.append(emptyItem);
    return;
  }
  if (!slices.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No slices yet. Create an even bank, then adjust each marker.";
    sliceList.append(emptyItem);
    return;
  }

  for (const [index, slice] of slices.entries()) {
    const item = document.createElement("li");
    item.className = "slice-item";
    item.dataset.sliceId = slice.id;
    if (slice.id === draftSliceId || slice.id === pads[selectedPadIndex]?.sliceId) item.classList.add("is-selected");

    const header = document.createElement("div");
    header.className = "slice-item-header";
    const label = document.createElement("input");
    label.className = "slice-label";
    label.type = "text";
    label.maxLength = 32;
    label.value = slice.label;
    label.setAttribute("aria-label", `${slice.label} name`);
    label.addEventListener("change", () => {
      void persistSampleSlices(sample, updateSliceDefinition(sample.slices, index, { label: label.value }), `${sample.name} slice ${index + 1} renamed.`);
    });
    const rangeText = document.createElement("span");
    rangeText.className = "muted slice-range-text";
    rangeText.textContent = `${Math.round(slice.start * 100)}–${Math.round(slice.end * 100)}%`;
    header.append(label, rangeText);

    const rangeGrid = document.createElement("div");
    rangeGrid.className = "slice-range-grid";
    const startLabel = document.createElement("label");
    startLabel.textContent = "In";
    const startInput = document.createElement("input");
    startInput.type = "range";
    startInput.min = "0";
    startInput.max = "1";
    startInput.step = "0.001";
    startInput.value = String(slice.start);
    startInput.setAttribute("aria-label", `${slice.label} start`);
    startInput.addEventListener("change", () => {
      void persistSampleSlices(sample, updateSliceDefinition(sample.slices, index, { start: startInput.value }), `${sample.name} slice ${index + 1} updated.`);
    });
    startLabel.append(startInput);
    const endLabel = document.createElement("label");
    endLabel.textContent = "Out";
    const endInput = document.createElement("input");
    endInput.type = "range";
    endInput.min = "0";
    endInput.max = "1";
    endInput.step = "0.001";
    endInput.value = String(slice.end);
    endInput.setAttribute("aria-label", `${slice.label} end`);
    endInput.addEventListener("change", () => {
      void persistSampleSlices(sample, updateSliceDefinition(sample.slices, index, { end: endInput.value }), `${sample.name} slice ${index + 1} updated.`);
    });
    endLabel.append(endInput);
    rangeGrid.append(startLabel, endLabel);

    const actions = document.createElement("div");
    actions.className = "slice-actions";
    const previewButton = document.createElement("button");
    previewButton.className = "button button-quiet";
    previewButton.type = "button";
    previewButton.textContent = "Preview";
    previewButton.setAttribute("aria-label", `Preview ${slice.label}`);
    previewButton.addEventListener("click", () => void previewSampleSlice(sample, slice.id));
    const assignButton = document.createElement("button");
    assignButton.className = "button button-secondary";
    assignButton.type = "button";
    assignButton.textContent = "Assign to pad";
    assignButton.setAttribute("aria-label", `Assign ${slice.label} to the selected pad`);
    assignButton.addEventListener("click", () => assignSliceToSelectedPad(sample, slice.id));
    actions.append(previewButton, assignButton);
    item.append(header, rangeGrid, actions);
    sliceList.append(item);
  }
}

async function previewSampleSlice(sample, sliceId) {
  const slice = getSampleSlice(sample, sliceId);
  if (!slice) return;
  try {
    const context = await prepareAudio();
    const generation = playbackGeneration;
    await playSample(selectedPadIndex, {
      ...pads[selectedPadIndex],
      mode: "oneshot",
      sampleRegion: { start: slice.start, end: slice.end, loopStart: slice.start, loopEnd: slice.end, reverse: false },
    }, sample, context, generation, 1);
    if (generation === playbackGeneration) setStatus(`${sample.name} · ${slice.label} previewed.`, "info", { force: true });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The slice preview could not be played.", "error");
  }
}

function assignSliceToSelectedPad(sample, sliceId) {
  const slice = getSampleSlice(sample, sliceId);
  if (!slice) return;
  stopPad(selectedPadIndex);
  draftSampleId = sample.id;
  draftSampleCleared = false;
  draftSliceId = slice.id;
  sampleFileInput.value = "";
  sampleStartInput.value = String(slice.start);
  sampleEndInput.value = String(slice.end);
  sampleLoopStartInput.value = String(slice.start);
  sampleLoopEndInput.value = String(slice.end);
  sampleReverseInput.checked = false;
  updateSampleName();
  updateSampleEditorLabels();
  renderSliceEditor(sample);
  markEditorDirty();
  setStatus(`${sample.name} · ${slice.label} staged for ${getPadName(pads[selectedPadIndex], selectedPadIndex)}. Save the pad to apply it.`);
}

function isValidStoredSample(sample) {
  return Boolean(
    sample
      && typeof sample.id === "string"
      && typeof sample.name === "string"
      && sample.name.trim()
      && typeof sample.mime === "string"
      && Number.isFinite(sample.size)
      && sample.size >= 0
      && sample.size <= MAX_SAMPLE_BYTES
      && (sample.hash === undefined || /^[\da-f]{64}$/i.test(sample.hash))
      && typeof sample.createdAt === "string"
      && typeof sample.blob?.arrayBuffer === "function"
      && Number.isFinite(sample.blob.size)
      && sample.blob.size === sample.size
      && sample.blob.size <= MAX_SAMPLE_BYTES,
  );
}

function getStoredSampleBytes() {
  return [...samples.values()].reduce((total, sample) => {
    if (!isValidStoredSample(sample)) return total;
    const size = Number(sample?.size);
    if (!Number.isFinite(size) || size <= 0) return total;
    return Math.min(MAX_SAMPLE_STORAGE_BYTES + 1, total + size);
  }, 0);
}

function partitionStoredSamples(storedSamples) {
  return storedSamples.reduce((result, sample) => {
    result[isValidStoredSample(sample) ? "valid" : "corrupt"].push(sample);
    return result;
  }, { valid: [], corrupt: [] });
}

function limitStoredSamples(validSamples) {
  const accepted = [];
  const excess = [];
  let totalBytes = 0;

  for (const sample of validSamples) {
    const nextTotal = totalBytes + sample.size;
    if (accepted.length >= MAX_SAMPLE_COUNT || nextTotal > MAX_SAMPLE_STORAGE_BYTES) {
      excess.push(sample);
      continue;
    }
    accepted.push(sample);
    totalBytes = nextTotal;
  }

  return { accepted, excess };
}

async function repairSampleStorage() {
  repairStorageButton.disabled = true;
  setStorageState("upgrade", "Checking saved sample storage…");
  sampleDatabase?.close();
  sampleDatabase = undefined;
  databasePromise = undefined;

  try {
    const { valid, corrupt } = partitionStoredSamples(await readSamples());
    const { accepted, excess } = limitStoredSamples(valid);
    samples = new Map(accepted.map((sample) => {
      const normalized = normalizeSampleRecord(sample);
      return [normalized.id, normalized];
    }));
    renderSampleLibrary();
    updateSampleName();

    if (corrupt.length || excess.length) {
      const issueCount = corrupt.length + excess.length;
      storageMode = "memory";
      setStorageState("corrupt", `${issueCount} saved sample${issueCount === 1 ? " is" : "s are"} invalid or exceed local limits. Export your layout, then reset sample storage if needed.`);
      setStatus("Sample storage still needs repair.", "error");
      return;
    }

    storageMode = "persistent";
    setStorageState("saved");
    setStatus("Sample storage repaired.", "success");
  } catch (error) {
    markMemoryOnlyMode("Sample storage is unavailable. Repair can be retried without deleting saved data.", "unavailable");
    setStatus(error instanceof Error ? error.message : "Sample storage could not be repaired.", "error");
  } finally {
    repairStorageButton.disabled = false;
  }
}

function deleteSampleDatabase() {
  if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB is unavailable."));

  sampleDatabase?.close();
  sampleDatabase = undefined;
  databasePromise = undefined;
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.addEventListener("success", resolve, { once: true });
    request.addEventListener("error", () => reject(request.error || new Error("Sample storage could not be reset.")), { once: true });
    request.addEventListener("blocked", () => reject(new Error("Close other launchpad tabs before resetting sample storage.")), { once: true });
  });
}

async function resetSampleStorage() {
  if (!window.confirm("Reset saved sample storage? This removes saved audio files from this browser. Export your layout first; pad assignments will be cleared after the reset.")) return;

  stopAll({ announce: false });
  resetStorageButton.disabled = true;
  setStorageState("saving", "Resetting sample storage…");
  try {
    await deleteSampleDatabase();
    samples = new Map();
    takes = new Map();
    pads = pads.map((pad) => ({ ...pad, sampleId: null }));
    currentKitId = "kit-1";
    kits = new Map();
    try {
      localStorage.removeItem(KITS_MIRROR_STORAGE_KEY);
    } catch {
      // The reset still proceeds if the compatibility mirror cannot be cleared.
    }
    storageMode = "persistent";
    await initializeKitLibrary(createDefaultPads());
    pads = createDefaultPads();
    setStorageState("saved");
    renderPads();
    selectPad(0);
    renderSampleLibrary();
    renderTakeLibrary();
    saveLayout("Sample storage reset. Layout saved without sample assignments.");
  } catch (error) {
    markMemoryOnlyMode("Sample storage reset did not complete. No saved samples were intentionally removed.", "unavailable");
    setStatus(error instanceof Error ? error.message : "Sample storage could not be reset.", "error");
  } finally {
    resetStorageButton.disabled = false;
  }
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
    emptyItem.textContent = query ? "No samples match this search." : "No local samples yet. Load audio on a pad or import a folder.";
    sampleList.append(emptyItem);
    return;
  }

  for (const sample of storedSamples) {
    const item = document.createElement("li");
    item.className = "sample-item";
    item.dataset.sampleId = sample.id;
    const details = document.createElement("div");
    details.className = "sample-item-details";
    const name = document.createElement("span");
    name.textContent = sample.name;
    const size = document.createElement("span");
    size.className = "muted";
    size.textContent = formatBytes(sample.size);
    details.append(name, size);
    const assignButton = document.createElement("button");
    assignButton.className = "button button-secondary sample-assign";
    assignButton.type = "button";
    assignButton.textContent = "Assign";
    assignButton.setAttribute("aria-label", `Assign ${sample.name} to the selected pad`);
    assignButton.addEventListener("click", () => assignSampleToSelectedPad(sample.id));
    item.append(details, assignButton);
    sampleList.append(item);
  }
}

function assignSampleToSelectedPad(sampleId) {
  const sample = samples.get(sampleId);
  if (!sample) {
    setStatus("That sample is no longer in the library.", "error");
    renderSampleLibrary();
    return;
  }

  stopPad(selectedPadIndex);
  draftSampleId = sampleId;
  draftSampleCleared = false;
  draftSliceId = null;
  sampleFileInput.value = "";
  updateSampleName();
  void renderSampleEditor();
  markEditorDirty();
  setStatus(`${sample.name} selected for ${getPadName(pads[selectedPadIndex], selectedPadIndex)}. Save the pad to apply it.`);
}

function revokeTakePreviewUrls() {
  for (const url of takePreviewUrls.values()) URL.revokeObjectURL(url);
  takePreviewUrls.clear();
}

function drawTakeWaveformPlaceholder(canvas, message = "Preview waveform") {
  if (!canvas?.getContext) return;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f3f4f8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#7d8494";
  context.font = "12px system-ui";
  context.textAlign = "center";
  context.fillText(message, canvas.width / 2, canvas.height / 2 + 4);
}

async function renderTakeWaveform(take, canvas) {
  const token = (takeWaveformTokens.get(take.id) || 0) + 1;
  takeWaveformTokens.set(take.id, token);
  try {
    const buffer = await getAudioContext().decodeAudioData((await take.blob.arrayBuffer()).slice(0));
    if (takeWaveformTokens.get(take.id) !== token) return;
    drawWaveform(canvas, buffer);
  } catch {
    if (takeWaveformTokens.get(take.id) === token) drawTakeWaveformPlaceholder(canvas, "Waveform unavailable");
  }
}

async function renameTake(takeId) {
  const take = takes.get(takeId);
  if (!take) return;
  const nextName = window.prompt("Name this take", take.name);
  if (nextName === null) return;
  const safeName = nextName.trim().slice(0, 80);
  if (!safeName) {
    setStatus("Take names must contain at least one character.", "error");
    return;
  }
  const updated = normalizeTakeRecord({ ...take, name: safeName });
  try {
    await writeTake(updated);
    takes.set(takeId, updated);
    renderTakeLibrary();
    setStatus(`${safeName} renamed and saved.`, "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The take name could not be saved.", "error");
  }
}

async function addTakeMarker(takeId, audioElement) {
  const take = takes.get(takeId);
  if (!take) return;
  const atMs = Math.max(0, Number(audioElement.currentTime) * 1000 || 0);
  const label = window.prompt("Marker label", `Marker ${take.markers?.length + 1 || 1}`);
  if (label === null) return;
  const safeLabel = label.trim().slice(0, 40) || `Marker ${take.markers?.length + 1 || 1}`;
  const updated = normalizeTakeRecord({
    ...take,
    markers: [...(take.markers || []), { id: makeId(), label: safeLabel, atMs }],
  });
  try {
    await writeTake(updated);
    takes.set(takeId, updated);
    renderTakeLibrary();
    setStatus(`${safeLabel} added to ${take.name}.`, "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The take marker could not be saved.", "error");
  }
}

async function downloadTakeWav(takeId) {
  const take = takes.get(takeId);
  if (!take) return;
  try {
    const buffer = await getAudioContext().decodeAudioData((await take.blob.arrayBuffer()).slice(0));
    const wav = new Blob([encodePcmWav(buffer)], { type: "audio/wav" });
    triggerBlobDownload({ documentRef: document, windowRef: window }, `${safePackFilename(take.name)}.wav`, wav);
    setStatus(`${take.name} exported as deterministic PCM WAV.`, "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "WAV export is unavailable for this recording. The source take is still available.", "error");
  }
}

function renderTakeLibrary() {
  revokeTakePreviewUrls();
  const orderedTakes = [...takes.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  takeCount.textContent = `${orderedTakes.length} ${orderedTakes.length === 1 ? "take" : "takes"}`;
  takeList.replaceChildren();
  if (!orderedTakes.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "No takes yet. Record a voice, room sound, or pad performance.";
    takeList.append(emptyItem);
    return;
  }

  for (const take of orderedTakes.slice(0, 8)) {
    const item = document.createElement("li");
    item.className = "sample-item take-item";
    item.dataset.takeId = take.id;
    const details = document.createElement("div");
    details.className = "sample-item-details";
    const name = document.createElement("span");
    name.textContent = take.name;
    const meta = document.createElement("span");
    meta.className = "muted";
    meta.textContent = `${formatRecordingTime(take.durationMs)} · ${formatBytes(take.size)}`;
    const waveform = document.createElement("canvas");
    waveform.className = "take-waveform";
    waveform.width = 320;
    waveform.height = 48;
    waveform.setAttribute("aria-label", `${take.name} waveform preview`);
    drawTakeWaveformPlaceholder(waveform);
    details.append(name, meta, waveform);
    const previewUrl = URL.createObjectURL(take.blob);
    takePreviewUrls.set(take.id, previewUrl);
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.preload = "metadata";
    audio.src = previewUrl;
    audio.setAttribute("aria-label", `Review ${take.name}`);
    audio.addEventListener("loadeddata", () => void renderTakeWaveform(take, waveform), { once: true });
    details.append(audio);
    if (take.markers?.length) {
      const markers = document.createElement("span");
      markers.className = "muted take-markers";
      markers.textContent = `Markers: ${take.markers.map((marker) => `${marker.label} ${formatRecordingTime(marker.atMs)}`).join(" · ")}`;
      details.append(markers);
    }
    const actions = document.createElement("div");
    actions.className = "take-actions";
    const assignButton = document.createElement("button");
    assignButton.className = "button button-secondary";
    assignButton.type = "button";
    assignButton.textContent = "Use on pad";
    assignButton.setAttribute("aria-label", `Use ${take.name} on the selected pad`);
    assignButton.addEventListener("click", () => void assignTakeToSelectedPad(take.id));
    const downloadButton = document.createElement("button");
    downloadButton.className = "text-button";
    downloadButton.type = "button";
    downloadButton.textContent = "Download";
    downloadButton.setAttribute("aria-label", `Download ${take.name}`);
    downloadButton.addEventListener("click", () => downloadTake(take.id));
    const wavButton = document.createElement("button");
    wavButton.className = "text-button";
    wavButton.type = "button";
    wavButton.textContent = "WAV";
    wavButton.setAttribute("aria-label", `Export ${take.name} as WAV`);
    wavButton.addEventListener("click", () => void downloadTakeWav(take.id));
    const markerButton = document.createElement("button");
    markerButton.className = "text-button";
    markerButton.type = "button";
    markerButton.textContent = "Mark position";
    markerButton.setAttribute("aria-label", `Add marker to ${take.name}`);
    markerButton.addEventListener("click", () => void addTakeMarker(take.id, audio));
    const renameButton = document.createElement("button");
    renameButton.className = "text-button";
    renameButton.type = "button";
    renameButton.textContent = "Rename";
    renameButton.setAttribute("aria-label", `Rename ${take.name}`);
    renameButton.addEventListener("click", () => void renameTake(take.id));
    const deleteButton = document.createElement("button");
    deleteButton.className = "text-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => void removeTake(take.id));
    actions.append(assignButton, downloadButton, wavButton, markerButton, renameButton, deleteButton);
    item.append(details, actions);
    takeList.append(item);
  }
}

function downloadTake(takeId) {
  const take = takes.get(takeId);
  if (!take) return;
  const extension = take.mime.includes("wav") ? "wav" : take.mime.includes("ogg") ? "ogg" : take.mime.includes("mp4") ? "m4a" : "webm";
  try {
    triggerBlobDownload(
      { documentRef: document, windowRef: window },
      `${safePackFilename(take.name)}.${extension}`,
      take.blob,
    );
    setStatus(`${take.name} downloaded from local storage.`, "success");
  } catch {
    setStatus("The take download failed. Check browser download permissions and try again.", "error");
  }
}

async function assignTakeToSelectedPad(takeId) {
  const take = takes.get(takeId);
  if (!take) return;
  try {
    const extension = take.mime.includes("wav") ? "wav" : take.mime.includes("ogg") ? "ogg" : take.mime.includes("mp4") ? "m4a" : "webm";
    const file = new File([take.blob], `${take.name}.${extension}`, { type: take.mime });
    const persisted = await persistSample(file);
    assignSampleToSelectedPad(persisted.sample.id);
    setStatus(`${take.name} is ready on ${getPadName(pads[selectedPadIndex], selectedPadIndex)}. Save the pad to apply it.`, "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The take could not be assigned.", "error");
  }
}

async function removeTake(takeId) {
  const take = takes.get(takeId);
  if (!take || !window.confirm(`Delete ${take.name}?`)) return;
  try {
    await deleteTakeRecord(takeId);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The take could not be deleted.", "error");
    return;
  }
  takes.delete(takeId);
  if (lastTakeId === takeId) lastTakeId = undefined;
  renderTakeLibrary();
  setStatus(`${take.name} deleted.`, "success");
}

function updateRecordingState({ state = recordingSession.state, elapsedMs = recordingSession.elapsedMs, error } = {}) {
  const isRecording = state === "recording" || state === "paused" || state === "stopping";
  recordButton.textContent = isRecording ? "Stop recording" : "Record performance";
  recordButton.classList.toggle("is-recording", state === "recording");
  recordButton.disabled = state === "stopping";
  recordPauseButton.disabled = state !== "recording" && state !== "paused";
  recordPauseButton.textContent = state === "paused" ? "Resume recording" : "Pause recording";
  recordingTimer.textContent = formatRecordingTime(elapsedMs);
  recordingState.textContent = state === "recording"
    ? "Capturing microphone + app mix"
    : state === "paused"
      ? "Recording paused"
      : state === "stopping"
        ? "Finalizing take…"
        : state === "ready"
          ? "Take saved locally"
          : "Ready to capture";
  recordingState.dataset.state = state;
  if (error) setStatus(error instanceof Error ? error.message : "The recording failed.", "error");
  if (!isRecording && recordingTicker) {
    window.clearInterval(recordingTicker);
    recordingTicker = undefined;
  }
}

function stopRecordingTracks() {
  recordingMicSource?.disconnect();
  recordingMicGain?.disconnect();
  recordingMicSource = undefined;
  recordingMicGain = undefined;
  recordingMicStream?.getTracks().forEach((track) => track.stop());
  recordingMicStream = undefined;
}

async function startPerformanceRecording() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("This browser does not expose microphone capture.", "error");
    return;
  }
  if (!recordingDestination) {
    setStatus("This browser cannot mix app audio for local recording.", "error");
    return;
  }
  try {
    const context = await prepareAudio();
    recordingMicStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    });
    recordingMicSource = context.createMediaStreamSource(recordingMicStream);
    recordingMicGain = context.createGain();
    recordingMicGain.gain.value = 1;
    recordingMicSource.connect(recordingMicGain);
    recordingMicGain.connect(recordingDestination);
    recordingSession.start(recordingDestination.stream, { name: "Launchpad take" });
    recordingTicker = window.setInterval(() => updateRecordingState({ state: recordingSession.state, elapsedMs: recordingSession.elapsedMs }), 250);
    setStatus("Recording microphone and app mix. Perform, then stop when ready.", "success");
  } catch (error) {
    stopRecordingTracks();
    recordingSession.cancel();
    setStatus(error instanceof Error ? error.message : "Microphone permission or recording setup failed.", "error");
  }
}

async function stopPerformanceRecording() {
  if (recordingSession.state !== "recording" && recordingSession.state !== "paused") return;
  try {
    const elapsedMs = recordingSession.elapsedMs;
    const blob = await recordingSession.stop();
    stopRecordingTracks();
    const take = createTakeRecord({
      id: makeId(),
      blob,
      name: `Take ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      kitId: currentKitId,
      padIndex: selectedPadIndex,
      durationMs: elapsedMs,
    });
    const storedBytes = [...takes.values()].reduce((total, item) => total + item.size, 0);
    if (takes.size >= MAX_TAKE_COUNT || storedBytes + take.size > MAX_TAKE_STORAGE_BYTES) {
      throw new Error("Take storage is full. Delete an older take before recording another.");
    }
    try {
      await writeTake(take);
    } catch (error) {
      markMemoryOnlyMode("The take is available for this session, but could not be saved locally.", isQuotaError(error) ? "quota" : "unavailable");
    }
    takes.set(take.id, take);
    lastTakeId = take.id;
    renderTakeLibrary();
    updateRecordingState({ state: "ready", elapsedMs });
    setStatus(`${take.name} saved. Use it on the selected pad or keep performing.`, "success");
  } catch (error) {
    stopRecordingTracks();
    recordingSession.cancel();
    updateRecordingState({ state: "idle" });
    setStatus(error instanceof Error ? error.message : "The take could not be saved.", "error");
  }
}

function togglePerformanceRecording() {
  if (recordingSession.state === "recording" || recordingSession.state === "paused") void stopPerformanceRecording();
  else if (recordingSession.state === "idle" || recordingSession.state === "ready") void startPerformanceRecording();
}

function toggleRecordingPause() {
  try {
    if (recordingSession.state === "recording") recordingSession.pause();
    else if (recordingSession.state === "paused") recordingSession.resume();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "This browser cannot pause the recording.", "error");
  }
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function updateAudioDiagnostics() {
  if (!audioContext || !audioDiagnostics) return;
  audioDiagnostics.textContent = describeAudioState(audioContext.state, {
    sampleRate: audioContext.sampleRate,
    baseLatency: audioContext.baseLatency,
  });
}

function handleAudioContextStateChange() {
  if (!audioContext) return;
  const state = normalizeAudioContextState(audioContext.state);
  updateAudioDiagnostics();
  if (state === "running") return;
  clearSequencerTimers();
  if (sequencerRunner.running) {
    sequencerRunner.stop();
    stopMidiClockOutput();
    sequencerPlayButton.textContent = "Play sequence";
    renderSequencer();
  }
  stopAll({ announce: false });
  setStatus(
    state === "suspended"
      ? "Audio was suspended. Press Check audio or interact with the page to resume."
      : state === "closed"
        ? "Audio closed. Reload the page before performing again."
        : "Audio is unavailable in this browser.",
    "error",
  );
}

function handleAudioDeviceChange() {
  if (recordingMicStream && !hasLiveMediaTracks(recordingMicStream)) {
    recordingSession.cancel();
    stopRecordingTracks();
    updateRecordingState({ state: "idle" });
    setStatus("The microphone device disconnected. The take was discarded safely.", "error");
    return;
  }
  if (audioContext) {
    audioDiagnostics.textContent = "Device list changed · check audio";
    setStatus("Audio devices changed. Check audio before the next performance.", "info");
  }
}

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error("Web Audio is not supported in this browser.");

    audioContext = new AudioContextClass();
    audioContext.addEventListener?.("statechange", handleAudioContextStateChange);
    masterGain = audioContext.createGain();
    recordingDestination = typeof audioContext.createMediaStreamDestination === "function"
      ? audioContext.createMediaStreamDestination()
      : undefined;
    masterGain.gain.value = Number(masterVolumeInput.value);
    let masterOutput = masterGain;
    if (typeof audioContext.createBiquadFilter === "function") {
      masterEqLow = audioContext.createBiquadFilter();
      masterEqMid = audioContext.createBiquadFilter();
      masterEqHigh = audioContext.createBiquadFilter();
      masterEqLow.type = "lowshelf";
      masterEqMid.type = "peaking";
      masterEqHigh.type = "highshelf";
      masterEqLow.frequency.value = 180;
      masterEqMid.frequency.value = 1000;
      masterEqMid.Q.value = 0.7;
      masterEqHigh.frequency.value = 5000;
      masterOutput.connect(masterEqLow);
      masterEqLow.connect(masterEqMid);
      masterEqMid.connect(masterEqHigh);
      masterOutput = masterEqHigh;
    }
    if (typeof audioContext.createDynamicsCompressor === "function") {
      masterCompressor = audioContext.createDynamicsCompressor();
      masterLimiter = audioContext.createDynamicsCompressor();
      masterOutput.connect(masterCompressor);
      masterCompressor.connect(masterLimiter);
      masterOutput = masterLimiter;
    }
    if (typeof audioContext.createAnalyser === "function") {
      masterAnalyser = audioContext.createAnalyser();
      masterAnalyser.fftSize = 256;
      masterOutput.connect(masterAnalyser);
      masterOutput = masterAnalyser;
    }
    masterOutput.connect(audioContext.destination);
    if (recordingDestination) masterOutput.connect(recordingDestination);
    delayNode = audioContext.createDelay(1);
    delayFeedbackGain = audioContext.createGain();
    delayReturnGain = audioContext.createGain();
    delayNode.connect(delayFeedbackGain);
    delayFeedbackGain.connect(delayNode);
    delayNode.connect(delayReturnGain);
    delayReturnGain.connect(masterGain);
    reverbNode = audioContext.createConvolver();
    reverbReturnGain = audioContext.createGain();
    reverbNode.buffer = createImpulseResponse(audioContext, masterEffects.reverbDecay);
    reverbNode.connect(reverbReturnGain);
    reverbReturnGain.connect(masterGain);
    configureMasterEffects();
  }

  return audioContext;
}

async function prepareAudio() {
  const context = getAudioContext();
  if (context.state === "closed") throw new Error("Audio is unavailable. Reload the page and try again.");
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      throw new Error("Audio is suspended. Interact with the page and try again.");
    }
  }
  if (context.state !== "running") throw new Error("Audio is unavailable in the current browser state.");
  syncMetronome();
  return context;
}

function configureMasterEffects() {
  if (!audioContext) return;
  masterEffects = normalizeMasterEffects(masterEffects);
  if (delayNode) delayNode.delayTime.setTargetAtTime(masterEffects.delayTime, audioContext.currentTime, 0.01);
  if (delayFeedbackGain) delayFeedbackGain.gain.setTargetAtTime(masterEffects.delayFeedback, audioContext.currentTime, 0.01);
  if (reverbNode) reverbNode.buffer = createImpulseResponse(audioContext, masterEffects.reverbDecay);
  if (masterEqLow) masterEqLow.gain.setTargetAtTime(masterEffects.eqLowDb, audioContext.currentTime, 0.01);
  if (masterEqMid) masterEqMid.gain.setTargetAtTime(masterEffects.eqMidDb, audioContext.currentTime, 0.01);
  if (masterEqHigh) masterEqHigh.gain.setTargetAtTime(masterEffects.eqHighDb, audioContext.currentTime, 0.01);
  if (masterCompressor) {
    masterCompressor.threshold.setTargetAtTime(masterEffects.compressorThreshold, audioContext.currentTime, 0.01);
    masterCompressor.ratio.setTargetAtTime(masterEffects.compressorRatio, audioContext.currentTime, 0.01);
    masterCompressor.attack.setTargetAtTime(0.003, audioContext.currentTime, 0.01);
    masterCompressor.release.setTargetAtTime(0.15, audioContext.currentTime, 0.01);
  }
  if (masterLimiter) {
    masterLimiter.threshold.setTargetAtTime(masterEffects.limiterThreshold, audioContext.currentTime, 0.01);
    masterLimiter.ratio.setTargetAtTime(20, audioContext.currentTime, 0.01);
    masterLimiter.attack.setTargetAtTime(0.001, audioContext.currentTime, 0.01);
    masterLimiter.release.setTargetAtTime(0.08, audioContext.currentTime, 0.01);
  }
  syncMasterEffectInputs();
  updateMasterEffectLabels();
}

function syncMasterEffectInputs() {
  if (!masterEqLowInput) return;
  masterEqLowInput.value = String(masterEffects.eqLowDb);
  masterEqMidInput.value = String(masterEffects.eqMidDb);
  masterEqHighInput.value = String(masterEffects.eqHighDb);
  compressorThresholdInput.value = String(masterEffects.compressorThreshold);
  compressorRatioInput.value = String(masterEffects.compressorRatio);
  limiterThresholdInput.value = String(masterEffects.limiterThreshold);
  delayTimeInput.value = String(masterEffects.delayTime);
  delayFeedbackInput.value = String(masterEffects.delayFeedback);
  reverbDecayInput.value = String(masterEffects.reverbDecay);
  updateMasterEffectLabels();
}

function readMasterEffectsFromInputs() {
  return normalizeMasterEffects({
    delayTime: delayTimeInput.value,
    delayFeedback: delayFeedbackInput.value,
    reverbDecay: reverbDecayInput.value,
    eqLowDb: masterEqLowInput.value,
    eqMidDb: masterEqMidInput.value,
    eqHighDb: masterEqHighInput.value,
    compressorThreshold: compressorThresholdInput.value,
    compressorRatio: compressorRatioInput.value,
    limiterThreshold: limiterThresholdInput.value,
  });
}

async function persistMasterEffects(message = "Master state saved locally.") {
  const kit = kits.get(currentKitId);
  if (!kit) return false;
  const nextKit = { ...kit, masterEffects: normalizeMasterEffects(masterEffects), updatedAt: new Date().toISOString() };
  if (!(await persistKitRecord(nextKit))) return false;
  setKitDirty(false);
  renderKitControls();
  setStatus(storageMode === "memory" ? `${message} Memory-only mode: a reload may discard changes.` : message, storageMode === "memory" ? "error" : "success");
  return true;
}

function renderMasterSnapshots() {
  if (!masterSnapshotSelect) return;
  const snapshots = kits.get(currentKitId)?.masterSnapshots || [];
  masterSnapshotSelect.replaceChildren();
  if (!snapshots.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No snapshots";
    masterSnapshotSelect.append(option);
  } else {
    for (const snapshot of snapshots) {
      const option = document.createElement("option");
      option.value = snapshot.id;
      option.textContent = snapshot.name;
      masterSnapshotSelect.append(option);
    }
  }
  recallMasterSnapshotButton.disabled = !snapshots.length;
}

async function saveMasterSnapshot() {
  const kit = kits.get(currentKitId);
  if (!kit) return;
  const name = window.prompt("Name this master snapshot", `Snapshot ${(kit.masterSnapshots?.length || 0) + 1}`);
  if (name === null) return;
  const safeName = name.trim().slice(0, 40) || `Snapshot ${(kit.masterSnapshots?.length || 0) + 1}`;
  const snapshots = [...(kit.masterSnapshots || [])];
  const snapshot = { id: makeId(), name: safeName, effects: normalizeMasterEffects(masterEffects) };
  if (snapshots.length >= 4) snapshots.shift();
  snapshots.push(snapshot);
  const nextKit = { ...kit, masterSnapshots: snapshots, updatedAt: new Date().toISOString() };
  if (!(await persistKitRecord(nextKit))) return;
  renderMasterSnapshots();
  masterSnapshotSelect.value = snapshot.id;
  setStatus(`${safeName} saved locally.`, "success");
}

async function recallMasterSnapshot() {
  const snapshot = (kits.get(currentKitId)?.masterSnapshots || []).find((candidate) => candidate.id === masterSnapshotSelect.value);
  if (!snapshot) return;
  masterEffects = normalizeMasterEffects(snapshot.effects);
  syncMasterEffectInputs();
  configureMasterEffects();
  await persistMasterEffects(`${snapshot.name} recalled.`);
}

function applyMasterMacro() {
  const warmth = clamp(Number(macroWarmthInput.value) || 0, 0, 1);
  const space = clamp(Number(macroSpaceInput.value) || 0, 0, 1);
  const punch = clamp(Number(macroPunchInput.value) || 0, 0, 1);
  masterEffects = normalizeMasterEffects({
    ...masterEffects,
    eqLowDb: (warmth - 0.5) * 12,
    eqHighDb: (0.5 - warmth) * 6,
    delayFeedback: space * 0.6,
    reverbDecay: 0.2 + space * 3.8,
    compressorThreshold: -30 + punch * 24,
    compressorRatio: 1 + punch * 11,
  });
  syncMasterEffectInputs();
  configureMasterEffects();
  setKitDirty(true);
}

function checkMasterLevels() {
  if (!masterAnalyser || !masterLevelStatus) {
    masterLevelStatus.textContent = "Start audio before checking levels.";
    return;
  }
  const data = new Float32Array(masterAnalyser.fftSize);
  masterAnalyser.getFloatTimeDomainData(data);
  const { peak, clipping } = detectPeak(data);
  masterLevelStatus.textContent = clipping ? `Clipping risk · peak ${Math.round(peak * 100)}%` : `Peak ${Math.round(peak * 100)}% · headroom available`;
  masterLevelStatus.dataset.type = clipping ? "warning" : "ready";
  setStatus(clipping ? "Master level is near clipping. Lower pad/master gain or increase compression." : "Master level check passed with headroom.", clipping ? "error" : "success");
}

function updateMasterEffectLabels() {
  const delayOutput = document.querySelector("output[for=delay-time]");
  const feedbackOutput = document.querySelector("output[for=delay-feedback]");
  const reverbOutput = document.querySelector("output[for=reverb-decay]");
  const formatDb = (value) => `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(1)} dB`;
  if (delayOutput) delayOutput.textContent = `${Math.round(Number(delayTimeInput.value) * 1000)} ms`;
  if (feedbackOutput) feedbackOutput.textContent = `${Math.round(Number(delayFeedbackInput.value) * 100)}%`;
  if (reverbOutput) reverbOutput.textContent = `${Number(reverbDecayInput.value).toFixed(1)} s`;
  const outputValues = {
    "master-eq-low": formatDb(masterEqLowInput.value),
    "master-eq-mid": formatDb(masterEqMidInput.value),
    "master-eq-high": formatDb(masterEqHighInput.value),
    "compressor-threshold": `${Number(compressorThresholdInput.value) > 0 ? "+" : "−"}${Math.abs(Number(compressorThresholdInput.value)).toFixed(0)} dB`,
    "compressor-ratio": `${Number(compressorRatioInput.value).toFixed(1)}:1`,
    "limiter-threshold": `${Number(limiterThresholdInput.value) > 0 ? "+" : "−"}${Math.abs(Number(limiterThresholdInput.value)).toFixed(1)} dB`,
  };
  for (const [id, value] of Object.entries(outputValues)) {
    const output = document.querySelector(`output[for="${id}"]`);
    if (output) output.textContent = value;
  }
}

async function showAudioDiagnostics() {
  try {
    const context = await prepareAudio();
    audioDiagnostics.textContent = describeAudioState(context.state, {
      sampleRate: context.sampleRate,
      baseLatency: context.baseLatency,
    });
    setStatus("Audio is ready for local playback and capture.", "success");
  } catch (error) {
    audioDiagnostics.textContent = "Audio unavailable";
    setStatus(error instanceof Error ? error.message : "Audio diagnostics failed.", "error");
  }
}

function getNextBeatTime(context) {
  return getNextPadTime(context, "beat");
}

function getNextPadTime(context, subdivision = "beat", { quantized = true } = {}) {
  const tempo = clamp(Number(tempoInput.value) || 120, 60, 200);
  return quantized && quantizeInput.checked
    ? getNextQuantizedTime(context.currentTime, { bpm: tempo, subdivision })
    : context.currentTime;
}

function playMetronomeClick(context, when, accent = false) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(accent ? 1400 : 900, when);
  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(accent ? 0.12 : 0.07, when + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(when);
  oscillator.stop(when + 0.05);
}

function syncMetronome() {
  if (metronomeTimer) window.clearInterval(metronomeTimer);
  metronomeTimer = undefined;
  if (!metronomeInput.checked || !audioContext) return;
  const beatDuration = 60 / clamp(Number(tempoInput.value) || 120, 60, 200);
  let beat = 0;
  metronomeTimer = window.setInterval(() => {
    if (audioContext?.state === "running") playMetronomeClick(audioContext, audioContext.currentTime + 0.01, beat++ % 4 === 0);
  }, beatDuration * 1000);
}

function runCountIn(context) {
  const bars = Number(countInInput.value) || 0;
  const beats = getCountInBeatCount(bars);
  if (!beats) return Promise.resolve();
  if (countInPromise) return countInPromise;
  const beatDuration = 60 / clamp(Number(tempoInput.value) || 120, 60, 200);
  const firstBeat = getNextQuantizedTime(context.currentTime, { bpm: Number(tempoInput.value) || 120, subdivision: "beat" });
  for (let index = 0; index < beats; index += 1) {
    const when = firstBeat + index * beatDuration;
    window.setTimeout(() => {
      if (audioContext?.state === "running") playMetronomeClick(context, when, index % 4 === 0);
    }, Math.max(0, (when - context.currentTime) * 1000));
  }
  setPlaybackStatus(`Count-in: ${bars} ${bars === 1 ? "bar" : "bars"}.`, "info", { force: true });
  countInPromise = new Promise((resolve) => {
    window.setTimeout(resolve, Math.max(0, (firstBeat + beats * beatDuration - context.currentTime) * 1000));
  }).finally(() => {
    countInPromise = undefined;
  });
  return countInPromise;
}

function getPadVoices(index) {
  return voiceRegistry.get(index);
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
  if (voice.startTimer) window.clearTimeout(voice.startTimer);
  if (voiceRegistry.remove(index, voice)) updatePadState(index);
}

function registerVoice(index, source, startAt, { isLoop = false, gainNode } = {}) {
  const startContextTime = audioContext?.currentTime || 0;
  const voice = {
    source,
    gainNode,
    startAt,
    isLoop,
    started: startAt <= startContextTime + 0.02,
    startTimer: undefined,
  };
  const { stolen } = voiceRegistry.add(index, voice);
  for (const victim of stolen) {
    if (victim.voice.startTimer) window.clearTimeout(victim.voice.startTimer);
    try {
      fadeAndStopVoice(victim.voice, startContextTime + 0.005);
    } catch {
      // A source may already have ended while the registry was enforcing limits.
    }
    updatePadState(victim.padIndex);
  }
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

function startRegisteredVoice(index, voice, startAt, stopAt) {
  try {
    voice.source.start(startAt);
    if (stopAt !== undefined) voice.source.stop(stopAt);
  } catch (error) {
    releaseVoice(index, voice);
    throw error;
  }
}

function fadeAndStopVoice(voice, stopAt = audioContext?.currentTime || 0) {
  const now = audioContext?.currentTime || 0;
  const endAt = Math.max(now + 0.005, Number(stopAt) || now + 0.005);
  const fadeStart = Math.max(now, endAt - 0.005);
  if (voice.gainNode?.gain) {
    const currentGain = Math.max(0.0001, Number(voice.gainNode.gain.value) || 0.0001);
    voice.gainNode.gain.cancelScheduledValues(now);
    voice.gainNode.gain.setValueAtTime(currentGain, now);
    voice.gainNode.gain.setValueAtTime(currentGain, fadeStart);
    voice.gainNode.gain.linearRampToValueAtTime(0.0001, endAt);
  }
  voice.source.stop(endAt);
}

function stopRepeat(index) {
  const timer = repeatTimers.get(index);
  if (timer !== undefined) window.clearInterval(timer);
  repeatTimers.delete(index);
}

function clearSequencerTimers() {
  for (const timer of sequencerTimers) window.clearTimeout(timer);
  sequencerTimers.clear();
}

function stopGroupPeers(index, groupKey) {
  for (const peerIndex of getGroupPeers(pads, index, groupKey)) stopPad(peerIndex, { quantized: false });
}

function stopPad(index, { quantized = false, announce = false } = {}) {
  stopRepeat(index);
  sendMidiForPad(index, "noteoff");
  const voices = activeVoices.get(index);
  if (!voices?.size || !audioContext) return false;

  const settings = normalizePerformanceSettings(pads[index]);
  const stopGrid = settings.stopQuantize === "off" && pads[index].mode === "loop" && quantizeInput.checked ? "beat" : settings.stopQuantize;
  const stopAt = quantized && stopGrid !== "off" ? getNextPadTime(audioContext, stopGrid) : audioContext.currentTime;
  for (const voice of voices) {
    try {
      fadeAndStopVoice(voice, stopAt);
    } catch {
      releaseVoice(index, voice);
    }
  }

  if (announce) {
    const pad = pads[index];
    const padName = getPadName(pad, index);
    if (stopAt > audioContext.currentTime + 0.02) {
      setStatus(`${padName} loop will stop on the next beat.`);
      showBeatCountdown(stopAt, `${padName} stops`);
    } else {
      clearBeatCountdown();
      setStatus(`${padName} stopped.`);
    }
  }
  return true;
}

function stopAll({ announce = true } = {}) {
  playbackGeneration += 1;
  clearBeatCountdown();
  clearSequencerTimers();
  if (sequencerRunner.running) {
    sequencerRunner.stop();
    stopMidiClockOutput();
    sequencerPlayButton.textContent = "Play sequence";
    renderSequencer();
  }
  for (const index of repeatTimers.keys()) stopRepeat(index);
  for (let index = 0; index < PAD_COUNT; index += 1) sendMidiForPad(index, "noteoff");
  for (const [index, voices] of activeVoices) {
    for (const voice of voices) {
      if (voice.startTimer) window.clearTimeout(voice.startTimer);
      try {
        fadeAndStopVoice(voice);
      } catch {
        releaseVoice(index, voice);
      }
    }
  }

  voiceRegistry.clear();
  pendingPads.clear();
  for (let index = 0; index < PAD_COUNT; index += 1) updatePadState(index);
  if (announce) {
    const tempo = clamp(Number(tempoInput.value) || 120, 60, 200);
    const quantizeState = quantizeInput.checked ? "on" : "off";
    setPlaybackStatus(`All pads stopped. Tempo ${tempo} BPM · Quantize ${quantizeState}.`, "info", { force: true });
  }
}

async function getSampleBuffer(sample, context) {
  if (sample.buffer) return sample.buffer;
  if (!sample.bufferPromise) {
    sample.bufferPromise = sample.blob.arrayBuffer()
      .then((arrayBuffer) => context.decodeAudioData(arrayBuffer.slice(0)))
      .then((buffer) => {
        const decodedBytes = buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
        if (!Number.isFinite(decodedBytes) || decodedBytes > MAX_DECODED_AUDIO_BYTES || !Number.isFinite(buffer.duration) || buffer.duration > MAX_DECODED_AUDIO_SECONDS) {
          throw new Error("This sample is too large to decode safely.");
        }
        sample.buffer = buffer;
        return buffer;
      })
      .catch((error) => {
        sample.bufferPromise = undefined;
        throw error;
      });
  }
  return sample.bufferPromise;
}

function createVoiceGain(context, pad, velocity = 1) {
  const gain = context.createGain();
  gain.gain.value = clamp((Number(pad.volume) || 0) * clamp(Number(velocity) || 1, 0, 1), 0, 1);
  if (typeof context.createBiquadFilter !== "function") {
    gain.connect(masterGain);
    return gain;
  }
  const filter = context.createBiquadFilter();
  filter.type = pad.filter?.type || "lowpass";
  filter.frequency.value = clamp(Number(pad.filter?.frequency) || 20000, 20, 20000);
  filter.Q.value = clamp(Number(pad.filter?.q) || 0.0001, 0.0001, 18);
  gain.connect(filter);
  let output = filter;
  if (typeof context.createStereoPanner === "function") {
    const panner = context.createStereoPanner();
    panner.pan.value = clamp(Number(pad.pan) || 0, -1, 1);
    filter.connect(panner);
    output = panner;
  }
  output.connect(masterGain);
  const sends = normalizeEffectSends(pad.effectSends);
  if (delayNode && sends.delay > 0) {
    const delaySend = context.createGain();
    delaySend.gain.value = sends.delay;
    output.connect(delaySend);
    delaySend.connect(delayNode);
  }
  if (reverbNode && sends.reverb > 0) {
    const reverbSend = context.createGain();
    reverbSend.gain.value = sends.reverb;
    output.connect(reverbSend);
    reverbSend.connect(reverbNode);
  }
  return gain;
}

function playPreviewTone(index, pad, context, velocity = 1) {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const frequency = 180 * Math.pow(2, (index % 8) / 8);

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, 0.3 * pad.volume * velocity), now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
  oscillator.connect(gain);
  gain.connect(masterGain);
  const voice = registerVoice(index, oscillator, now, { gainNode: gain });
  startRegisteredVoice(index, voice, now, now + 0.5);
  setPlaybackStatus(`${getPadName(pad, index)} preview tone triggered.`);
}

async function playSample(index, pad, sample, context, generation, velocity = 1) {
  const buffer = await getSampleBuffer(sample, context);
  if (generation !== playbackGeneration) return false;
  const source = context.createBufferSource();
  const gain = createVoiceGain(context, pad, velocity);
  const isLoop = pad.mode === "loop";
  const settings = normalizePerformanceSettings(pad);
  const launchGrid = settings.launchQuantize === "off" && isLoop && quantizeInput.checked ? "beat" : settings.launchQuantize;
  const startAt = launchGrid === "off" ? context.currentTime : getNextPadTime(context, launchGrid);
  const plan = createPlaybackPlan({
    duration: buffer.duration,
    region: pad.sampleRegion,
    timeStretch: pad.timeStretch,
    pitchCents: pad.pitchCents,
  });
  const playbackBuffer = plan.reverse ? (sample.reverseBuffer || (sample.reverseBuffer = createReversedBuffer(context, buffer))) : buffer;

  source.buffer = playbackBuffer || buffer;
  source.loop = isLoop;
  source.loopStart = plan.loopStart;
  source.loopEnd = plan.loopEnd;
  source.playbackRate.setValueAtTime(plan.playbackRate, startAt);
  source.detune.setValueAtTime(plan.detune, startAt);
  source.connect(gain);
  const voice = registerVoice(index, source, startAt, { isLoop, gainNode: gain });
  const attack = clamp(Number(pad.attack) || 0, 0, 1);
  gain.gain.cancelScheduledValues(startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(Math.max(0.0001, (Number(pad.volume) || 0.8) * clamp(Number(velocity) || 1, 0, 1)), startAt + attack);
  startRegisteredVoice(index, voice, startAt, isLoop ? undefined : startAt + plan.duration);

  if (isLoop && startAt > context.currentTime + 0.02) {
    setPlaybackStatus(`${getPadName(pad, index)} loop queued for the next beat.`, "info", { force: true });
    showBeatCountdown(startAt, `${getPadName(pad, index)} starts`);
  } else {
    setPlaybackStatus(`${getPadName(pad, index)} triggered.`);
  }
  return true;
}

async function triggerPad(index, { linked = false, bypassCountIn = false, fromRepeat = false, velocity = 1 } = {}) {
  if (pendingPads.has(index)) return;
  const pad = pads[index];
  const settings = normalizePerformanceSettings(pad);

  if (!linked && settings.linkGroup) {
    const linkedIndices = [index, ...getGroupPeers(pads, index, "linkGroup")];
    await Promise.all(linkedIndices.map((padIndex, linkedIndex) => triggerPad(padIndex, {
      linked: true,
      bypassCountIn: linkedIndex > 0 || bypassCountIn,
      fromRepeat,
      velocity,
    })));
    return;
  }

  if (!linked) {
    if (settings.chokeGroup) stopGroupPeers(index, "chokeGroup");
    if (settings.muteGroup) stopGroupPeers(index, "muteGroup");
  }

  if (!fromRepeat && settings.triggerMode === "repeat" && repeatTimers.has(index)) {
    stopPad(index, { quantized: true, announce: true });
    return;
  }
  const existingVoices = [...getPadVoices(index)].filter((voice) => voice.isLoop);

  if (pad.mode === "loop" && existingVoices.length) {
    stopPad(index, { quantized: true, announce: true });
    return;
  }

  if (pad.mode === "loop" && !pad.sampleId) {
    setStatus(`${getPadName(pad, index)} needs an audio sample before it can loop.`, "error");
    selectPad(index);
    return;
  }

  pendingPads.add(index);
  updatePadState(index);
  const generation = playbackGeneration;

  try {
    const context = await prepareAudio();
    if (generation !== playbackGeneration) return;
    if (!bypassCountIn && !fromRepeat && Number(countInInput.value) > 0) await runCountIn(context);
    if (generation !== playbackGeneration) return;
    const sample = pad.sampleId ? samples.get(pad.sampleId) : null;

    if (pad.sampleId && !sample) {
      setStatus(`${getPadName(pad, index)} is missing its saved sample. Choose a new file.`, "error");
      selectPad(index);
      return;
    }

    if (sample) {
      await playSample(index, pad, sample, context, generation, velocity);
    } else {
      playPreviewTone(index, pad, context, velocity);
    }
    sendMidiForPad(index, "noteon", velocity);
    if (!fromRepeat && settings.triggerMode === "repeat") {
      const interval = getRepeatIntervalMs(Number(tempoInput.value), "sixteenth");
      repeatTimers.set(index, window.setInterval(() => {
        if (!pendingPads.has(index)) void triggerPad(index, { linked: true, bypassCountIn: true, fromRepeat: true, velocity });
      }, interval));
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
  const pointerId = event.pointerId;
  const { shouldClearPressed } = pointerState.release(pointerId, index);
  if (shouldClearPressed) {
    button.classList.remove("is-pressed");
    inputAdapter.emit({ kind: "pointer", action: "release", padIndex: index, pointerId, timestamp: performance.now() });
  }
}

function renderPads() {
  clearPointerState();
  padGrid.replaceChildren();

  pads.forEach((pad, index) => {
    const button = document.createElement("button");
    button.className = "pad";
    button.type = "button";
    button.dataset.index = String(index);
    button.style.setProperty("--pad-color", pad.color);
    const performanceSettings = normalizePerformanceSettings(pad);
    button.setAttribute("aria-label", `${getPadName(pad, index)}, keyboard shortcut ${pad.key}, ${pad.mode === "loop" ? "loop" : "one-shot"}, ${performanceSettings.triggerMode} mode`);
    button.title = `${String(pad.id).padStart(2, "0")}${getVisiblePadLabel(pad, index) ? ` · ${getVisiblePadLabel(pad, index)}` : ""} · ${pad.key}`;

    const number = document.createElement("span");
    number.className = "pad-number";
    number.textContent = String(pad.id).padStart(2, "0");
    number.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "pad-label";
    label.textContent = getVisiblePadLabel(pad, index);
    const key = document.createElement("span");
    key.className = "pad-key";
    key.textContent = pad.key;
    button.append(number, label, key);
    if (pad.mode === "loop") {
      const mode = document.createElement("span");
      mode.className = "pad-mode";
      mode.textContent = "Loop";
      mode.setAttribute("aria-hidden", "true");
      button.append(mode);
    }

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (!pointerState.claim(event.pointerId, index)) return;
      button.classList.add("is-pressed");
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is not available in a few embedded browser contexts.
      }
      button.focus({ preventScroll: true });
      inputAdapter.emit({
        kind: "pointer",
        action: "trigger",
        padIndex: index,
        pointerId: event.pointerId,
        pressure: event.pressure,
        timestamp: performance.now(),
      });
    });
    button.addEventListener("pointerup", (event) => releasePadPointer(button, event));
    button.addEventListener("pointercancel", (event) => releasePadPointer(button, event));
    button.addEventListener("lostpointercapture", (event) => releasePadPointer(button, event));
    button.addEventListener("keydown", (event) => {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      inputAdapter.emit({ kind: "keyboard", action: "trigger", padIndex: index, timestamp: performance.now() });
    });
    button.addEventListener("keyup", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      inputAdapter.emit({ kind: "keyboard", action: "release", padIndex: index, timestamp: performance.now() });
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
  } else if (draftSampleId && samples.has(draftSampleId)) {
    sampleName.textContent = samples.get(draftSampleId).name;
  } else if (pad.sampleId && samples.has(pad.sampleId)) {
    sampleName.textContent = samples.get(pad.sampleId).name;
  } else if (pad.sampleId) {
    sampleName.textContent = "Missing sample";
  } else {
    sampleName.textContent = "Preview tone";
  }
}

let waveformBuffer;

function getSampleRegionFromEditor() {
  return normalizeSampleRegion({
    start: Number(sampleStartInput.value),
    end: Number(sampleEndInput.value),
    loopStart: Number(sampleLoopStartInput.value),
    loopEnd: Number(sampleLoopEndInput.value),
    reverse: sampleReverseInput.checked,
  });
}

function drawEmptyWaveform(message = "Load audio to see its waveform") {
  if (!sampleWaveform?.getContext) return;
  const context = sampleWaveform.getContext("2d");
  context.clearRect(0, 0, sampleWaveform.width, sampleWaveform.height);
  context.fillStyle = "#f3f4f8";
  context.fillRect(0, 0, sampleWaveform.width, sampleWaveform.height);
  context.fillStyle = "#7d8494";
  context.font = "12px system-ui";
  context.textAlign = "center";
  context.fillText(message, sampleWaveform.width / 2, sampleWaveform.height / 2 + 4);
}

function updateSampleEditorLabels() {
  pitchValue.textContent = `${Number(pitchInput.value) > 0 ? "+" : ""}${pitchInput.value}¢`;
  stretchValue.textContent = `${Number(stretchInput.value).toFixed(2)}× live`;
  panValue.textContent = Number(panInput.value) === 0 ? "Center" : Number(panInput.value) < 0 ? `${Math.abs(Number(panInput.value) * 100)}% L` : `${Number(panInput.value) * 100}% R`;
  filterFrequencyValue.textContent = `${Math.round(Number(filterFrequencyInput.value))} Hz`;
  attackValue.textContent = `${Math.round(Number(attackInput.value) * 1000)} ms`;
  releaseValue.textContent = `${Math.round(Number(releaseInput.value) * 1000)} ms`;
  padDelaySendValue.textContent = `${Math.round(Number(padDelaySendInput.value) * 100)}%`;
  padReverbSendValue.textContent = `${Math.round(Number(padReverbSendInput.value) * 100)}%`;
  const region = getSampleRegionFromEditor();
  sampleEditStatus.textContent = `Region ${Math.round(region.start * 100)}–${Math.round(region.end * 100)}% · loop ${Math.round(region.loopStart * 100)}–${Math.round(region.loopEnd * 100)}%`;
  if (waveformBuffer) drawWaveform(sampleWaveform, waveformBuffer, region);
}

function getSampleEditorValues() {
  const sample = getEditorSample();
  const slice = getSampleSlice(sample, draftSliceId);
  return {
    sampleRegion: getSampleRegionFromEditor(),
    sliceId: slice?.id || null,
    pitchCents: Number(pitchInput.value),
    timeStretch: Number(stretchInput.value),
    pan: Number(panInput.value),
    filter: {
      type: filterTypeInput.value,
      frequency: Number(filterFrequencyInput.value),
      q: 0.0001,
    },
    attack: Number(attackInput.value),
    release: Number(releaseInput.value),
    effectSends: {
      delay: Number(padDelaySendInput.value),
      reverb: Number(padReverbSendInput.value),
    },
  };
}

async function renderSampleEditor() {
  const pad = pads[selectedPadIndex];
  const region = normalizeSampleRegion(pad.sampleRegion);
  sampleStartInput.value = String(region.start);
  sampleEndInput.value = String(region.end);
  sampleLoopStartInput.value = String(region.loopStart);
  sampleLoopEndInput.value = String(region.loopEnd);
  sampleReverseInput.checked = region.reverse;
  pitchInput.value = String(pad.pitchCents);
  stretchInput.value = String(pad.timeStretch);
  panInput.value = String(pad.pan);
  filterTypeInput.value = pad.filter?.type || "lowpass";
  filterFrequencyInput.value = String(pad.filter?.frequency || 20000);
  attackInput.value = String(pad.attack);
  releaseInput.value = String(pad.release);
  padDelaySendInput.value = String(pad.effectSends?.delay || 0);
  padReverbSendInput.value = String(pad.effectSends?.reverb || 0);
  updateSampleEditorLabels();
  waveformBuffer = undefined;
  const sample = getEditorSample();
  renderSliceEditor(sample);
  if (!sample) {
    drawEmptyWaveform();
    return;
  }
  const renderToken = ++waveformRenderToken;
  try {
    const buffer = await getSampleBuffer(sample, getAudioContext());
    if (renderToken !== waveformRenderToken) return;
    waveformBuffer = buffer;
    drawWaveform(sampleWaveform, buffer, getSampleRegionFromEditor());
    sampleEditStatus.textContent = `${buffer.duration.toFixed(2)}s source · edit is saved with this pad`;
  } catch {
    if (renderToken === waveformRenderToken) drawEmptyWaveform("Waveform preview unavailable");
  }
}

function setEditorDirty(value) {
  editorDirty = value;
  editorDirtyIndicator.textContent = value ? "Unsaved changes" : kitDirty ? "Unsaved kit changes" : "Unsaved changes";
  editorDirtyIndicator.hidden = !(value || kitDirty);
  padEditor.classList.toggle("is-dirty", value);
  updateHistoryControls();
}

function markEditorDirty() {
  if (!editorDirty) setEditorDirty(true);
}

function selectPad(index) {
  selectedPadIndex = index;
  const pad = pads[index];
  selectedPadIndicator.textContent = String(pad.id).padStart(2, "0");
  padLabelInput.value = getVisiblePadLabel(pad, index);
  padKeyInput.value = pad.key;
  padModeInput.value = pad.mode;
  const performanceSettings = normalizePerformanceSettings(pad);
  triggerModeInput.value = performanceSettings.triggerMode;
  launchQuantizeInput.value = performanceSettings.launchQuantize;
  stopQuantizeInput.value = performanceSettings.stopQuantize;
  chokeGroupInput.value = performanceSettings.chokeGroup || "";
  muteGroupInput.value = performanceSettings.muteGroup || "";
  linkGroupInput.value = performanceSettings.linkGroup || "";
  updateLoopToggle();
  padVolumeInput.value = String(pad.volume);
  padVolumeValue.textContent = `${Math.round(pad.volume * 100)}%`;
  sampleFileInput.value = "";
  draftSampleCleared = false;
  draftSampleId = null;
  draftSliceId = pad.sliceId || null;
  setEditorDirty(false);
  updateSampleName();
  void renderSampleEditor();

  for (let padIndex = 0; padIndex < PAD_COUNT; padIndex += 1) updatePadState(padIndex);
}

function updateLoopToggle() {
  const isLoop = padModeInput.value === "loop";
  loopToggleButton.textContent = isLoop ? "Loop on" : "Loop off";
  loopToggleButton.setAttribute("aria-pressed", String(isLoop));
  loopToggleButton.classList.toggle("is-on", isLoop);
}

async function toggleSelectedPadLoop() {
  if (loopToggleButton.disabled) return;
  padModeInput.value = padModeInput.value === "loop" ? "oneshot" : "loop";
  updateLoopToggle();
  loopToggleButton.disabled = true;
  try {
    await saveSelectedPad(new Event("submit", { cancelable: true }));
  } finally {
    loopToggleButton.disabled = false;
  }
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

  if (!/^[A-Z0-9]$/.test(nextKey)) {
    setStatus("Choose a single letter or number shortcut.", "error");
    return;
  }
  if (duplicateKey) {
    setStatus(`${nextKey} is already assigned to another pad.`, "error");
    return;
  }

  try {
    const selectedFile = sampleFileInput.files?.[0];
    let sampleId = draftSampleCleared
      ? null
      : draftSampleId && samples.has(draftSampleId)
        ? draftSampleId
        : pads[selectedPadIndex].sampleId;
    let createdSample;
    const previousPads = clonePads();
    if (selectedFile) {
      const persistedSample = await persistSample(selectedFile);
      createdSample = persistedSample.created ? persistedSample.sample : undefined;
      sampleId = persistedSample.sample.id;
    }

    const previousPad = pads[selectedPadIndex];
    pads[selectedPadIndex] = {
      ...pads[selectedPadIndex],
      label: nextLabel,
      key: nextKey,
      mode: padModeInput.value === "loop" ? "loop" : "oneshot",
      volume: clamp(Number(padVolumeInput.value), 0, 1),
      sampleId,
      triggerMode: triggerModeInput.value,
      launchQuantize: launchQuantizeInput.value,
      stopQuantize: stopQuantizeInput.value,
      chokeGroup: chokeGroupInput.value.trim() || null,
      muteGroup: muteGroupInput.value.trim() || null,
      linkGroup: linkGroupInput.value.trim() || null,
      ...getSampleEditorValues(),
    };
    renderPads();
    selectPad(selectedPadIndex);
    if (!saveLayout(`${getPadName(pads[selectedPadIndex], selectedPadIndex)} updated and saved.`)) {
      pads[selectedPadIndex] = previousPad;
      if (createdSample) {
        samples.delete(createdSample.id);
        try {
          await deleteSample(createdSample.id);
        } catch {
          // A failed cleanup remains recoverable through sample-storage reset.
        }
        renderSampleLibrary();
      }
      renderPads();
      selectPad(selectedPadIndex);
      setStatus("Pad save failed; your existing layout was preserved.", "error");
      return;
    }
    const savedMessage = `${getPadName(pads[selectedPadIndex], selectedPadIndex)} updated and saved.`;

    const nextKit = {
      ...(kits.get(currentKitId) || createKitRecord(kitSlotNumber(currentKitId) || 1)),
      id: currentKitId,
      pads: clonePads(),
      empty: false,
      updatedAt: new Date().toISOString(),
    };
    if (!(await persistKitRecord(nextKit))) {
      pads = previousPads;
      if (createdSample) {
        samples.delete(createdSample.id);
        try {
          await deleteSample(createdSample.id);
        } catch {
          // A failed cleanup remains recoverable through sample-storage reset.
        }
        renderSampleLibrary();
      }
      renderPads();
      selectPad(selectedPadIndex);
      setKitDirty(true);
      saveLayout("Kit save failed; your existing layout was preserved.");
      setStatus("Kit save failed; your existing layout was preserved.", "error");
      return;
    }
    layoutHistory.push(previousPads);
    updateHistoryControls();
    setKitDirty(false);
    renderKitControls();
    setStatus(storageMode === "memory" ? `${savedMessage} Memory-only mode: a reload may discard changes.` : savedMessage, storageMode === "memory" ? "error" : "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The pad could not be saved.", "error");
  }
}

async function restorePadHistory(direction) {
  const currentPads = clonePads();
  const result = direction === "undo" ? layoutHistory.peekUndo(currentPads) : layoutHistory.peekRedo(currentPads);
  if (!result.changed) return;
  const previousPads = pads;
  pads = result.state;
  renderPads();
  selectPad(selectedPadIndex);
  const previousKit = kits.get(currentKitId) || createKitRecord(kitSlotNumber(currentKitId) || 1);
  const nextKit = {
    ...previousKit,
    id: currentKitId,
    pads: clonePads(),
    empty: false,
    updatedAt: new Date().toISOString(),
  };
  if (!saveLayout(direction === "undo" ? "Pad edit undone." : "Pad edit redone.") || !(await persistKitRecord(nextKit))) {
    pads = previousPads;
    renderPads();
    selectPad(selectedPadIndex);
    saveLayout("Pad history change failed; the previous layout was preserved.");
    setStatus("Pad history change failed; the previous layout was preserved.", "error");
    return;
  }
  if (direction === "undo") layoutHistory.undo(currentPads);
  else layoutHistory.redo(currentPads);
  setKitDirty(false);
  renderKitControls();
  updateHistoryControls();
  setStatus(direction === "undo" ? "Pad edit undone and saved." : "Pad edit redone and saved.", "success");
}

function clearSelectedSample() {
  stopPad(selectedPadIndex);
  draftSampleCleared = true;
  draftSampleId = null;
  draftSliceId = null;
  sampleFileInput.value = "";
  updateSampleName();
  renderSliceEditor(null);
  markEditorDirty();
  setStatus("Preview tone selected. Save the pad to apply it.");
}

function downloadText(filename, content, mimeType) {
  triggerTextDownload({ documentRef: document, windowRef: window }, filename, content, mimeType);
}

function exportLayout() {
  try {
    downloadText("launchpad-layout.json", `${JSON.stringify(serializeLayout(), null, 2)}\n`, "application/json");
    setStatus("Layout exported. Sample files remain local to this browser.", "success");
  } catch {
    setStatus("Layout export failed. Check browser download permissions and try again.", "error");
  }
}

function textByteLength(value) {
  return typeof TextEncoder === "function" ? new TextEncoder().encode(value).byteLength : new Blob([value]).size;
}

function toBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return globalThis.btoa(binary);
}

function fromBase64(value) {
  if (typeof value !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error("The launchpack contains invalid encoded audio.");
  }
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function isSafePackPath(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_PACK_PATH_LENGTH
    && !value.startsWith("/")
    && !value.includes("\\")
    && !/^[A-Za-z]:/.test(value)
    && !value.split("/").some((part) => !part || part === "." || part === "..")
    && !/[\u0000-\u001f]/.test(value);
}

function safePackFilename(name) {
  const basename = String(name || "sample").split(/[\\/]/).pop() || "sample";
  return basename.replace(/[\u0000-\u001f\\/]/g, "_").slice(0, 120) || "sample";
}

async function exportLaunchpack() {
  if (hasUnsavedKitChanges()) {
    setStatus("Save the current kit before exporting a .launchpack backup.", "error");
    return;
  }

  exportPackButton.disabled = true;
  try {
    const kitRecords = getKitRecords();
    const referencedIds = [...new Set(kitRecords.flatMap((kit) => kit.pads.map((pad) => pad.sampleId).filter(Boolean)))];
    const packSamples = [];

    for (const [index, sampleId] of referencedIds.entries()) {
      const sample = samples.get(sampleId);
      if (!isValidStoredSample(sample)) {
        throw new Error(`Kit audio is missing or corrupt for sample ${sampleId}. Repair storage before exporting.`);
      }
      const bytes = new Uint8Array(await sample.blob.arrayBuffer());
      const hash = sample.hash || await hashBlob(sample.blob);
      const path = `samples/${String(index + 1).padStart(3, "0")}-${safePackFilename(sample.name)}`;
      if (!isSafePackPath(path)) throw new Error("A sample filename is not safe to export.");
      packSamples.push({
        id: sample.id,
        path,
        name: safePackFilename(sample.name),
        mime: sample.mime,
        size: bytes.byteLength,
        hash,
        createdAt: sample.createdAt,
        slices: normalizeSliceDefinitions(sample.slices),
        data: toBase64(bytes),
      });
    }

    const pack = {
      schema: "touchscreen-launchpad.launchpack",
      version: 1,
      exportedAt: new Date().toISOString(),
      activeKitId: currentKitId,
      kits: kitRecords.map((kit) => ({
        id: kit.id,
        name: kit.name,
        empty: kit.empty,
        createdAt: kit.createdAt,
        updatedAt: kit.updatedAt,
        pads: clonePads(kit.pads),
        masterEffects: normalizeMasterEffects(kit.masterEffects),
        masterSnapshots: kit.masterSnapshots || [],
        midiConfig: normalizeMidiConfig(kit.midiConfig),
      })),
      samples: packSamples,
    };
    const content = `${JSON.stringify(pack)}\n`;
    if (textByteLength(content) > MAX_LAUNCHPACK_BYTES) {
      throw new Error("This .launchpack is too large to export safely.");
    }
    downloadText("launchpad-backup.launchpack", content, "application/vnd.touchscreen-launchpack+json");
    setStatus(`.launchpack exported with ${kitRecords.filter((kit) => !kit.empty).length} kits and ${packSamples.length} shared samples.`, "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : ".launchpack export failed. Check browser download permissions and try again.", "error");
  } finally {
    exportPackButton.disabled = false;
  }
}

function validateLaunchpack(parsedPack) {
  if (!parsedPack || typeof parsedPack !== "object" || parsedPack.schema !== "touchscreen-launchpad.launchpack" || parsedPack.version !== 1) {
    throw new Error("This .launchpack schema version is not supported.");
  }
  if (!Array.isArray(parsedPack.kits) || parsedPack.kits.length !== KIT_COUNT || !Array.isArray(parsedPack.samples)) {
    throw new Error("This .launchpack must contain five kits and a sample library.");
  }
  if (!kitSlotNumber(parsedPack.activeKitId)) throw new Error("This .launchpack has no valid active kit.");

  const kitIds = new Set();
  const importedKits = parsedPack.kits.map((candidate) => {
    const slot = kitSlotNumber(candidate?.id);
    if (!slot || kitIds.has(candidate.id)) throw new Error("This .launchpack contains duplicate or unsafe kit IDs.");
    kitIds.add(candidate.id);
    if (!Array.isArray(candidate.pads) || candidate.pads.length !== PAD_COUNT) throw new Error("This .launchpack contains an incomplete kit.");
    if (typeof candidate.name !== "string" || !candidate.name.trim() || candidate.name.length > MAX_KIT_NAME_LENGTH) throw new Error("This .launchpack contains an invalid kit name.");
    return normalizeKit(candidate, slot);
  });
  if (kitIds.size !== KIT_COUNT) throw new Error("This .launchpack must contain one record for each fixed kit slot.");

  if (parsedPack.samples.length > MAX_SAMPLE_COUNT) throw new Error("This .launchpack contains too many samples.");
  const sampleIds = new Set();
  const samplePaths = new Set();
  let totalBytes = 0;
  const importedSamples = parsedPack.samples.map((candidate) => {
    if (!candidate || typeof candidate !== "object" || typeof candidate.id !== "string" || candidate.id.length > MAX_SAMPLE_ID_LENGTH || sampleIds.has(candidate.id)) {
      throw new Error("This .launchpack contains duplicate or unsafe sample IDs.");
    }
    if (!isSafePackPath(candidate.path) || !candidate.path.startsWith("samples/") || samplePaths.has(candidate.path)) {
      throw new Error("This .launchpack contains an unsafe sample path.");
    }
    if (!isAudioFile({ name: candidate.name, type: candidate.mime }) || typeof candidate.name !== "string" || candidate.name.length > 120) {
      throw new Error("This .launchpack contains an unsupported sample.");
    }
    if (!Number.isSafeInteger(candidate.size) || candidate.size < 0 || candidate.size > MAX_SAMPLE_BYTES) {
      throw new Error("A sample in this .launchpack exceeds the per-file limit.");
    }
    if (typeof candidate.hash !== "string" || !/^[\da-f]{64}$/i.test(candidate.hash)) throw new Error("This .launchpack contains an invalid sample hash.");
    totalBytes += candidate.size;
    if (totalBytes > MAX_SAMPLE_STORAGE_BYTES) throw new Error("This .launchpack exceeds the 512 MB logical library limit.");
    const bytes = fromBase64(candidate.data);
    if (bytes.byteLength !== candidate.size) throw new Error("A sample in this .launchpack is truncated or has the wrong size.");
    sampleIds.add(candidate.id);
    samplePaths.add(candidate.path);
    return {
      id: candidate.id,
      path: candidate.path,
      name: safePackFilename(candidate.name),
      mime: candidate.mime,
      size: bytes.byteLength,
      hash: candidate.hash.toLowerCase(),
      blob: new Blob([bytes], { type: candidate.mime }),
      createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
      slices: normalizeSliceDefinitions(candidate.slices),
    };
  });

  const importedSampleIds = new Set(importedSamples.map((sample) => sample.id));
  for (const kit of importedKits) {
    for (const pad of kit.pads) {
      if (pad.sampleId && !importedSampleIds.has(pad.sampleId)) throw new Error("This .launchpack references audio that it does not contain.");
    }
  }
  return { importedKits, importedSamples, activeKitId: parsedPack.activeKitId };
}

async function importLaunchpack(file) {
  if (!confirmKitSwitch()) return;
  if (!Number.isFinite(file.size) || file.size > MAX_LAUNCHPACK_BYTES) throw new Error(".launchpack files must be smaller than 700 MB.");
  const parsedPack = JSON.parse(await file.text());
  const { importedKits, importedSamples, activeKitId } = validateLaunchpack(parsedPack);
  const remappedSamples = [];
  const updatedExistingSamples = [];
  const sampleIdRemap = new Map();

  for (const importedSample of importedSamples) {
    const actualHash = await hashBlob(importedSample.blob);
    if (actualHash !== importedSample.hash.toLowerCase()) throw new Error("A sample in this .launchpack failed its content-hash check.");
    const existing = await findSampleByHash(importedSample.hash);
    if (existing) {
      sampleIdRemap.set(importedSample.id, existing.id);
      if (importedSample.slices.length) {
        const updatedExisting = getPersistedSampleRecord({ ...existing, slices: importedSample.slices });
        updatedExistingSamples.push(updatedExisting);
        samples.set(existing.id, { ...existing, slices: importedSample.slices });
      }
      continue;
    }
    const nextSample = { ...importedSample, id: makeId() };
    delete nextSample.path;
    remappedSamples.push(nextSample);
    sampleIdRemap.set(importedSample.id, nextSample.id);
  }

  const newSampleBytes = remappedSamples.reduce((total, sample) => total + sample.size, 0);
  if (samples.size + remappedSamples.length > MAX_SAMPLE_COUNT) throw new Error("This .launchpack would exceed the 128-sample library limit.");
  if (getStoredSampleBytes() + newSampleBytes > MAX_SAMPLE_STORAGE_BYTES) throw new Error("This .launchpack would exceed the 512 MB logical library limit.");

  const remappedKits = importedKits.map((kit) => ({
    ...kit,
    pads: kit.pads.map((pad) => ({ ...pad, sampleId: pad.sampleId ? sampleIdRemap.get(pad.sampleId) || null : null })),
    updatedAt: new Date().toISOString(),
  }));
  await writeKitsAndSamples(remappedKits, [...remappedSamples, ...updatedExistingSamples]);
  for (const sample of remappedSamples) samples.set(sample.id, sample);
  kits = new Map(remappedKits.map((kit) => [kit.id, kit]));
  currentKitId = activeKitId;
  writeCurrentKitId();
  writeKitMirror();
  stopAll({ announce: false });
  applyKit(kits.get(currentKitId));
  renderSampleLibrary();
  renderKitControls();
  if (!saveLayout(".launchpack imported and saved.")) {
    setStatus(".launchpack imported into kit storage, but the legacy layout mirror could not be updated.", "error");
  } else {
    setStatus(`.launchpack imported: ${remappedKits.filter((kit) => !kit.empty).length} kits, ${remappedSamples.length} new samples.`, "success");
  }
}

function naturalCompare(left, right) {
  return new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare(left, right);
}

async function importSampleFiles(fileList) {
  const files = [...fileList];
  if (files.some((file) => !isSafePackPath(file.webkitRelativePath || file.name))) {
    throw new Error("The selected folder contains an unsafe file path.");
  }
  const audioFiles = files
    .filter(isAudioFile)
    .sort((left, right) => naturalCompare(left.webkitRelativePath || left.name, right.webkitRelativePath || right.name));
  if (!audioFiles.length) throw new Error("Choose one or more supported audio files.");
  if (audioFiles.length > MAX_SAMPLE_COUNT) throw new Error("Import packs can contain at most 128 audio files.");
  if (!confirmKitSwitch()) return;

  const previousPads = clonePads();
  const previousSamples = new Map(samples);
  const previousKit = kits.get(currentKitId);
  const createdSamples = [];
  try {
    const importedSamples = [];
    for (const file of audioFiles) {
      const persistedSample = await persistSample(file);
      importedSamples.push(persistedSample.sample);
      if (persistedSample.created) createdSamples.push(persistedSample.sample);
    }
    pads = pads.map((pad, index) => importedSamples[index] ? { ...pad, sampleId: importedSamples[index].id } : pad);
    renderPads();
    selectPad(0);
    setKitDirty(true);
    const message = `${importedSamples.length} audio files imported; first ${Math.min(PAD_COUNT, importedSamples.length)} mapped to pads.`;
    if (!saveLayout(message) || !(await persistKitRecord({
      ...(previousKit || createKitRecord(kitSlotNumber(currentKitId) || 1)),
      id: currentKitId,
      pads: clonePads(),
      empty: false,
      updatedAt: new Date().toISOString(),
    }))) throw new Error("Import could not be saved; existing kit preserved.");
    setKitDirty(false);
    renderKitControls();
    setStatus(`${message} Additional files remain in the shared library.`, "success");
  } catch (error) {
    try {
      await deleteSamples(createdSamples.map((sample) => sample.id));
    } catch {
      // Failed cleanup is recoverable through sample-storage reset.
    }
    samples = previousSamples;
    kits.set(currentKitId, previousKit);
    pads = previousPads;
    renderPads();
    selectPad(0);
    setKitDirty(false);
    renderSampleLibrary();
    setStatus(error instanceof Error ? error.message : "Audio import failed; existing kit preserved.", "error");
  }
}

async function importPack(event) {
  const files = [...(event.target.files || [])];
  event.target.value = "";
  if (!files.length) return;

  try {
    const launchpackFiles = files.filter((file) => /\.launchpack$/i.test(file.name));
    if (launchpackFiles.length) {
      if (files.length !== 1) throw new Error("Select either one .launchpack backup or a group of audio files.");
      await importLaunchpack(launchpackFiles[0]);
      return;
    }
    await importSampleFiles(files);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Pack import failed; existing kits were preserved.", "error");
  }
}

function validateImportedLayout(parsedLayout) {
  if (!parsedLayout || typeof parsedLayout !== "object" || ![1, 2].includes(parsedLayout.version)) {
    throw new Error("This layout version is not supported.");
  }
  if (!Array.isArray(parsedLayout.pads) || parsedLayout.pads.length !== PAD_COUNT) {
    throw new Error("This file is not a complete launchpad layout.");
  }

  const importedPads = normalizePads(parsedLayout.pads);
  const missingSampleIds = [...new Set(importedPads.map((pad) => pad.sampleId).filter(Boolean))]
    .filter((sampleId) => !samples.has(sampleId));
  return { importedPads, missingSampleIds };
}

async function importLayout(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    if (!Number.isFinite(file.size) || file.size > MAX_LAYOUT_BYTES) {
      throw new Error("Layout files must be smaller than 256 KB.");
    }
    const parsedLayout = JSON.parse(await file.text());
    const { importedPads, missingSampleIds } = validateImportedLayout(parsedLayout);
    const previousPads = pads;
    const previousKit = kits.get(currentKitId);
    stopAll({ announce: false });
    pads = importedPads;
    renderPads();
    selectPad(0);
    if (!saveLayout("Layout imported and saved.")) {
      pads = previousPads;
      renderPads();
      selectPad(0);
      setStatus("Layout import failed; your existing layout was preserved.", "error");
      return;
    }

    if (!(await persistKitRecord({
      ...(previousKit || createKitRecord(kitSlotNumber(currentKitId) || 1)),
      id: currentKitId,
      pads: clonePads(),
      empty: false,
      updatedAt: new Date().toISOString(),
    }))) {
      pads = previousPads;
      renderPads();
      selectPad(0);
      saveLayout("Layout import failed; your existing layout was preserved.");
      setStatus("Kit import failed; your existing layout was preserved.", "error");
      return;
    }
    setKitDirty(false);
    renderKitControls();

    if (missingSampleIds.length) {
      const sampleWord = missingSampleIds.length === 1 ? "sample is" : "samples are";
      setStatus(`Layout imported and saved. ${missingSampleIds.length} assigned ${sampleWord} missing in this browser.`, storageMode === "memory" ? "error" : "success");
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "The layout could not be imported.", "error");
  }
}

async function resetLayout() {
  if (!window.confirm("Reset all pad names, shortcuts, and assignments? Saved audio files will remain in this browser; samples are never uploaded.")) return;
  stopAll();
  pads = createDefaultPads();
  renderPads();
  selectPad(0);
  setKitDirty(true);
  await saveActiveKit("Pads reset to the starter layout.");
}

function isEditableTarget(target) {
  return target instanceof HTMLElement && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

async function togglePerformanceMode() {
  const isActive = document.body.classList.toggle("is-performance-mode");
  performanceModeButton.setAttribute("aria-pressed", String(isActive));
  performanceModeButton.textContent = isActive ? "Exit perform mode" : "Perform full screen";
  try {
    if (isActive && document.documentElement.requestFullscreen && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    if (!isActive && document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
  } catch {
    setStatus(isActive ? "Perform mode enabled. Full screen permission was not granted." : "Perform mode closed.", "info");
  }
}

function bindEvents() {
  stopAllButton.addEventListener("click", stopAll);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("blur", clearPointerState);
  window.addEventListener("pagehide", () => {
    clearPointerState();
    stopAll({ announce: false });
    if (recordingSession.state === "recording") recordingSession.cancel();
    stopRecordingTracks();
  });
  navigator.mediaDevices?.addEventListener?.("devicechange", handleAudioDeviceChange);
  window.addEventListener("orientationchange", clearPointerState);
  padEditor.addEventListener("submit", (event) => void saveSelectedPad(event));
  clearSampleButton.addEventListener("click", clearSelectedSample);
  padEditor.addEventListener("input", markEditorDirty);
  padEditor.addEventListener("change", markEditorDirty);
  sampleFileInput.addEventListener("change", () => {
    draftSampleCleared = false;
    draftSampleId = null;
    draftSliceId = null;
    updateSampleName();
    renderSliceEditor(null);
    markEditorDirty();
  });
  [sampleStartInput, sampleEndInput, sampleLoopStartInput, sampleLoopEndInput, sampleReverseInput, pitchInput, stretchInput, panInput, filterTypeInput, filterFrequencyInput, padDelaySendInput, padReverbSendInput, attackInput, releaseInput]
    .forEach((input) => input.addEventListener("input", updateSampleEditorLabels));
  [sampleStartInput, sampleEndInput, sampleLoopStartInput, sampleLoopEndInput, sampleReverseInput].forEach((input) => input.addEventListener("change", () => {
    draftSliceId = null;
    renderSliceEditor(getEditorSample());
  }));
  sliceCountInput.addEventListener("input", () => {
    sliceCountValue.textContent = `${sliceCountInput.value}/${MAX_SLICE_COUNT}`;
  });
  createSlicesButton.addEventListener("click", () => {
    const sample = getEditorSample();
    if (!sample) return;
    void persistSampleSlices(sample, createEvenSlices(sliceCountInput.value), `${sample.name} split into ${sliceCountInput.value} slices.`);
  });
  clearSlicesButton.addEventListener("click", () => {
    const sample = getEditorSample();
    if (!sample) return;
    void persistSampleSlices(sample, [], `${sample.name} slice markers cleared.`);
  });
  padVolumeInput.addEventListener("input", updatePadVolumeLabel);
  masterVolumeInput.addEventListener("input", updateMasterVolume);
  loopToggleButton.addEventListener("click", () => void toggleSelectedPadLoop());
  padModeInput.addEventListener("change", updateLoopToggle);
  tempoInput.addEventListener("input", updateTempoValue);
  tempoInput.addEventListener("change", () => {
    tempoInput.value = String(clamp(Number(tempoInput.value) || 120, 60, 200));
    updateTempoValue();
  });
  quantizeInput.addEventListener("change", () => {
    if (!quantizeInput.checked) clearBeatCountdown();
  });
  metronomeInput.addEventListener("change", () => {
    if (metronomeInput.checked) void prepareAudio().catch((error) => setStatus(error.message, "error"));
    else syncMetronome();
  });
  tempoInput.addEventListener("change", () => syncMetronome());
  recordButton.addEventListener("click", togglePerformanceRecording);
  recordPauseButton.addEventListener("click", toggleRecordingPause);
  performanceModeButton.addEventListener("click", () => void togglePerformanceMode());
  sceneAButton.addEventListener("click", () => setSequencerScene("scene-a"));
  sceneBButton.addEventListener("click", () => setSequencerScene("scene-b"));
  sequencerPlayButton.addEventListener("click", () => void toggleSequencer());
  exportMidiButton.addEventListener("click", exportSceneMidi);
  duplicateSceneButton.addEventListener("click", () => void duplicateSequencerScene());
  undoSceneButton.addEventListener("click", () => void restoreSequencerHistory("undo"));
  redoSceneButton.addEventListener("click", () => void restoreSequencerHistory("redo"));
  sequencerStepTrackInput.addEventListener("change", () => {
    selectedSequencerStep.trackIndex = clamp(Number(sequencerStepTrackInput.value) || 0, 0, 3);
    renderSequencer();
  });
  sequencerStepIndexInput.addEventListener("change", () => {
    selectedSequencerStep.stepIndex = clamp(Number(sequencerStepIndexInput.value) || 0, 0, 15);
    renderSequencer();
  });
  sequencerStepProbabilityInput.addEventListener("input", () => {
    sequencerStepProbabilityValue.textContent = `${Math.round(Number(sequencerStepProbabilityInput.value) * 100)}%`;
  });
  sequencerStepProbabilityInput.addEventListener("change", () => void updateSelectedSequencerStep({ probability: sequencerStepProbabilityInput.value }));
  sequencerStepMicroInput.addEventListener("input", () => {
    sequencerStepMicroValue.textContent = formatMicroTiming(sequencerStepMicroInput.value);
  });
  sequencerStepMicroInput.addEventListener("change", () => void updateSelectedSequencerStep({ microTiming: sequencerStepMicroInput.value }));
  document.querySelector("#sequencer-clear").addEventListener("click", () => void clearSequencer());
  sequencerSwingInput.addEventListener("input", () => {
    sequencerSwingValue.textContent = `${Math.round(Number(sequencerSwingInput.value) * 100)}%`;
  });
  sequencerSwingInput.addEventListener("change", () => {
    const next = getActiveSequencerPattern();
    next.swing = Number(sequencerSwingInput.value) || 0;
    void persistSequencerPattern(next, "Swing saved locally.");
  });
  midiConnectButton.addEventListener("click", () => void connectMidi());
  midiLearnButton.addEventListener("click", learnMidiForSelectedPad);
  midiLearnControllerButton.addEventListener("click", learnMidiController);
  midiCancelLearnButton.addEventListener("click", cancelMidiLearn);
  midiClearMappingsButton.addEventListener("click", () => {
    midiControllerLearnState.cancel();
    midiConfig = normalizeMidiConfig({ ...midiConfig, controllerMappings: [] });
    renderMidiMappings();
    void persistMidiConfig("MIDI controller mappings cleared.");
  });
  midiProfileNameInput.addEventListener("change", () => {
    midiConfig = normalizeMidiConfig({ ...midiConfig, profileName: midiProfileNameInput.value });
    void persistMidiConfig("MIDI profile saved locally.");
  });
  midiClockInInput.addEventListener("change", () => {
    midiConfig = normalizeMidiConfig({ ...midiConfig, clockIn: midiClockInInput.checked });
    if (!midiConfig.clockIn) midiClockTracker.stop();
    void persistMidiConfig("MIDI clock-in setting saved locally.");
  });
  midiClockOutInput.addEventListener("change", () => {
    midiConfig = normalizeMidiConfig({ ...midiConfig, clockOut: midiClockOutInput.checked });
    if (sequencerRunner.running) {
      if (midiConfig.clockOut) startMidiClockOutput();
      else stopMidiClockOutput();
    }
    void persistMidiConfig("MIDI clock-out setting saved locally.");
  });
  midiInputSelect.addEventListener("change", (event) => selectMidiInput(event.target.value));
  midiOutputSelect.addEventListener("change", (event) => selectMidiOutput(event.target.value));
  const masterEffectInputs = [delayTimeInput, delayFeedbackInput, reverbDecayInput, masterEqLowInput, masterEqMidInput, masterEqHighInput, compressorThresholdInput, compressorRatioInput, limiterThresholdInput];
  masterEffectInputs.forEach((input) => {
    input.addEventListener("input", () => {
      masterEffects = readMasterEffectsFromInputs();
      updateMasterEffectLabels();
      if (audioContext) configureMasterEffects();
      setKitDirty(true);
    });
    input.addEventListener("change", () => void persistMasterEffects());
  });
  [macroWarmthInput, macroSpaceInput, macroPunchInput].forEach((input) => {
    input.addEventListener("input", applyMasterMacro);
    input.addEventListener("change", () => void persistMasterEffects("Master macro state saved locally."));
  });
  saveMasterSnapshotButton.addEventListener("click", () => void saveMasterSnapshot());
  recallMasterSnapshotButton.addEventListener("click", () => void recallMasterSnapshot());
  masterLevelCheckButton.addEventListener("click", checkMasterLevels);
  audioDiagnosticsButton.addEventListener("click", () => void showAudioDiagnostics());
  document.addEventListener("fullscreenchange", () => {
    const isActive = document.body.classList.contains("is-performance-mode");
    if (!document.fullscreenElement && isActive) {
      document.body.classList.remove("is-performance-mode");
      performanceModeButton.setAttribute("aria-pressed", "false");
      performanceModeButton.textContent = "Perform full screen";
    }
  });
  saveLayoutButton.addEventListener("click", () => void saveActiveKit());
  undoPadButton.addEventListener("click", () => void restorePadHistory("undo"));
  redoPadButton.addEventListener("click", () => void restorePadHistory("redo"));
  exportLayoutButton.addEventListener("click", exportLayout);
  importLayoutInput.addEventListener("change", (event) => void importLayout(event));
  resetLayoutButton.addEventListener("click", () => void resetLayout());
  kitSelect.addEventListener("change", (event) => void switchKit(event.target.value));
  renameKitButton.addEventListener("click", () => void renameActiveKit());
  duplicateKitButton.addEventListener("click", () => void duplicateActiveKit());
  deleteKitButton.addEventListener("click", () => void deleteActiveKit());
  exportPackButton.addEventListener("click", () => void exportLaunchpack());
  importPackInput.addEventListener("change", (event) => void importPack(event));
  importLaunchpackInput.addEventListener("change", (event) => void importPack(event));
  repairStorageButton.addEventListener("click", () => void repairSampleStorage());
  resetStorageButton.addEventListener("click", () => void resetSampleStorage());
  sampleSearchInput.addEventListener("input", renderSampleLibrary);
  sampleSortInput.addEventListener("change", renderSampleLibrary);
  editorToggle.addEventListener("click", () => {
    const isCollapsed = editorPanel.classList.toggle("is-collapsed");
    editorToggle.setAttribute("aria-expanded", String(!isCollapsed));
    editorToggle.textContent = isCollapsed ? "Expand editor" : "Collapse editor";
  });
  editorNavLinks.forEach((link) => {
    link.addEventListener("click", () => {
      editorNavLinks.forEach((navLink) => navLink.classList.toggle("is-current", navLink === link));
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.repeat || isEditableTarget(event.target)) return;
    const padIndex = pads.findIndex((pad) => pad.key === event.key.toUpperCase());
    if (padIndex === -1) return;
    event.preventDefault();
    inputAdapter.emit({ kind: "keyboard", action: "trigger", padIndex, timestamp: performance.now() });
  });
  document.addEventListener("keyup", (event) => {
    if (isEditableTarget(event.target)) return;
    const padIndex = pads.findIndex((pad) => pad.key === event.key.toUpperCase());
    if (padIndex === -1) return;
    inputAdapter.emit({ kind: "keyboard", action: "release", padIndex, timestamp: performance.now() });
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
    const hadController = Boolean(navigator.serviceWorker.controller);
    const registration = await navigator.serviceWorker.register("./sw.js");
    const installingWorker = registration.installing;

    if (hadController) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        setStatus("Launchpad updated for offline use. Reloading…", "success");
        window.location.reload();
      }, { once: true });
    }
    if (installingWorker) {
      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && hadController) {
          setStatus("Offline update ready. Reloading…", "success");
        }
      });
    }
    if (registration.waiting && hadController) {
      setStatus("Offline update ready. Reload this tab to apply it.", "info");
    }
    if (storageState === "saved") updateConnectionStatus(`${getStorageStateLabel(storageState)} · Offline-ready`, "ready");
  } catch {
    if (storageState === "saved") updateConnectionStatus("Saved locally · Browser mode", "muted");
  }
}

export async function initLaunchpad() {
  currentKitId = readCurrentKitId();
  pads = readLayout();
  bindEvents();
  kits = createDefaultKitMap(pads);
  renderKitControls();
  renderPads();
  selectPad(0);
  updateMasterVolume();
  updateTempoValue();
  renderSampleLibrary();
  renderTakeLibrary();

  try {
    const [storedSamples, storedTakes] = await Promise.all([readSamples(), readTakes()]);
    takes = new Map(storedTakes.filter(isValidTakeRecord).sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, MAX_TAKE_COUNT).map((take) => {
      const normalized = normalizeTakeRecord(take);
      return [normalized.id, normalized];
    }));
    renderTakeLibrary();
    const { valid, corrupt } = partitionStoredSamples(storedSamples);
    const { accepted, excess } = limitStoredSamples(valid);
    samples = new Map(accepted.map((sample) => {
      const normalized = normalizeSampleRecord(sample);
      return [normalized.id, normalized];
    }));
    await initializeKitLibrary(pads);
    applyKit(kits.get(currentKitId));
    renderSampleLibrary();
    updateSampleName();
    if (corrupt.length || excess.length) {
      const issueCount = corrupt.length + excess.length;
      storageMode = "memory";
      setStorageState("corrupt", `${issueCount} saved sample${issueCount === 1 ? " is" : "s are"} invalid or exceed local limits. Export your layout, then repair or reset sample storage.`);
      setStatus("Some saved samples need repair.", "error");
    } else if (storageMode === "persistent") {
      setStorageState("saved");
    }
  } catch {
    kits = createDefaultKitMap(pads);
    renderKitControls();
    markMemoryOnlyMode("Sample storage is unavailable. Audio works, but sample files will not survive a reload.", "unavailable");
    setStatus("Audio works, but this browser cannot persist sample files.", "error");
  }

  await registerServiceWorker();
}
