import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { downloadBlob, downloadText } from "../src/download.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("downloads keep object URLs alive through delayed browser start and clean up", () => {
  assert.match(app, /triggerTextDownload\(\{ documentRef: document, windowRef: window \}, filename, content, mimeType\);/);

  let cleanup;
  let appendedLink;
  let revokedUrl;
  const link = {
    hidden: false,
    clickCalled: false,
    removed: false,
    click() { this.clickCalled = true; },
    remove() { this.removed = true; },
  };
  const documentRef = {
    body: { append(node) { appendedLink = node; } },
    createElement() { return link; },
  };
  const windowRef = {
    setTimeout(callback, delay) {
      assert.equal(delay, 1000);
      cleanup = callback;
    },
  };
  const urlApi = {
    createObjectURL(blob) {
      assert.deepEqual(blob.parts, ["{}"]);
      assert.deepEqual(blob.options, { type: "application/json" });
      return "blob:test";
    },
    revokeObjectURL(url) { revokedUrl = url; },
  };
  class BlobCtor {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  }

  downloadText({ documentRef, windowRef, urlApi, BlobCtor }, "layout.json", "{}", "application/json");
  assert.equal(appendedLink, link);
  assert.equal(link.href, "blob:test");
  assert.equal(link.download, "layout.json");
  assert.equal(link.hidden, true);
  assert.equal(link.clickCalled, true);
  assert.equal(link.removed, false);
  cleanup();
  assert.equal(link.removed, true);
  assert.equal(revokedUrl, "blob:test");
});

test("binary downloads use the same delayed cleanup lifecycle", () => {
  const revoked = [];
  const timers = [];
  const body = { append(link) { this.link = link; }, link: null };
  const documentRef = { body, createElement() { return { click() {}, remove() { this.removed = true; } }; } };
  const windowRef = { setTimeout(callback, delay) { timers.push({ callback, delay }); } };
  const urlApi = { createObjectURL(blob) { assert.equal(blob.type, "audio/midi"); return "blob:midi"; }, revokeObjectURL(url) { revoked.push(url); } };

  downloadBlob({ documentRef, windowRef, urlApi }, "scene.mid", new Blob([new Uint8Array([0x4d, 0x54])], { type: "audio/midi" }));
  assert.equal(body.link.download, "scene.mid");
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 1000);
  timers[0].callback();
  assert.deepEqual(revoked, ["blob:midi"]);
});

test("export and import surface file failures without discarding layout state", () => {
  assert.match(app, /function exportLayout\(\)/);
  assert.match(app, /Layout export failed\. Check browser download permissions and try again\./);
  assert.match(app, /const parsedLayout = JSON\.parse\(await file\.text\(\)\);/);
  assert.match(app, /if \(!saveLayout\("Layout imported and saved\."\)\) \{[\s\S]*pads = previousPads;/);
  assert.match(app, /Layout import failed; your existing layout was preserved\./);
});

test("imports validate schema, pad count, and missing local sample bytes", () => {
  assert.match(app, /function validateImportedLayout\(parsedLayout\)/);
  assert.match(app, /!\[1, 2\]\.includes\(parsedLayout\.version\)/);
  assert.match(app, /parsedLayout\.pads\.length !== PAD_COUNT/);
  assert.match(app, /const missingSampleIds = \[\.\.\.new Set\(importedPads\.map\(\(pad\) => pad\.sampleId\)\.filter\(Boolean\)\)\]/);
  assert.match(app, /assigned \$\{sampleWord\} missing in this browser/);
});

test("import and sample resource boundaries reject oversized local inputs", () => {
  assert.match(app, /const MAX_LAYOUT_BYTES = 256 \* 1024;/);
  assert.match(app, /if \(!Number\.isFinite\(file\.size\) \|\| file\.size > MAX_LAYOUT_BYTES\)/);
  assert.match(app, /const MAX_SAMPLE_COUNT = 128;/);
  assert.match(app, /const MAX_SAMPLE_STORAGE_BYTES = 512 \* 1024 \* 1024;/);
  assert.match(app, /getStoredSampleBytes\(\) \+ pendingSampleBytes \+ file\.size > MAX_SAMPLE_STORAGE_BYTES/);
  assert.match(app, /const MAX_DECODED_AUDIO_BYTES = 256 \* 1024 \* 1024;/);
  assert.match(app, /buffer\.duration > MAX_DECODED_AUDIO_SECONDS/);
  assert.match(app, /let pendingSampleBytes = 0;/);
  assert.match(app, /let pendingSampleCount = 0;/);
  assert.match(app, /samples\.size \+ pendingSampleCount >= MAX_SAMPLE_COUNT/);
  assert.match(app, /getStoredSampleBytes\(\) \+ pendingSampleBytes \+ file\.size > MAX_SAMPLE_STORAGE_BYTES/);
  assert.match(app, /function limitStoredSamples\(validSamples\)/);
  assert.match(app, /const \{ accepted, excess \} = limitStoredSamples\(valid\);/g);
});

test("saving returns an explicit result for import rollback", () => {
  assert.match(app, /setStatus\(storageMode === "memory" \? `\$\{message\} Memory-only mode: a reload may discard changes\.\` : message, storageMode === "memory" \? "error" : "success"\);\s*return true;/);
  assert.match(app, /setStatus\("This browser could not save the layout\.", "error"\);\s*return false;/);
});

test("pad save rolls back the pad and newly persisted sample when layout storage fails", () => {
  assert.match(app, /const previousPad = pads\[selectedPadIndex\];/);
  assert.match(app, /if \(!saveLayout\(`\$\{getPadName\(pads\[selectedPadIndex\], selectedPadIndex\)\} updated and saved\.\`\)\) \{/);
  assert.match(app, /pads\[selectedPadIndex\] = previousPad;/);
  assert.match(app, /samples\.delete\(createdSample\.id\);/);
  assert.match(app, /await deleteSample\(createdSample\.id\);/);
  assert.match(app, /Pad save failed; your existing layout was preserved\./);
});
