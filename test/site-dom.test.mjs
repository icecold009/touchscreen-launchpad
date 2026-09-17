import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "style.css"), "utf8");

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
    "render-bars",
    "scene-a-name",
    "scene-b-name",
    "scene-launch-quantize",
    "scene-chain-toggle",
    "scene-chain",
    "scene-chain-status",
    "render-master-wav",
    "render-stems-wav",
    "export-performance-log",
    "render-status",
  ];

  for (const id of requiredIds) {
    assert.equal(hasId(id), true, `index.html is missing #${id}`);
  }

  assert.match(html, /class=["'][^"']*volume-rail[^"']*["']/i);
  assert.match(html, /id=["']master-volume["'][^>]+aria-orientation=["']vertical["']/i);
  assert.match(html, /class=["'][^"']*editor-nav[^"']*["']/i);
  assert.match(html, /class=["'][^"']*feature-nav[^"']*["']/i);
  assert.match(html, /id=["']feature-nav-toggle["'][^>]+aria-expanded=["']false["'][^>]+aria-controls=["']feature-nav-groups["']/i);
  assert.match(html, /id=["']feature-nav-groups["'][^>]+class=["'][^"']*feature-nav-groups[^"']*["'][^>]+hidden/i);
  for (const target of [
    "performance-surface",
    "performance-capture",
    "sequencer-panel",
    "midi-panel",
    "effects-panel",
    "kit-tools",
    "pad-setup",
    "sample-library",
  ]) {
    assert.match(html, new RegExp(`href=["']#${target}["']`), `quick access is missing #${target}`);
  }
  assert.match(html, /href=["']#pad-editor["']/i);
  assert.match(html, /href=["']#layout-tools["']/i);
  assert.match(html, /href=["']#sample-library["']/i);
});

test("the DOM loads the app as a module and keeps the static delivery model", () => {
  assert.match(html, /<script[^>]+type=["']module["'][^>]+src=["']src\/bootstrap\.js(?:\?[^"']*)?["']/i);
  assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*(?:bundle|dist|build)[^"']*["']/i);
});

test("range controls expose the rotary knob interaction contract", () => {
  assert.match(html, /id=["']macro-warmth-value["'][^>]+for=["']macro-warmth["']/i);
  assert.match(html, /id=["']macro-space-value["'][^>]+for=["']macro-space["']/i);
  assert.match(html, /id=["']macro-punch-value["'][^>]+for=["']macro-punch["']/i);
  assert.match(app, /function handleRangePointerDown\(/);
  assert.match(app, /function handleRangePointerMove\(/);
  assert.match(app, /className = ["']knob-face["']/);
  assert.match(app, /event\.key !== ["']PageUp["']/);
  assert.match(app, /event\.key !== ["']PageDown["']/);
  assert.match(app, /RANGE_DRAG_PIXELS = 160/);
  assert.match(styles, /input\[type=["']range["']\]\.knob-range/);
  assert.match(styles, /\.knob-face::before/);
  assert.match(styles, /transform: translateX\(-50%\) rotate\(var\(--knob-angle\)\)/);
  assert.match(styles, /touch-action:\s*none/);
});

test("the workspace map exposes a collapsible control", () => {
  assert.match(app, /function toggleFeatureNav\(/);
  assert.match(app, /featureNavGroups\.hidden = isExpanded/);
  assert.match(app, /featureNavToggle\.setAttribute\(["']aria-expanded["']/);
  assert.match(styles, /\.feature-nav\.is-collapsed/);
});

test("action controls share a clean visual system", () => {
  assert.match(html, /id=["']editor-toggle["'][^>]+class=["'][^"']*button[^"']*editor-toggle[^"']*["']/i);
  assert.match(html, /id=["']clear-sample["'][^>]+class=["'][^"']*button[^"']*text-button[^"']*["']/i);
  assert.match(styles, /--button-height:\s*2\.45rem/);
  assert.match(styles, /button\.button-primary[\s\S]*?background:\s*var\(--button-surface\)/);
  assert.match(styles, /\.file-button/);
});

test("workspace sections expose a visual differentiation system", () => {
  assert.match(styles, /--section-accent:\s*#9eaeff/);
  assert.match(styles, /--section-accent:\s*#84d4bd/);
  assert.match(styles, /border-top-color:\s*var\(--section-accent\)/);
  assert.match(styles, /background:\s*linear-gradient\(180deg,\s*color-mix/);
});
