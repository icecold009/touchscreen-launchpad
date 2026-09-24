import { attachStorageRequest } from "../storage-request.js?version=59";

const DATABASE_NAME = "touchscreen-launchpad";
const DATABASE_VERSION = 3;
const STORE_DEFINITIONS = Object.freeze([
  Object.freeze({ name: "samples", keyPath: "id" }),
  Object.freeze({ name: "kits", keyPath: "id" }),
  Object.freeze({ name: "takes", keyPath: "id" }),
  Object.freeze({ name: "history", keyPath: "id" }),
]);

export function createIndexedDbStore({
  indexedDB,
  onUpgrade = () => {},
  onOpen = () => {},
  onStorageFailure = () => {},
} = {}) {
  let databasePromise;
  let database;

  function getIndexedDB() {
    return typeof indexedDB === "function" ? indexedDB() : indexedDB;
  }

  function open() {
    const factory = getIndexedDB();
    if (!factory) return Promise.reject(new Error("IndexedDB is unavailable."));
    if (!databasePromise) {
      databasePromise = new Promise((resolve, reject) => {
        const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
        request.addEventListener("upgradeneeded", () => {
          onUpgrade(request.result);
          for (const definition of STORE_DEFINITIONS) {
            if (!request.result.objectStoreNames.contains(definition.name)) {
              request.result.createObjectStore(definition.name, { keyPath: definition.keyPath });
            }
          }
        });
        request.addEventListener("success", () => {
          database = request.result;
          database.addEventListener("versionchange", () => database.close());
          onOpen(database);
          resolve(database);
        });
        request.addEventListener("error", () => {
          const error = request.error || new Error("Could not open sample storage.");
          onStorageFailure(error);
          reject(error);
        });
      });
    }
    return databasePromise;
  }

  function requestFromStore(storeName, mode, operation) {
    return open().then((openedDatabase) => new Promise((resolve, reject) => {
      const transaction = openedDatabase.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);
      attachStorageRequest(request, transaction, resolve, reject);
    }));
  }

  function runTransaction(mode, storeNames, operation) {
    return open().then((openedDatabase) => new Promise((resolve, reject) => {
      const transaction = openedDatabase.transaction(storeNames, mode);
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

  function readAll(storeName) {
    return requestFromStore(storeName, "readonly", (store) => store.getAll());
  }

  function writeOne(storeName, record) {
    return runTransaction("readwrite", [storeName], (transaction) => {
      transaction.objectStore(storeName).put(record);
    });
  }

  function deleteMany(storeName, ids) {
    if (!ids.length) return Promise.resolve();
    return runTransaction("readwrite", [storeName], (transaction) => {
      const store = transaction.objectStore(storeName);
      for (const id of ids) store.delete(id);
    });
  }

  function close() {
    database?.close();
    database = undefined;
    databasePromise = undefined;
  }

  function deleteDatabase() {
    const factory = getIndexedDB();
    if (!factory) return Promise.reject(new Error("IndexedDB is unavailable."));
    close();
    return new Promise((resolve, reject) => {
      const request = factory.deleteDatabase(DATABASE_NAME);
      request.addEventListener("success", resolve, { once: true });
      request.addEventListener("error", () => reject(request.error || new Error("Sample storage could not be reset.")), { once: true });
      request.addEventListener("blocked", () => reject(new Error("Close other launchpad tabs before resetting sample storage.")), { once: true });
    });
  }

  return Object.freeze({
    open,
    close,
    deleteDatabase,
    readSamples: () => readAll("samples"),
    writeSample: (sample) => writeOne("samples", sample),
    deleteSample: (sampleId) => deleteMany("samples", [sampleId]),
    deleteSamples: (sampleIds) => deleteMany("samples", sampleIds),
    readTakes: () => readAll("takes"),
    writeTake: (take) => writeOne("takes", take),
    deleteTake: (takeId) => deleteMany("takes", [takeId]),
    readKits: () => readAll("kits"),
    writeKit: (kit) => writeOne("kits", kit),
    writeKits: (kits) => runTransaction("readwrite", ["kits"], (transaction) => {
      const store = transaction.objectStore("kits");
      for (const kit of kits) store.put(kit);
    }),
    writeKitsAndSamples: (kits, samples) => runTransaction("readwrite", ["kits", "samples"], (transaction) => {
      const kitStore = transaction.objectStore("kits");
      const sampleStore = transaction.objectStore("samples");
      for (const kit of kits) kitStore.put(kit);
      for (const sample of samples) sampleStore.put(sample);
    }),
    readHistory: () => readAll("history"),
    writeHistoryRecord: (record) => writeOne("history", record),
    deleteHistoryRecords: (ids) => deleteMany("history", ids),
  });
}
