import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("IndexedDB v3 adds professional stores without replacing the samples store", () => {
  assert.match(app, /const DATABASE_VERSION = 3;/);
  assert.match(app, /request\.result\.objectStoreNames\.contains\("samples"\)/);
  assert.match(app, /request\.result\.objectStoreNames\.contains\("kits"\)/);
  assert.match(app, /request\.result\.createObjectStore\("kits", \{ keyPath: "id" \}\)/);
  assert.match(app, /request\.result\.createObjectStore\("takes", \{ keyPath: "id" \}\)/);
  assert.match(app, /request\.result\.createObjectStore\("history", \{ keyPath: "id" \}\)/);
  assert.match(app, /async function initializeKitLibrary\(legacyPads\)/);
  assert.match(app, /name: slot === 1 \? "Kit 1 — Starter" : defaultKitName\(slot\)/);
});

test("kit controls expose fixed-slot selection and lifecycle actions", () => {
  assert.match(app, /const KIT_COUNT = 5;/);
  assert.match(app, /function switchKit\(nextKitId\)/);
  assert.match(app, /function confirmKitSwitch\(\)/);
  assert.match(app, /stopAll\(\{ announce: false \}\);\s*currentKitId = nextKitId;/);
  assert.match(app, /async function renameActiveKit\(\)/);
  assert.match(app, /async function duplicateActiveKit\(\)/);
  assert.match(app, /async function deleteActiveKit\(\)/);
  assert.match(app, /kitSelect\.addEventListener\("change"/);
  assert.match(html, /id="kit-select"/);
  assert.match(html, /id="rename-kit"/);
  assert.match(html, /id="duplicate-kit"/);
  assert.match(html, /id="delete-kit"/);
});

test("folder imports natural-sort audio, deduplicate by SHA-256, and retain extras", () => {
  assert.match(app, /async function hashBlob\(blob\)/);
  assert.match(app, /SHA-256/);
  assert.match(app, /async function findSampleByHash\(hash\)/);
  assert.match(app, /function naturalCompare\(left, right\)/);
  assert.match(app, /webkitRelativePath \|\| file\.name/);
  assert.match(app, /Additional files remain in the shared library/);
  assert.match(html, /id="import-pack"[^>]*multiple[^>]*webkitdirectory/);
});

test("shared-library samples can be staged on the selected pad before saving", () => {
  assert.match(app, /function assignSampleToSelectedPad\(sampleId\)/);
  assert.match(app, /draftSampleId = sampleId;/);
  assert.match(app, /draftSampleId && samples\.has\(draftSampleId\)/);
  assert.match(app, /className = "button button-secondary sample-assign"/);
  assert.match(app, /assignButton\.addEventListener\("click", \(\) => assignSampleToSelectedPad\(sample\.id\)\)/);
  assert.match(html, /Assign library files to this pad, then save/);
});

test("launchpack export/import validates safe paths, hashes, limits, remaps IDs, and writes transactionally", () => {
  assert.match(app, /const MAX_LAUNCHPACK_BYTES = 700 \* 1024 \* 1024;/);
  assert.match(app, /function isSafePackPath\(value\)/);
  assert.match(app, /function validateLaunchpack\(parsedPack\)/);
  assert.match(app, /async function exportLaunchpack\(\)/);
  assert.match(app, /async function importLaunchpack\(file\)/);
  assert.match(app, /writeKitsAndSamples\(remappedKits, remappedSamples\)/);
  assert.match(app, /const sampleIdRemap = new Map\(\)/);
  assert.match(app, /actualHash !== importedSample\.hash/);
  assert.match(app, /transaction\.abort\(\)/);
  assert.match(app, /delete nextSample\.path;/);
  assert.match(html, /id="export-pack"/);
  assert.match(html, /id="import-launchpack"/);
});

test("kit switching keeps transport controls global and playback generation is stopped", () => {
  assert.match(app, /const tempoInput = document\.querySelector\("#tempo"\);/);
  assert.match(app, /const quantizeInput = document\.querySelector\("#quantize"\);/);
  assert.match(app, /stopAll\(\{ announce: false \}\);\s*currentKitId = nextKitId/);
  assert.match(app, /playbackGeneration \+= 1;/);
  assert.match(app, /currentKitId = activeKitId;/);
});
