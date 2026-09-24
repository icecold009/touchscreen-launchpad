import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createArrangement, normalizeArrangement } from "../src/arrangement.js";
import { normalizeMasterEffects } from "../src/effects.js";
import { createDefaultPad, normalizeKitRecord, normalizePadDefinition } from "../src/migrations.js";
import { normalizeMidiConfig } from "../src/midi.js";
import { attachStorageRequest } from "../src/storage-request.js";
import { storageContract } from "./fixtures/storage-contract.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const localSource = section("function readCurrentKitId() {", "function openDatabase() {");
const indexedDbSource = section("function openDatabase() {", "async function initializeKitLibrary(legacyPads) {");
const kitInitializationSource = section("async function initializeKitLibrary(legacyPads) {", "function getKitRecords() {");
const resetSource = section("function deleteSampleDatabase() {", "function renderSampleTagFilter(allSamples) {");
const padFactorySource = section("function createDefaultPads() {", "function clonePads(sourcePads = pads) {");
const kitFactorySource = section("function createKitRecord(slot, kitPads", "function createDefaultKitMap(legacyPads = createDefaultPads()) {");
const kitMapSource = section("function createDefaultKitMap(legacyPads = createDefaultPads()) {", "function setKitDirty(value) {");
const kitRecordsSource = section("function getKitRecords() {", "function renderKitControls() {");
const launchpackImportSource = section("async function importLaunchpack(file) {", "function naturalCompare(left, right) {");

function section(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return app.slice(start, end);
}

function clone(value) {
  return structuredClone(value);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

class MemoryStorage {
  constructor(entries = []) {
    this.values = new Map(entries);
    this.failGet = false;
    this.failSet = false;
    this.failRemove = false;
  }

  getItem(key) {
    if (this.failGet) throw new Error("Storage unavailable");
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (this.failSet) {
      const error = new Error("Storage full");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.values.set(key, String(value));
  }

  removeItem(key) {
    if (this.failRemove) throw new Error("Storage unavailable");
    this.values.delete(key);
  }
}

class FakeRequest extends EventTarget {
  result = undefined;
  error = null;

  succeed(result) {
    this.result = result;
    this.dispatchEvent(new Event("success"));
  }

  fail(error) {
    this.error = error;
    this.dispatchEvent(new Event("error"));
  }
}

class FakeStore {
  constructor(transaction, name) {
    this.transaction = transaction;
    this.name = name;
  }

  put(record) {
    return this.transaction.enqueue(() => {
      this.transaction.records(this.name).set(record.id, clone(record));
      return record.id;
    });
  }

  delete(id) {
    return this.transaction.enqueue(() => this.transaction.records(this.name).delete(id));
  }

  get(id) {
    return this.transaction.enqueue(() => clone(this.transaction.records(this.name).get(id)));
  }

  getAll() {
    return this.transaction.enqueue(() => [...this.transaction.records(this.name).values()].map(clone));
  }
}

class FakeTransaction extends EventTarget {
  constructor(database, storeNames, mode, behavior) {
    super();
    this.database = database;
    this.storeNames = storeNames;
    this.mode = mode;
    this.behavior = behavior;
    this.error = null;
    this.requests = [];
    this.operations = [];
    this.active = true;
    this.finished = false;
    this.waitingToComplete = false;
    this.snapshot = new Map();
    for (const name of storeNames) {
      const source = database.stores.get(name);
      this.snapshot.set(name, mode === "readwrite" ? new Map([...source].map(([key, value]) => [key, clone(value)])) : source);
    }
    queueMicrotask(() => this.pump());
  }

  objectStore(name) {
    if (!this.snapshot.has(name)) throw new Error(`Store not in transaction: ${name}`);
    return new FakeStore(this, name);
  }

  records(name) {
    return this.snapshot.get(name);
  }

  enqueue(operation) {
    const request = new FakeRequest();
    this.requests.push(request);
    this.operations.push({ operation, request });
    return request;
  }

  pump() {
    if (!this.active) return;
    for (let index = 0; index < this.operations.length; index += 1) {
      const { operation, request } = this.operations[index];
      if (this.behavior.failAt === index) {
        const error = new Error("Synthetic request failure");
        request.fail(error);
        this.dispatchEvent(new Event("error"));
        this.abort(error);
        return;
      }
      request.succeed(operation());
      if (this.behavior.abortAfterRequestSuccess) {
        this.abort(new Error("Synthetic late transaction abort"));
        return;
      }
      if (!this.active) return;
    }
    if (this.behavior.holdCompletion) {
      this.waitingToComplete = true;
      return;
    }
    this.complete();
  }

  complete() {
    if (!this.active || this.finished) return;
    if (this.mode === "readwrite") {
      for (const name of this.storeNames) this.database.stores.set(name, this.snapshot.get(name));
    }
    this.active = false;
    this.finished = true;
    this.dispatchEvent(new Event("complete"));
  }

  abort(error = new Error("Synthetic transaction abort")) {
    if (!this.active || this.finished) return;
    this.error = error;
    this.active = false;
    this.finished = true;
    this.dispatchEvent(new Event("abort"));
  }
}

class FakeDatabase extends EventTarget {
  constructor({ version = 0, stores = [] } = {}) {
    super();
    this.version = version;
    this.stores = new Map();
    this.definitions = new Map();
    this.transactions = [];
    this.closed = false;
    for (const name of stores) this.createObjectStore(name, { keyPath: "id" });
  }

  get objectStoreNames() {
    return { contains: (name) => this.stores.has(name) };
  }

  createObjectStore(name, options) {
    this.stores.set(name, new Map());
    this.definitions.set(name, { keyPath: options.keyPath, indexes: [] });
    return {};
  }

  transaction(names, mode) {
    const storeNames = Array.isArray(names) ? names : [names];
    const behavior = this.nextTransactionBehavior || {};
    this.nextTransactionBehavior = {};
    const transaction = new FakeTransaction(this, storeNames, mode, behavior);
    this.transactions.push(transaction);
    return transaction;
  }

  close() {
    this.closed = true;
  }
}

class FakeIndexedDB {
  constructor(database = null) {
    this.database = database;
    this.openBehavior = {};
    this.deleteBehavior = {};
  }

  open(name, version) {
    this.lastOpen = { name, version };
    const request = new FakeRequest();
    queueMicrotask(() => {
      if (this.openBehavior.blocked) {
        request.dispatchEvent(new Event("blocked"));
        return;
      }
      if (this.openBehavior.error) {
        request.fail(new Error("Synthetic open failure"));
        return;
      }
      const isNew = !this.database;
      if (isNew) this.database = new FakeDatabase();
      const needsUpgrade = isNew || this.database.version < version;
      this.database.version = Math.max(this.database.version, version);
      request.result = this.database;
      if (needsUpgrade) request.dispatchEvent(new Event("upgradeneeded"));
      request.succeed(this.database);
    });
    return request;
  }

  deleteDatabase(name) {
    this.lastDelete = name;
    const request = new FakeRequest();
    queueMicrotask(() => {
      if (this.deleteBehavior.blocked) {
        request.dispatchEvent(new Event("blocked"));
        return;
      }
      if (this.deleteBehavior.error) {
        request.fail(new Error("Synthetic delete failure"));
        return;
      }
      this.database = null;
      request.succeed(undefined);
    });
    return request;
  }
}

function makeContext({ storage = new MemoryStorage(), indexedDB = new FakeIndexedDB(), confirm = () => true } = {}) {
  const defaults = clone(storageContract.layout.pads);
  const context = vm.createContext({
    DATABASE_NAME: storageContract.database.name,
    DATABASE_VERSION: storageContract.database.version,
    LAYOUT_STORAGE_KEY: storageContract.localStorageKeys.layout,
    CURRENT_KIT_STORAGE_KEY: storageContract.localStorageKeys.currentKit,
    KITS_MIRROR_STORAGE_KEY: storageContract.localStorageKeys.kitMirror,
    KIT_COUNT: storageContract.limits.fixedKitSlots,
    PAD_COUNT: defaults.length,
    MAX_KIT_NAME_LENGTH: 40,
    MAX_LAUNCHPACK_BYTES: 700 * 1024 * 1024,
    MAX_SAMPLE_COUNT: 128,
    MAX_SAMPLE_STORAGE_BYTES: 512 * 1024 * 1024,
    padColors: ["#262626", "#2e2e2e", "#363636", "#3e3e3e", "#464646", "#4e4e4e", "#565656", "#5e5e5e", "#666666", "#6e6e6e", "#767676", "#7e7e7e", "#868686", "#8e8e8e", "#969696", "#9e9e9e"],
    keyboardKeys: ["Q", "W", "E", "R", "A", "S", "D", "F", "Z", "X", "C", "V", "1", "2", "3", "4"],
    localStorage: storage,
    indexedDB,
    window: { indexedDB, confirm },
    storageMode: "persistent",
    storageState: "saved",
    sampleDatabase: undefined,
    databasePromise: undefined,
    currentKitId: "kit-1",
    pads: clone(defaults),
    kits: new Map(),
    samples: new Map([["synthetic-sample", { id: "synthetic-sample" }]]),
    takes: new Map([["synthetic-take", { id: "synthetic-take" }]]),
    resetStorageButton: { disabled: false },
    repairStorageButton: { hidden: true },
    persistenceMessage: { textContent: "" },
    persistenceNote: { hidden: true },
    connectionStatus: { textContent: "", dataset: {} },
    statusMessage: { textContent: "", dataset: {} },
    renderPads() {},
    renderSampleLibrary() {},
    renderTakeLibrary() {},
    selectPad() {},
    stopAll() {},
    setStatus(message, type) { context.lastStatus = { message, type }; },
    updateConnectionStatus() {},
    setStorageState(state, message = "") { context.storageState = state; context.storageMessage = message; },
    markMemoryOnlyMode(message, state = "memory-only") {
      context.storageMode = "memory";
      context.setStorageState(state, message);
    },
    createDefaultPad,
    createArrangement,
    normalizeArrangement,
    normalizePadDefinition,
    normalizeKitRecord,
    normalizeMasterEffects,
    normalizeMidiConfig,
    kitSlotNumber: (id) => /^kit-([1-5])$/.test(id || "") ? Number(id.slice(4)) : 0,
    defaultKitName: (slot) => `Kit ${slot}`,
    normalizeSampleRecord: (record) => clone(record),
    isValidTakeRecord: () => true,
    confirmKitSwitch: () => true,
    validateLaunchpack: () => ({ importedKits: [], importedSamples: [], activeKitId: "kit-1" }),
    hashBlob: async () => "synthetic-hash",
    findSampleByHash: async () => null,
    getPersistedSampleRecord: (record) => clone(record),
    makeId: () => "synthetic-imported-sample",
    getStoredSampleBytes: () => 0,
    stopAll() {},
    applyKit() {},
    saveLayout: () => true,
    attachStorageRequest,
  });
  vm.runInContext(padFactorySource, context);
  vm.runInContext(kitFactorySource, context);
  vm.runInContext(kitMapSource, context);
  vm.runInContext(kitRecordsSource, context);
  vm.runInContext(localSource, context);
  vm.runInContext(indexedDbSource, context);
  vm.runInContext(kitInitializationSource, context);
  vm.runInContext(resetSource, context);
  vm.runInContext(launchpackImportSource, context);
  return context;
}

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("the frozen local keys, database v3 schema, five slots, and layout cap match current source", () => {
  for (const key of Object.values(storageContract.localStorageKeys)) assert.ok(app.includes(`"${key}"`));
  assert.match(app, /const DATABASE_NAME = "touchscreen-launchpad";/);
  assert.match(app, /const DATABASE_VERSION = 3;/);
  assert.match(app, /const KIT_COUNT = 5;/);
  assert.match(app, /const MAX_LAYOUT_BYTES = 256 \* 1024;/);
  for (const { storeName, keyPath } of storageContract.database.stores) {
    assert.match(app, new RegExp(`createObjectStore\\("${storeName}", \\{ keyPath: "${keyPath}" \\}\\)`));
  }
  assert.equal(storageContract.database.stores.length, 4);
  assert.equal(storageContract.layout.pads.length, 16);
  assert.deepEqual(Object.keys(storageContract.layout), ["version", "updatedAt", "pads"]);
});

test("layout serialization round trips the existing version-2 shape", () => {
  const storage = new MemoryStorage();
  const context = makeContext({ storage });
  context.pads = clone(storageContract.layout.pads);
  const serialized = JSON.parse(vm.runInContext("JSON.stringify(serializeLayout())", context));
  assert.equal(serialized.version, 2);
  assert.match(serialized.updatedAt, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(serialized.pads, storageContract.layout.pads);
  storage.setItem(storageContract.localStorageKeys.layout, JSON.stringify(serialized));
  assert.deepEqual(plain(context.readLayout()), storageContract.normalizedPads);
});

test("missing layout uses default pads without changing storage mode", () => {
  const context = makeContext();
  assert.deepEqual(plain(context.readLayout()), storageContract.layout.pads);
  assert.equal(context.storageMode, "persistent");
  assert.equal(context.storageState, "saved");
});

test("malformed layout falls back to defaults and reports unavailable memory-only storage", () => {
  const storage = new MemoryStorage([[storageContract.localStorageKeys.layout, "{" ]]);
  const context = makeContext({ storage });
  assert.deepEqual(plain(context.readLayout()), storageContract.layout.pads);
  assert.equal(context.storageMode, "memory");
  assert.equal(context.storageState, "unavailable");
  assert.match(context.persistenceMessage.textContent, /Layout storage is unavailable/);
});

test("unavailable localStorage falls back without claiming a persisted layout", () => {
  const storage = new MemoryStorage();
  storage.failGet = true;
  const context = makeContext({ storage });
  assert.deepEqual(plain(context.readLayout()), storageContract.layout.pads);
  assert.equal(context.storageMode, "memory");
  storage.failGet = false;
  storage.failSet = true;
  context.storageMode = "memory";
  context.pads = clone(storageContract.layout.pads);
  assert.equal(context.saveLayout("Synthetic save"), false);
  assert.equal(context.statusMessage.dataset.type, "error");
  assert.match(context.persistenceMessage.textContent, /Layout storage is full/);
});

test("current kit storage preserves valid ids and defaults missing or invalid ids to kit-1", () => {
  const storage = new MemoryStorage([[storageContract.localStorageKeys.currentKit, storageContract.currentKitId]]);
  const context = makeContext({ storage });
  assert.equal(context.readCurrentKitId(), "kit-2");
  context.currentKitId = "kit-5";
  context.writeCurrentKitId();
  assert.equal(storage.getItem(storageContract.localStorageKeys.currentKit), "kit-5");
  storage.setItem(storageContract.localStorageKeys.currentKit, "not-a-kit");
  assert.equal(context.readCurrentKitId(), "kit-1");
  storage.values.delete(storageContract.localStorageKeys.currentKit);
  assert.equal(context.readCurrentKitId(), "kit-1");
  storage.failGet = true;
  assert.equal(context.readCurrentKitId(), "kit-1");
  storage.failGet = false;
  storage.failSet = true;
  context.currentKitId = "kit-3";
  assert.doesNotThrow(() => context.writeCurrentKitId());
});

test("kit mirror missing, malformed, and non-array values fall back to an empty list", () => {
  const storage = new MemoryStorage();
  const context = makeContext({ storage });
  assert.deepEqual(clone(context.readKitMirror()), []);
  for (const value of ["{", "{}", "null", '"not-an-array"']) {
    storage.setItem(storageContract.localStorageKeys.kitMirror, value);
    assert.deepEqual(clone(context.readKitMirror()), []);
  }
});

test("kit mirror writes the current serialized kit records and tolerates storage failure", () => {
  const storage = new MemoryStorage();
  const context = makeContext({ storage });
  context.kits = context.createDefaultKitMap();
  context.writeKitMirror();
  const written = JSON.parse(storage.getItem(storageContract.localStorageKeys.kitMirror));
  assert.equal(written.length, storageContract.limits.fixedKitSlots);
  assert.equal(written[1].id, storageContract.kit.id);
  storage.failSet = true;
  assert.doesNotThrow(() => context.writeKitMirror());
});

test("the 256 KiB limit belongs to imported layout files, not stored local settings", () => {
  const context = makeContext({ storage: new MemoryStorage([[storageContract.localStorageKeys.layout,
    JSON.stringify({ ...clone(storageContract.layout), padding: "x".repeat(storageContract.limits.maxLayoutBytes) })]]) });
  assert.ok(Buffer.byteLength(context.localStorage.getItem(storageContract.localStorageKeys.layout)) > storageContract.limits.maxLayoutBytes);
  assert.deepEqual(plain(context.readLayout()), storageContract.normalizedPads);
  assert.match(app, /if \(!Number\.isFinite\(file\.size\) \|\| file\.size > MAX_LAYOUT_BYTES\)/);
  assert.equal(storageContract.limits.oversizedStoredLayout, "read as existing localStorage value; cap is import-file policy");
});

test("an empty database upgrades to the exact four v3 stores without indexes", async () => {
  const idb = new FakeIndexedDB();
  const context = makeContext({ indexedDB: idb });
  const database = await context.openDatabase();
  assert.deepEqual(idb.lastOpen, { name: storageContract.database.name, version: storageContract.database.version });
  assert.deepEqual([...database.definitions].map(([storeName, schema]) => ({ storeName, ...schema })), storageContract.database.stores);
});

test("an existing v3 database is reused without replacing stores or records", async () => {
  const database = new FakeDatabase({ version: 3, stores: storageContract.database.stores.map(({ storeName }) => storeName) });
  database.stores.get("samples").set("sample-1", { id: "sample-1", blob: "synthetic" });
  const idb = new FakeIndexedDB(database);
  const context = makeContext({ indexedDB: idb });
  assert.equal(await context.openDatabase(), database);
  assert.deepEqual([...database.stores.get("samples").values()], [{ id: "sample-1", blob: "synthetic" }]);
  assert.equal(database.definitions.size, 4);
  database.dispatchEvent(new Event("versionchange"));
  assert.equal(database.closed, true);
});

test("read operations return missing and corrupt records unchanged for app policy", async () => {
  const database = new FakeDatabase({ version: 3, stores: ["samples", "kits", "takes", "history"] });
  const corrupt = { id: "broken-sample", blob: null };
  database.stores.get("samples").set(corrupt.id, corrupt);
  const context = makeContext({ indexedDB: new FakeIndexedDB(database) });
  assert.deepEqual(await context.readSamples(), [corrupt]);
  assert.deepEqual(await context.readTakes(), []);
  assert.deepEqual(await context.readKits(), []);
});

test("sample, kit, and take CRUD writes resolve only when the transaction completes", async () => {
  const idb = new FakeIndexedDB();
  const context = makeContext({ indexedDB: idb });
  await context.openDatabase();
  const database = idb.database;
  database.nextTransactionBehavior = { holdCompletion: true };
  let settled = false;
  const sampleWrite = context.writeSample({ id: "sample-1", blob: "synthetic" }).then(() => { settled = true; });
  await tick();
  assert.equal(database.stores.get("samples").has("sample-1"), false);
  assert.equal(settled, false);
  database.transactions.at(-1).complete();
  await sampleWrite;
  assert.equal(database.stores.get("samples").has("sample-1"), true);

  await context.writeKit(clone(storageContract.kit));
  await context.writeTake({ id: "take-1", blob: "synthetic" });
  assert.equal((await context.readKits()).length, 1);
  assert.equal((await context.readTakes()).length, 1);
  await context.deleteSample("sample-1");
  await context.deleteTakeRecord("take-1");
  assert.deepEqual(await context.readSamples(), []);
  assert.deepEqual(await context.readTakes(), []);
});

test("request success can settle a read before a later transaction abort", async () => {
  const database = new FakeDatabase({ version: 3, stores: ["samples", "kits", "takes", "history"] });
  database.stores.get("samples").set("sample-1", { id: "sample-1" });
  database.nextTransactionBehavior = { abortAfterRequestSuccess: true };
  const context = makeContext({ indexedDB: new FakeIndexedDB(database) });
  assert.deepEqual(await context.readSamples(), [{ id: "sample-1" }]);
  assert.equal(database.transactions[0].finished, true);
});

test("write transactions reject on abort and leave their stores unchanged", async () => {
  const database = new FakeDatabase({ version: 3, stores: ["samples", "kits", "takes", "history"] });
  database.nextTransactionBehavior = { abortAfterRequestSuccess: true };
  const context = makeContext({ indexedDB: new FakeIndexedDB(database) });
  await assert.rejects(context.writeSample({ id: "sample-1" }), /Synthetic late transaction abort/);
  assert.equal(database.stores.get("samples").has("sample-1"), false);
});

test("request errors reject storage reads and do not commit mutations", async () => {
  const idb = new FakeIndexedDB();
  const context = makeContext({ indexedDB: idb });
  await context.openDatabase();
  idb.database.nextTransactionBehavior = { failAt: 0 };
  await assert.rejects(context.readSamples(), /Synthetic request failure/);
  assert.deepEqual(await context.readSamples(), []);
});

test("blocked database open remains pending without claiming a storage fallback", async () => {
  const idb = new FakeIndexedDB();
  idb.openBehavior.blocked = true;
  const context = makeContext({ indexedDB: idb });
  let settled = false;
  context.openDatabase().then(() => { settled = true; }, () => { settled = true; });
  await tick();
  assert.equal(settled, false);
  assert.equal(context.storageMode, "persistent");
});

test("opening failure enters memory-only mode and propagates the error", async () => {
  const idb = new FakeIndexedDB();
  idb.openBehavior.error = true;
  const context = makeContext({ indexedDB: idb });
  await assert.rejects(context.readSamples(), /Synthetic open failure/);
  assert.equal(context.storageMode, "memory");
  assert.equal(context.storageState, "unavailable");
});

test("sample and kit writes share one atomic transaction and deletes settle on completion", async () => {
  const idb = new FakeIndexedDB();
  const context = makeContext({ indexedDB: idb });
  const kit = clone(storageContract.kit);
  const sample = { id: "sample-1", blob: "synthetic" };
  await context.writeKitsAndSamples([kit], [sample]);
  assert.equal(idb.database.transactions[0].storeNames.length, 2);
  assert.equal(idb.database.stores.get("kits").has(kit.id), true);
  assert.equal(idb.database.stores.get("samples").has(sample.id), true);
  await context.deleteSamples([sample.id]);
  assert.equal(idb.database.stores.get("samples").has(sample.id), false);
  const transactions = idb.database.transactions.length;
  await context.deleteSamples([]);
  assert.equal(idb.database.transactions.length, transactions);
});

test("a failed multi-store write rolls back both kits and samples", async () => {
  const idb = new FakeIndexedDB();
  const context = makeContext({ indexedDB: idb });
  await context.openDatabase();
  idb.database.nextTransactionBehavior = { failAt: 1 };
  await assert.rejects(context.writeKitsAndSamples([clone(storageContract.kit)], [{ id: "sample-1" }]), /Local storage transaction failed/);
  assert.equal(idb.database.stores.get("kits").size, 0);
  assert.equal(idb.database.stores.get("samples").size, 0);
});

test("launchpack persistence commits before kit and current-kit state changes", () => {
  const importer = section("async function importLaunchpack(file) {", "function naturalCompare(left, right) {");
  const write = importer.indexOf("await writeKitsAndSamples(");
  const kitState = importer.indexOf("kits = new Map(remappedKits");
  const selectedKit = importer.indexOf("currentKitId = activeKitId;");
  assert.ok(write >= 0 && write < kitState && kitState < selectedKit);
  assert.ok(importer.indexOf("samples.set(existing.id") < write,
    "existing-sample slice metadata is currently changed in memory before the atomic write; preserve and report this pre-existing rollback gap");
});

test("failed launchpack transaction keeps new imports and settings out of app and persisted state", async () => {
  const storage = new MemoryStorage([
    [storageContract.localStorageKeys.currentKit, "kit-1"],
    [storageContract.localStorageKeys.kitMirror, "original-mirror"],
  ]);
  const idb = new FakeIndexedDB();
  const context = makeContext({ storage, indexedDB: idb });
  const existingKit = context.createKitRecord(1, clone(storageContract.layout.pads), { name: "Existing kit" });
  const existingSample = { id: "existing-sample", blob: "original-bytes" };
  context.kits = new Map([[existingKit.id, existingKit]]);
  context.samples = new Map([[existingSample.id, existingSample]]);
  context.currentKitId = "kit-1";
  context.validateLaunchpack = () => ({
    importedKits: [{ ...clone(storageContract.kit), id: "kit-2" }],
    importedSamples: [{ id: "pack-sample", hash: "synthetic-hash", blob: "new-bytes", size: 9, slices: [] }],
    activeKitId: "kit-2",
  });
  context.hashBlob = async () => "synthetic-hash";
  context.findSampleByHash = async () => null;
  context.getStoredSampleBytes = () => 0;
  await context.openDatabase();
  idb.database.nextTransactionBehavior = { failAt: 1 };

  await assert.rejects(context.importLaunchpack({ size: 1, text: async () => "{}" }), /Local storage transaction failed/);
  assert.deepEqual([...context.samples.keys()], ["existing-sample"]);
  assert.deepEqual([...context.kits.keys()], ["kit-1"]);
  assert.equal(context.currentKitId, "kit-1");
  assert.equal(storage.getItem(storageContract.localStorageKeys.currentKit), "kit-1");
  assert.equal(storage.getItem(storageContract.localStorageKeys.kitMirror), "original-mirror");
  assert.equal(idb.database.stores.get("kits").size, 0);
  assert.equal(idb.database.stores.get("samples").size, 0);
});

test("existing-sample slices mutate in memory before failed launchpack transaction leaves persisted data unchanged", async () => {
  const storage = new MemoryStorage([
    [storageContract.localStorageKeys.currentKit, "kit-1"],
    [storageContract.localStorageKeys.kitMirror, "original-mirror"],
  ]);
  const idb = new FakeIndexedDB();
  const context = makeContext({ storage, indexedDB: idb });
  const existingKit = context.createKitRecord(1, clone(storageContract.layout.pads), { name: "Existing kit" });
  const existingSample = { id: "existing-sample", hash: "synthetic-hash", blob: "original-bytes", slices: [] };
  context.kits = new Map([[existingKit.id, existingKit]]);
  context.samples = new Map([[existingSample.id, existingSample]]);
  context.currentKitId = "kit-1";
  context.validateLaunchpack = () => ({
    importedKits: [{ ...clone(storageContract.kit), id: "kit-2" }],
    importedSamples: [{ id: "pack-sample", hash: "synthetic-hash", blob: "new-bytes", size: 9, slices: [{ id: "imported-slice" }] }],
    activeKitId: "kit-2",
  });
  context.hashBlob = async () => "synthetic-hash";
  context.findSampleByHash = async () => existingSample;
  context.getStoredSampleBytes = () => 0;
  await context.openDatabase();
  await context.writeKitsAndSamples([existingKit], [existingSample]);
  idb.database.nextTransactionBehavior = { failAt: 1 };

  await assert.rejects(context.importLaunchpack({ size: 1, text: async () => "{}" }), /Local storage transaction failed/);
  assert.deepEqual(context.samples.get("existing-sample").slices, [{ id: "imported-slice" }]);
  assert.deepEqual(context.kits.get("kit-1"), existingKit);
  assert.equal(context.currentKitId, "kit-1");
  assert.equal(storage.getItem(storageContract.localStorageKeys.currentKit), "kit-1");
  assert.equal(storage.getItem(storageContract.localStorageKeys.kitMirror), "original-mirror");
  assert.deepEqual(idb.database.stores.get("samples").get("existing-sample").slices, []);
  assert.equal(idb.database.stores.get("kits").has("kit-1"), true);
  assert.equal(idb.database.stores.get("kits").has("kit-2"), false);
});

test("legacy mirror bootstraps memory state but current source does not copy complete mirrors into IndexedDB", async () => {
  const mirror = Array.from({ length: 5 }, (_, index) => ({
    ...clone(storageContract.kit), id: `kit-${index + 1}`, name: `Kit ${index + 1}`, empty: index !== 0,
  }));
  const storage = new MemoryStorage([[storageContract.localStorageKeys.kitMirror, JSON.stringify(mirror)]]);
  const idb = new FakeIndexedDB();
  const context = makeContext({ storage, indexedDB: idb });
  await context.openDatabase();
  await context.initializeKitLibrary(clone(storageContract.layout.pads));
  assert.equal(context.kits.size, 5);
  assert.equal(idb.database.stores.get("kits").size, 0);
  assert.equal(idb.database.transactions.filter((transaction) => transaction.mode === "readwrite").length, 0);
  assert.equal(storage.getItem(storageContract.localStorageKeys.currentKit), "kit-1");
  assert.equal(JSON.parse(storage.getItem(storageContract.localStorageKeys.kitMirror)).length, 5);
  await context.initializeKitLibrary(clone(storageContract.layout.pads));
  assert.equal(context.kits.size, 5);
  assert.equal(idb.database.stores.get("kits").size, 0);
});

test("partial legacy mirrors lose records when other slots are persisted before the next startup", async () => {
  const legacyKit = { ...clone(storageContract.kit), id: "kit-2", name: "Legacy custom kit" };
  const storage = new MemoryStorage([[storageContract.localStorageKeys.kitMirror, JSON.stringify([legacyKit])]]);
  const idb = new FakeIndexedDB();
  const context = makeContext({ storage, indexedDB: idb });
  await context.openDatabase();

  await context.initializeKitLibrary(clone(storageContract.layout.pads));
  assert.equal(context.kits.get("kit-2").name, "Legacy custom kit");
  assert.equal(idb.database.stores.get("kits").size, 4);

  await context.initializeKitLibrary(clone(storageContract.layout.pads));
  assert.equal(idb.database.stores.get("kits").size, 5);
  assert.equal(context.kits.get("kit-2").name, "Kit 2");
  assert.equal(JSON.parse(storage.getItem(storageContract.localStorageKeys.kitMirror))[1].name, "Kit 2");
});

test("default kit creation writes five slots once and repeated initialization is idempotent", async () => {
  const idb = new FakeIndexedDB();
  const context = makeContext({ indexedDB: idb });
  await context.openDatabase();
  await context.initializeKitLibrary(clone(storageContract.layout.pads));
  assert.equal(idb.database.stores.get("kits").size, storageContract.limits.fixedKitSlots);
  assert.equal(idb.database.transactions.filter((transaction) => transaction.mode === "readwrite").length, 1);
  await context.initializeKitLibrary(clone(storageContract.layout.pads));
  assert.equal(idb.database.stores.get("kits").size, storageContract.limits.fixedKitSlots);
  assert.equal(idb.database.transactions.filter((transaction) => transaction.mode === "readwrite").length, 1);
});

test("reset cancellation and reset failure leave application data unchanged", async () => {
  const cancelIdb = new FakeIndexedDB();
  const cancelContext = makeContext({ indexedDB: cancelIdb, confirm: () => false });
  const originalSamples = cancelContext.samples;
  const originalTakes = cancelContext.takes;
  const originalPads = cancelContext.pads;
  await cancelContext.resetSampleStorage();
  assert.equal(cancelContext.samples, originalSamples);
  assert.equal(cancelContext.takes, originalTakes);
  assert.equal(cancelContext.pads, originalPads);
  assert.equal(cancelIdb.lastDelete, undefined);

  const idb = new FakeIndexedDB(new FakeDatabase({ version: 3, stores: ["samples", "kits", "takes", "history"] }));
  idb.deleteBehavior.error = true;
  const context = makeContext({ indexedDB: idb, confirm: () => true });
  context.sampleDatabase = idb.database;
  const before = { samples: context.samples, takes: context.takes, pads: context.pads, kits: context.kits };
  await context.resetSampleStorage();
  assert.equal(context.samples, before.samples);
  assert.equal(context.takes, before.takes);
  assert.equal(context.pads, before.pads);
  assert.equal(context.kits, before.kits);
  assert.equal(context.storageMode, "memory");
  assert.equal(idb.lastDelete, storageContract.database.name);
});

test("reset database deletion reports blocked and unavailable outcomes", async () => {
  for (const behavior of [{ blocked: true }, { error: true }]) {
    const idb = new FakeIndexedDB(new FakeDatabase({ version: 3, stores: ["samples", "kits", "takes", "history"] }));
    idb.deleteBehavior = behavior;
    const context = makeContext({ indexedDB: idb });
    await assert.rejects(context.deleteSampleDatabase(), behavior.blocked ? /Close other launchpad tabs/ : /Synthetic delete failure/);
  }
});

test("confirmed reset helper closes and deletes only the injected database", async () => {
  const database = new FakeDatabase({ version: 3, stores: ["samples", "kits", "takes", "history"] });
  const idb = new FakeIndexedDB(database);
  const context = makeContext({ indexedDB: idb });
  context.sampleDatabase = database;
  context.databasePromise = Promise.resolve(database);
  await context.deleteSampleDatabase();
  assert.equal(database.closed, true);
  assert.equal(idb.lastDelete, storageContract.database.name);
  assert.equal(idb.database, null);
  assert.equal(context.sampleDatabase, undefined);
  assert.equal(context.databasePromise, undefined);
});
