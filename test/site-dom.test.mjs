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
    "effects-panel",
    "sequencer-panel",
    "sample-library",
    "performance-capture",
  ]) {
    assert.match(html, new RegExp(`class=["'][^"']*feature-nav-primary-link[^"']*["'][^>]+href=["']#${target}["']`), `main view is missing #${target}`);
  }
  for (const target of ["kit-options", "midi-panel", "pad-setup", "layout-tools", "audio-tools", "arrangement-exports"]) {
    assert.match(html, new RegExp(`class=["'][^"']*feature-nav-link[^"']*["'][^>]+href=["']#${target}["']`), `Tools is missing #${target}`);
  }
  assert.match(html, /href=["']#pad-editor["']/i);
  assert.equal((html.match(/id=["']kit-select["']/g) ?? []).length, 1, "the live kit selector has one owner");
  assert.ok(html.indexOf('id="kit-select"') < html.indexOf('id="pad-grid"'), "kit selection is available before the pads");
  assert.match(html, /id=["']pad-setup["'][^>]+class=["'][^"']*is-collapsed/);
  assert.match(html, /id=["']midi-panel["'][^>]+class=["'][^"']*tool-detail/);
  assert.match(html, /id=["']audio-tools["'][^>]+class=["'][^"']*mix-tools[^"']*tool-detail/);
  assert.match(html, /id=["']arrangement-exports["'][^>]+class=["'][^"']*tool-detail/);
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
  assert.match(app, /knobRoleByInputId = new Map\(/);
  assert.match(app, /function enhanceAddedRangeInputs\(mutations\)/);
  assert.match(app, /rangeKnobObserver\.observe\(sliceList, \{ childList: true, subtree: true \}\)/);
  assert.doesNotMatch(app, /new MutationObserver\(\(\) => enhanceRangeInputs\(\)\)/);
  assert.match(app, /event\.key !== ["']PageUp["']/);
  assert.match(app, /event\.key !== ["']PageDown["']/);
  assert.match(app, /RANGE_DRAG_PIXELS = 160/);
  assert.match(styles, /input\[type=["']range["']\]\.knob-range/);
  assert.match(styles, /\.knob-face::before/);
  assert.match(styles, /\.knob-control::before[\s\S]*?repeating-conic-gradient/);
  assert.match(styles, /\.knob-face::before\s*\{[^}]*top:\s*0\.04rem;[^}]*width:\s*0\.11rem;[^}]*height:\s*0\.24rem;[^}]*background:\s*#fff;[^}]*transform-origin:\s*50% 1\.495rem;/);
  assert.match(styles, /\.knob-face::after\s*\{\s*display:\s*none;/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*?\.knob-face::before\s*\{\s*transform-origin:\s*50% 1\.32rem;/);
  assert.match(styles, /\.knob-control\[data-knob-role="centered"\]/);
  assert.match(styles, /transform: translateX\(-50%\) rotate\(var\(--knob-angle\)\)/);
  assert.match(app, /if \(input\.id === "master-volume"\) \{\s*input\.classList\.add\("fader-range"\);\s*syncRangeProgress\(input\);\s*return;/);
  assert.match(app, /input\.classList\.contains\("fader-range"\)\) return/);
  assert.match(html, /id=["']master-volume["'][^>]+aria-label=["']Master volume["'][^>]+aria-orientation=["']vertical["']/i);
  assert.match(styles, /input\[type="range"\]\.fader-range::-webkit-slider-thumb/);
  assert.match(styles, /input\[type="range"\]\.fader-range::-moz-range-thumb/);
  assert.match(app, /function getPadDisplayColor\(pad\) \{\s*return pad\?\.color;/);
  assert.match(app, /button\.style\.setProperty\("--pad-color", getPadDisplayColor\(pad\)\)/);
  assert.match(styles, /\.effects-controls > \.compact-control > span:first-child,[\s\S]*?white-space: normal/);
  assert.match(styles, /\.effects-controls > \.master-macro-group\s*\{\s*grid-column: 1 \/ -1/);
  assert.match(styles, /\.knob-control\s*\{[^}]*width:\s*2\.75rem;[^}]*height:\s*2\.75rem;/);
  assert.match(styles, /\.effects-bay \.knob-face,\s*\.master-macro-group \.knob-face\s*\{[^}]*inset:\s*0\.52rem;/);
  assert.match(styles, /#effects-panel \.knob-face::before\s*\{[^}]*top:\s*0\.04rem;[^}]*width:\s*0\.09rem;[^}]*height:\s*0\.18rem;[^}]*background:\s*#fff;[^}]*transform-origin:\s*50% 0\.815rem;/);
  assert.match(styles, /#effects-panel \.knob-face::after\s*\{\s*display:\s*none;/);
  assert.match(styles, /\.effects-bay > \.compact-control,[\s\S]*?grid-template-rows:\s*minmax\(0, 0\.78rem\) 2\.5rem/);
  assert.match(styles, /@media \(min-width: 541px\)\s*\{\s*#transport-controls \.control-row\s*\{\s*grid-template-columns: 8rem 8rem 13rem;/);
  assert.match(styles, /@media \(max-width: 540px\)\s*\{\s*#transport-controls \.control-row\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /#kit-tools:has\(#kit-options:not\(\[open\]\)\),\s*#midi-panel:not\(\[open\]\)\s*\{\s*display: none;/);
  assert.match(styles, /touch-action:\s*none/);
});

test("the sequencer playhead updates in place without replacing step rows on clock ticks", () => {
  assert.match(app, /function updateSequencerPlayhead\(stepIndex\)/);
  assert.match(app, /button\.dataset\.trackIndex = String\(trackIndex\)/);
  assert.match(app, /button\.dataset\.stepIndex = String\(stepIndex\)/);
  assert.match(app, /button\.setAttribute\("aria-current", "step"\)/);
  assert.match(app, /sequencerPlayButton\.setAttribute\("aria-pressed", String\(sequencerRunner\.running\)\)/);
  assert.match(app, /sequencerPlayButton\.classList\.toggle\("is-playing", sequencerRunner\.running\)/);
  assert.match(html, /id="sequencer-play"[^>]+aria-pressed="false"/);
  assert.match(html, /id="sequencer-tools" class="sequencer-tools tool-detail"[\s\S]*?<summary class="tool-summary">Scene tools<\/summary>/);
  assert.match(html, /id="sequencer-tools"[\s\S]*?id="scene-a-name"[\s\S]*?id="scene-launch-quantize"[\s\S]*?id="sequencer-clear"[\s\S]*?id="sequencer-undo"[\s\S]*?id="arrangement-exports"/);
  assert.match(app, /if \(sceneChanged\) renderSequencer\(\)/);
  assert.match(app, /function stopSequencerPlayback\(\)\s*\{\s*sequencerRunner\.stop\(\);\s*pendingSceneLaunch = undefined;\s*sequencerHasStepped = false;\s*updateSequencerPlayhead\(-1\);/);
  assert.equal((app.match(/sequencerRunner\.stop\(\)/g) || []).length, 1, "sequencer stops share playhead cleanup");
  assert.match(styles, /\.sequencer-step\.is-current/);
  assert.match(styles, /\.sequencer-step\.is-on\.is-current/);
  assert.match(styles, /#sequencer-play\.button-primary\.is-playing/);
  assert.match(styles, /#transport-controls \.control-row\s*\{[^}]*display: grid;[^}]*grid-template-columns: max-content max-content minmax\(12rem, max-content\)/);
  assert.match(styles, /\.sequencer-toolbar\s*\{[^}]*grid-template-columns: max-content minmax\(8rem, max-content\) minmax\(10rem, 15rem\) max-content/);
  assert.match(styles, /\.sequencer-tools-drawer\s*\{[^}]*position: static;[^}]*grid-column: 1 \/ -1/);
  assert.match(styles, /\.pad-performance \.pad:active[\s\S]*?transform: translateY\(2px\)/);
  assert.match(styles, /\.pad-performance \.pad::before[\s\S]*?height: 28%/);
});

test("the workspace map exposes a collapsible control", () => {
  assert.match(app, /function toggleFeatureNav\(/);
  assert.match(app, /featureNavGroups\.hidden = isExpanded/);
  assert.match(app, /featureNavToggle\.setAttribute\(["']aria-expanded["']/);
  assert.match(app, /const targetDetails = target\?\.closest\(["']details["']\)/);
  assert.match(app, /if \(targetDetails\) targetDetails\.open = true/);
  assert.match(app, /featureNavGroups\?\.contains\(link\)/);
  assert.match(styles, /\.feature-nav\.is-collapsed/);
});

test("the performance console puts its trigger bank before utility panels", () => {
  const transport = html.indexOf('id="transport-controls"');
  const pads = html.indexOf('id="pad-grid"');
  const kits = html.indexOf('id="kit-tools"');
  const capture = html.indexOf('id="performance-capture"');
  const arrangement = html.indexOf('id="sequencer-panel"');
  assert.ok(transport >= 0 && transport < pads, "the pad bank follows the transport");
  assert.ok(pads < kits && kits < arrangement && arrangement < capture, "the sequencer follows the trigger bank before recording utilities");
  assert.match(html, /class="feature-nav-primary"[\s\S]*href="#performance-surface"[\s\S]*href="#effects-panel"[\s\S]*href="#sequencer-panel"[\s\S]*href="#sample-library"[\s\S]*href="#performance-capture"/);
  assert.match(html, /class="effects-bay" role="group" aria-label="Time effects"/);
  assert.match(html, /class="effects-bay" role="group" aria-label="Three-band master equalizer"/);
  assert.match(html, /class="effects-bay" role="group" aria-label="Master dynamics"/);
  assert.match(styles, /\.editor-panel\s*\{[\s\S]*?position:\s*static;[\s\S]*?max-height:\s*none;[\s\S]*?overflow:\s*visible;/);
  const transportStrip = styles.slice(styles.lastIndexOf("#transport-controls {"));
  assert.match(transportStrip, /#transport-controls\s*\{[^}]*border-inline:\s*0;[^}]*border-radius:\s*0;/);
  assert.match(styles, /\.feature-nav\s*\{[\s\S]*?backdrop-filter:\s*none/);
});

test("action controls share a clean visual system", () => {
  assert.match(html, /id=["']editor-toggle["'][^>]+class=["'][^"']*button[^"']*editor-toggle[^"']*["']/i);
  assert.match(html, /id=["']clear-sample["'][^>]+class=["'][^"']*button[^"']*text-button[^"']*["']/i);
  assert.match(styles, /--button-height:\s*2\.45rem/);
  assert.match(styles, /button\.button-primary[\s\S]*?background:\s*var\(--button-surface\)/);
  assert.match(styles, /\.file-button/);
});

test("the capture area and master bus share a muted hardware chassis", () => {
  const unifiedChassis = styles.slice(styles.lastIndexOf("/* Capture and the master bus belong to the same instrument chassis. */"));
  assert.match(unifiedChassis, /#performance-capture,[\s\S]*?#effects-panel\s*\{[^}]*border:\s*0;[^}]*border-top:\s*1px solid #383d38;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/);
  assert.match(unifiedChassis, /#performance-capture > \.section-heading,[\s\S]*?#effects-panel > \.section-heading\s*\{[^}]*border-bottom:\s*1px solid #303530;[^}]*background:\s*transparent;/);
  assert.match(unifiedChassis, /#effects-panel \.effects-bay \.knob-control,[\s\S]*?#effects-panel \.master-macro-group \.knob-control\s*\{\s*--knob-accent:\s*#cc9450;/);
  assert.doesNotMatch(unifiedChassis, /#53b6a6|#55b6a6|#91a5d9/);
});

test("the performance console keeps its touch targets and reflows on narrow screens", () => {
  assert.match(styles, /\.pad-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /@media\s*\(min-width:\s*700px\)\s*\{\s*\.pad-grid\s*\{\s*grid-template-columns:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /\.pad-performance \.pad\s*\{[^}]*min-height:\s*3\.75rem/);
  assert.match(styles, /\.effects-bay \.knob-control,[\s\S]*?\.master-macro-group \.knob-control\s*\{[^}]*width:\s*2\.75rem;[^}]*height:\s*2\.75rem/);
  assert.match(styles, /\.sequencer-grid\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(styles, /\.sequencer-track\s*\{[^}]*min-width:\s*42rem/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*?\.sequencer-toolbar\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
  assert.match(styles, /@media\s*\(max-width:\s*480px\)\s*\{\s*\.sequencer-tools-drawer\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /@media\s*\(max-width:\s*380px\)\s*\{\s*#effects-panel \.effects-controls\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /html\s*\{\s*min-width:\s*320px/);
});

test("sequencer step shaping stays on the chassis and keeps all controls reachable", () => {
  const stepEditor = styles.slice(styles.lastIndexOf("/* Keep step shaping on the sequencer chassis instead of adding another card. */"));
  assert.match(stepEditor, /#sequencer-panel \.sequencer-step-editor\s*\{[^}]*border:\s*0;[^}]*border-top:\s*1px solid #303632;[^}]*border-radius:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/);
  assert.match(stepEditor, /#sequencer-panel \.sequencer-step-controls\s*\{[^}]*grid-template-columns:\s*minmax\(5rem, 0\.4fr\) minmax\(5rem, 0\.4fr\) repeat\(2, minmax\(12rem, 1\.1fr\)\)/);
  assert.match(stepEditor, /@media \(max-width: 760px\)[\s\S]*?#sequencer-panel \.sequencer-step-controls \.range-control\s*\{[^}]*grid-column:\s*1 \/ -1/);
  assert.match(html, /class="sequencer-step-editor"[\s\S]*?id="sequencer-step-track"[\s\S]*?id="sequencer-step-index"[\s\S]*?id="sequencer-step-probability"[\s\S]*?id="sequencer-step-micro"/);
});

test("the active sequencer scene uses the restrained amber hardware state", () => {
  const sequencerStates = styles.slice(styles.lastIndexOf("#sequencer-panel .scene-buttons .button.is-active {"));
  assert.match(sequencerStates, /border-color:\s*#d69a50;[\s\S]*?background:\s*linear-gradient\(180deg, #dfa95f, #a96830\);[\s\S]*?color:\s*#21170d;/);
  assert.match(sequencerStates, /#sequencer-panel \.scene-buttons \.button\.is-active:active\s*\{\s*transform:\s*translateY\(1px\)/);
});

test("workspace sections expose a visual differentiation system", () => {
  assert.match(styles, /--section-accent:\s*#9eaeff/);
  assert.match(styles, /--section-accent:\s*#84d4bd/);
  assert.match(styles, /border-top-color:\s*var\(--section-accent\)/);
  assert.match(styles, /background:\s*linear-gradient\(180deg,\s*color-mix/);
});

test("a closed editor leaves the live surface full width and mixer bays compact", () => {
  assert.match(styles, /\.workspace\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\);\s*\}/);
  assert.match(styles, /\.editor-panel\.is-collapsed\s*\{\s*display:\s*none;\s*\}/);
  assert.match(styles, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
  assert.match(styles, /\.effects-controls\s*\{\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);\s*\}/);
  assert.match(styles, /@media \(min-width:\s*960px\)[\s\S]*?\.effects-controls\s*\{\s*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
});
