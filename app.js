const PAD_COUNT = 16;
const KIT_COUNT = 5;
import { createPointerState } from "./src/pointer-state.js?version=21";
import { attachStorageRequest } from "./src/storage-request.js?version=21";
import { downloadText as triggerTextDownload } from "./src/download.js?version=21";

const LAYOUT_STORAGE_KEY = "touchscreen-launchpad.layout.v1";
const CURRENT_KIT_STORAGE_KEY = "touchscreen-launchpad.current-kit.v1";
const KITS_MIRROR_STORAGE_KEY = "touchscreen-launchpad.kits-mirror.v1";
const DATABASE_NAME = "touchscreen-launchpad";
const DATABASE_VERSION = 2;
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
let kits = new Map();
let currentKitId = "kit-1";
let selectedPadIndex = 0;
let audioContext;
let masterGain;
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
let playbackGeneration = 0;
let beatCountdownTimer;
let lastPlaybackStatusAt = 0;
const pointerState = createPointerState();

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
  const candidateSampleId = typeof candidate?.sampleId === "string" && candidate.sampleId.length <= MAX_SAMPLE_ID_LENGTH
    ? candidate.sampleId
    : null;

  return {
    id: index + 1,
    label: typeof candidate?.label === "string" && candidate.label.trim() ? candidate.label.trim().slice(0, 32) : fallback.label,
    key: /^[A-Z0-9]$/.test(candidateKey) ? candidateKey : fallback.key,
    color: candidateColor,
    mode: candidate?.mode === "loop" ? "loop" : "oneshot",
    volume: Number.isFinite(candidateVolume) ? clamp(candidateVolume, 0, 1) : fallback.volume,
    sampleId: candidateSampleId,
  };
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
  };
}

function normalizeKit(candidate, slot) {
  const fallback = createKitRecord(slot);
  const name = typeof candidate?.name === "string" && candidate.name.trim()
    ? candidate.name.trim().slice(0, MAX_KIT_NAME_LENGTH)
    : fallback.name;
  return {
    id: `kit-${slot}`,
    name,
    pads: normalizePads(candidate?.pads),
    empty: Boolean(candidate?.empty),
    createdAt: typeof candidate?.createdAt === "string" ? candidate.createdAt : fallback.createdAt,
    updatedAt: typeof candidate?.updatedAt === "string" ? candidate.updatedAt : fallback.updatedAt,
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

function applyKit(kit) {
  pads = kit?.empty ? createDefaultPads() : normalizePads(kit?.pads);
  setKitDirty(false);
  renderPads();
  selectPad(0);
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

  const sample = {
    id: makeId(),
    name: file.name,
    mime: file.type || "audio/*",
    size: file.size,
    blob: file,
    hash,
    createdAt: new Date().toISOString(),
  };

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
    samples = new Map(accepted.map((sample) => [sample.id, sample]));
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
  if (context.state === "closed") throw new Error("Audio is unavailable. Reload the page and try again.");
  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch {
      throw new Error("Audio is suspended. Interact with the page and try again.");
    }
  }
  if (context.state !== "running") throw new Error("Audio is unavailable in the current browser state.");
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

function startRegisteredVoice(index, voice, startAt, stopAt) {
  try {
    voice.source.start(startAt);
    if (stopAt !== undefined) voice.source.stop(stopAt);
  } catch (error) {
    releaseVoice(index, voice);
    throw error;
  }
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

function stopAll({ announce = true } = {}) {
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
  const voice = registerVoice(index, oscillator, now);
  startRegisteredVoice(index, voice, now, now + 0.5);
  setPlaybackStatus(`${pad.label} preview tone triggered.`);
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
  const voice = registerVoice(index, source, startAt, { isLoop });
  startRegisteredVoice(index, voice, startAt);

  if (isLoop && startAt > context.currentTime + 0.02) {
    setPlaybackStatus(`${pad.label} loop queued for the next beat.`, "info", { force: true });
    showBeatCountdown(startAt, `${pad.label} starts`);
  } else {
    setPlaybackStatus(`${pad.label} triggered.`);
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
  const pointerId = event.pointerId;
  const { shouldClearPressed } = pointerState.release(pointerId, index);
  if (shouldClearPressed) button.classList.remove("is-pressed");
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
      if (!pointerState.claim(event.pointerId, index)) return;
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
  editorDirtyIndicator.textContent = value ? "Unsaved changes" : kitDirty ? "Unsaved kit changes" : "Unsaved changes";
  editorDirtyIndicator.hidden = !(value || kitDirty);
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
    };
    renderPads();
    selectPad(selectedPadIndex);
    if (!saveLayout(`${pads[selectedPadIndex].label} updated and saved.`)) {
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
    const savedMessage = `${pads[selectedPadIndex].label} updated and saved.`;

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
    setKitDirty(false);
    renderKitControls();
    setStatus(storageMode === "memory" ? `${savedMessage} Memory-only mode: a reload may discard changes.` : savedMessage, storageMode === "memory" ? "error" : "success");
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
  const sampleIdRemap = new Map();

  for (const importedSample of importedSamples) {
    const actualHash = await hashBlob(importedSample.blob);
    if (actualHash !== importedSample.hash.toLowerCase()) throw new Error("A sample in this .launchpack failed its content-hash check.");
    const existing = await findSampleByHash(importedSample.hash);
    if (existing) {
      sampleIdRemap.set(importedSample.id, existing.id);
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
  await writeKitsAndSamples(remappedKits, remappedSamples);
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
  if (!parsedLayout || typeof parsedLayout !== "object" || parsedLayout.version !== 1) {
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

function bindEvents() {
  stopAllButton.addEventListener("click", stopAll);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("blur", clearPointerState);
  window.addEventListener("pagehide", () => {
    clearPointerState();
    stopAll({ announce: false });
  });
  window.addEventListener("orientationchange", clearPointerState);
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
  saveLayoutButton.addEventListener("click", () => void saveActiveKit());
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

  try {
    const { valid, corrupt } = partitionStoredSamples(await readSamples());
    const { accepted, excess } = limitStoredSamples(valid);
    samples = new Map(accepted.map((sample) => [sample.id, sample]));
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
