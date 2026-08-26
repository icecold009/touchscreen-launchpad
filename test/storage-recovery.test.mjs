import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("storage recovery exposes explicit saved, saving, upgrade, failure, and memory-only states", () => {
  for (const state of ["saved", "saving", "quota", "upgrade", "corrupt", "unavailable", "memory-only"]) {
    assert.match(app, new RegExp(`["']?${state}["']?:`));
  }
  assert.match(app, /function setStorageState\(state, message = ""\)/);
  assert.match(app, /function getStorageStateLabel\(state\)/);
  assert.match(app, /persistenceMessage\.textContent = message;/);
  assert.match(app, /repairStorageButton\.hidden = !showRecoveryActions;/);
  assert.match(app, /resetStorageButton\.hidden = !showRecoveryActions;/);
});

test("sample records are validated and corrupt records are quarantined", () => {
  assert.match(app, /function isValidStoredSample\(sample\)/);
  assert.match(app, /typeof sample\.blob\?\.arrayBuffer === "function"/);
  assert.match(app, /function partitionStoredSamples\(storedSamples\)/);
  assert.match(app, /setStorageState\("corrupt"/);
});

test("repair is non-destructive and reset requires explicit confirmation", () => {
  assert.match(app, /async function repairSampleStorage\(\)/);
  assert.match(app, /sampleDatabase\?\.close\(\);/);
  assert.match(app, /async function resetSampleStorage\(\)/);
  assert.match(app, /window\.confirm\("Reset saved sample storage\?/);
  assert.match(app, /await deleteSampleDatabase\(\);/);
  assert.match(app, /pads = pads\.map\(\(pad\) => \(\{ \.\.\.pad, sampleId: null \}\)\);/);
});

test("service-worker status does not overwrite healthy persistence status", () => {
  assert.match(app, /if \(storageState === "saved"\) updateConnectionStatus\(`\$\{getStorageStateLabel\(storageState\)\} · Offline-ready`, "ready"\);/);
  assert.match(app, /if \(storageState === "saved"\) updateConnectionStatus\("Saved locally · Browser mode", "muted"\);/);
});

test("a layout persistence failure is not hidden by a healthy sample read", () => {
  assert.match(app, /\} else if \(storageMode === "persistent"\) \{\s*setStorageState\("saved"\);/);
});

test("storage recovery controls are present but hidden until an issue is reported", () => {
  assert.match(html, /id="persistence-note"[^>]*role="status"/);
  assert.match(html, /id="repair-storage"[^>]*hidden/);
  assert.match(html, /id="reset-storage"[^>]*hidden/);
});
