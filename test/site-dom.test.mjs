import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function hasId(id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<[^>]*\\bid=["']${escapedId}["']`, "i").test(html);
}

test("the launchpad DOM exposes its primary interaction surface", () => {
  const requiredIds = [
    "pad-grid",
    "status",
    "stop-all",
    "loop-toggle",
    "master-volume",
    "pad-editor",
    "layout-tools",
    "sample-library",
    "sample-file",
    "save-layout",
    "export-layout",
    "import-layout",
    "reset-layout",
    "kit-select",
    "kit-name",
    "kit-count",
    "rename-kit",
    "duplicate-kit",
    "delete-kit",
    "save-layout",
    "export-pack",
    "import-pack",
    "import-launchpack",
    "sample-search",
    "install-app",
    "persistence-message",
    "repair-storage",
    "reset-storage",
    "sequencer-grid",
    "sequencer-step-track",
    "sequencer-step-index",
    "sequencer-step-probability",
    "sequencer-step-micro",
    "sequencer-duplicate",
    "sequencer-undo",
    "sequencer-redo",
    "undo-pad",
    "redo-pad",
    "pause-recording",
    "midi-profile-name",
    "midi-clock-in",
    "midi-clock-out",
    "midi-mapping-target",
    "midi-learn-controller",
    "midi-cancel-learn",
    "midi-clear-mappings",
    "midi-mapping-status",
    "midi-mappings",
    "master-eq-low",
    "master-eq-mid",
    "master-eq-high",
    "compressor-threshold",
    "compressor-ratio",
    "limiter-threshold",
    "macro-warmth",
    "macro-space",
    "macro-punch",
    "master-snapshot",
    "save-master-snapshot",
    "recall-master-snapshot",
    "master-level-check",
    "slice-count",
    "create-slices",
    "clear-slices",
    "slice-list",
    "sample-dropzone",
    "sample-favorites-only",
    "sample-tag-filter",
    "sample-selection-status",
    "assign-selected-samples",
    "remove-orphans",
    "sample-list",
    "sample-zoom",
    "sample-fade-in",
    "sample-fade-out",
    "sample-normalize",
  ];

  for (const id of requiredIds) {
    assert.equal(hasId(id), true, `index.html is missing #${id}`);
  }

  assert.match(html, /class=["'][^"']*volume-rail[^"']*["']/i);
  assert.match(html, /id=["']master-volume["'][^>]+aria-orientation=["']vertical["']/i);
  assert.match(html, /class=["'][^"']*editor-nav[^"']*["']/i);
  assert.match(html, /href=["']#pad-editor["']/i);
  assert.match(html, /href=["']#layout-tools["']/i);
  assert.match(html, /href=["']#sample-library["']/i);
});

test("the DOM loads the app as a module and keeps the static delivery model", () => {
  assert.match(html, /<script[^>]+type=["']module["'][^>]+src=["']src\/bootstrap\.js(?:\?[^"']*)?["']/i);
  assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*(?:bundle|dist|build)[^"']*["']/i);
});
