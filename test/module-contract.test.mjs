import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateModuleGraph } from "../scripts/validate-site.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexedDbStorage = fs.readFileSync(path.join(root, "src", "storage", "indexed-db.js"), "utf8");
const stemSeparationModule = fs.readFileSync(path.join(root, "src", "stem-separation.js"), "utf8");
const stemSeparationEngine = fs.readFileSync(path.join(root, "src", "stem-separation-engine.js"), "utf8");
const htdemucsEngine = fs.readFileSync(path.join(root, "src", "htdemucs-separation-engine.js"), "utf8");
const htdemucsDsp = fs.readFileSync(path.join(root, "src", "htdemucs-separation-dsp.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "src", "bootstrap.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");

test("bootstrap is the single browser entry and app initialization is exportable", () => {
  assert.match(html, /<script[^>]+type=["']module["'][^>]+src=["']src\/bootstrap\.js\?version=(\d+)["']/i);
  assert.match(bootstrap, /import \{ initLaunchpad \} from "\.\.\/app\.js\?version=\d+";/);
  assert.match(bootstrap, /export async function bootstrapLaunchpad/);
  assert.match(bootstrap, /void bootstrapLaunchpad\(\);/);
  assert.match(app, /export async function initLaunchpad\(\)/);
  assert.doesNotMatch(app, /void init(?:Launchpad)?\(\);/);
});

test("module URLs share one asset version and remain in the revised offline shell", () => {
  const htmlVersion = html.match(/src\/bootstrap\.js\?version=(\d+)/)?.[1];
  const bootstrapVersion = bootstrap.match(/app\.js\?version=(\d+)/)?.[1];
  const pointerVersion = app.match(/pointer-state\.js\?version=(\d+)/)?.[1];
  const storageVersion = indexedDbStorage.match(/storage-request\.js\?version=(\d+)/)?.[1];
  const indexedDbStorageVersion = app.match(/storage\/indexed-db\.js\?version=(\d+)/)?.[1];
  const localSettingsVersion = app.match(/storage\/local-settings\.js\?version=(\d+)/)?.[1];
  const downloadVersion = app.match(/download\.js\?version=(\d+)/)?.[1];
  const recordingVersion = app.match(/recording\.js\?version=(\d+)/)?.[1];
  const sampleEditorVersion = app.match(/sample-editor\.js\?version=(\d+)/)?.[1];
  const performanceVersion = app.match(/performance-engine\.js\?version=(\d+)/)?.[1];
  const sequencerVersion = app.match(/sequencer\.js\?version=(\d+)/)?.[1];
  const midiVersion = app.match(/midi\.js\?version=(\d+)/)?.[1];
  const midiFileVersion = app.match(/midi-file\.js\?version=(\d+)/)?.[1];
  const audioLifecycleVersion = app.match(/audio-lifecycle\.js\?version=(\d+)/)?.[1];
  const clockedSequencerVersion = app.match(/clocked-sequencer\.js\?version=(\d+)/)?.[1];
  const slicesVersion = app.match(/slices\.js\?version=(\d+)/)?.[1];
  const stemPadMapVersion = app.match(/stem-pad-map\.js\?version=(\d+)/)?.[1];
  const wavVersion = app.match(/wav\.js\?version=(\d+)/)?.[1];
  const effectsVersion = app.match(/effects\.js\?version=(\d+)/)?.[1];
  const sampleLibraryVersion = app.match(/sample-library\.js\?version=(\d+)/)?.[1];
  const performanceExportVersion = app.match(/performance-export\.js\?version=(\d+)/)?.[1];
  const arrangementVersion = app.match(/arrangement\.js\?version=(\d+)/)?.[1];
  const stemSeparationVersion = app.match(/stem-separation\.js\?version=(\d+)/)?.[1];
  const cacheVersion = serviceWorker.match(/touchscreen-launchpad-v(\d+)/)?.[1];

  assert.ok(htmlVersion);
  assert.equal(bootstrapVersion, htmlVersion);
  assert.equal(pointerVersion, htmlVersion);
  assert.equal(storageVersion, htmlVersion);
  assert.equal(indexedDbStorageVersion, htmlVersion);
  assert.equal(localSettingsVersion, htmlVersion);
  assert.equal(downloadVersion, htmlVersion);
  assert.equal(recordingVersion, htmlVersion);
  assert.equal(sampleEditorVersion, htmlVersion);
  assert.equal(performanceVersion, htmlVersion);
  assert.equal(sequencerVersion, htmlVersion);
  assert.equal(midiVersion, htmlVersion);
  assert.equal(midiFileVersion, htmlVersion);
  assert.equal(audioLifecycleVersion, htmlVersion);
  assert.equal(clockedSequencerVersion, htmlVersion);
  assert.equal(slicesVersion, htmlVersion);
  assert.equal(stemPadMapVersion, htmlVersion);
  assert.equal(wavVersion, htmlVersion);
  assert.equal(effectsVersion, htmlVersion);
  assert.equal(sampleLibraryVersion, htmlVersion);
  assert.equal(performanceExportVersion, htmlVersion);
  assert.equal(arrangementVersion, htmlVersion);
  assert.equal(stemSeparationVersion, htmlVersion);
  assert.ok(Number(cacheVersion) > Number(htmlVersion));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/bootstrap\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/app\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/pointer-state\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/storage-request\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/storage\\/indexed-db\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/storage\\/local-settings\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/download\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/recording\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/sample-editor\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/performance-engine\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/sequencer\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/midi\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/midi-file\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/audio-lifecycle\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/clocked-sequencer\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/slices\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/stem-pad-map\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/wav\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/effects\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/sample-library\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/performance-export\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/arrangement\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/stem-separation\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/vendor\\/stem-separation-engine\\.js\\?version=${htmlVersion}"`));
  assert.match(serviceWorker, new RegExp(`"\\.\\/vendor\\/htdemucs-separation-engine\\.js\\?version=${htmlVersion}"`));
  assert.match(stemSeparationModule, new RegExp(`new URL\\("\\.\\.\\/vendor\\/stem-separation-engine\\.js\\?version=${htmlVersion}"`));
  assert.match(stemSeparationModule, new RegExp(`new URL\\("\\.\\.\\/vendor\\/htdemucs-separation-engine\\.js\\?version=${htmlVersion}"`));
  assert.match(htdemucsEngine, /d54ed9eb60e258ea82131c6ee14578628816456a/);
  assert.match(htdemucsEngine, /d05c269d0178d2a72ad484b10b11dd370193fc923201c3b27a99f848745db70a/);
  assert.match(htdemucsEngine, /executionProviders: \["webgpu", "wasm"\]/);
  assert.match(htdemucsEngine, /new ort\.Tensor\("float32", input, \[1, 2, HTDEMUCS_SEGMENT_SAMPLES\]\)/);
  assert.match(htdemucsEngine, /wasmPaths = \{\s*mjs: new URL\("\.\/ort\/ort-wasm-simd-threaded\.asyncify\.mjs"/);
  assert.match(htdemucsEngine, /wasm: new URL\("\.\/ort\/ort-wasm-simd-threaded\.asyncify\.wasm"/);
  assert.match(htdemucsDsp, /createHtdemucsOverlapAdder/);
  assert.match(stemSeparationEngine, /requestAdapter\(\)/);
  assert.match(stemSeparationEngine, /wasmPaths = \{\s*mjs: new URL\("\.\/ort\/ort-wasm-simd-threaded\.asyncify\.mjs"/);
  assert.match(stemSeparationEngine, /wasm: new URL\("\.\/ort\/ort-wasm-simd-threaded\.asyncify\.wasm"/);
  for (const moduleName of ["history", "input-adapter", "migrations", "transport", "voice-registry"]) {
    assert.match(app, new RegExp(`${moduleName}\\.js\\?version=${htmlVersion}`));
    assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/${moduleName}\\.js\\?version=${htmlVersion}"`));
  }
});

test("syntax and aggregate validation include every browser module", () => {
  assert.match(packageJson.scripts["check:syntax"], /node --check app\.js/);
  assert.match(packageJson.scripts["check:syntax"], /node --check src\/bootstrap\.js/);
  assert.match(packageJson.scripts.validate, /npm run check:syntax/);
  assert.match(packageJson.scripts.validate, /test\/module-contract\.test\.mjs/);
  assert.match(packageJson.scripts.validate, /test\/stem-separation-dsp\.test\.mjs/);
  assert.match(packageJson.scripts["build:stem-engine"], /scripts\/build-stem-engine\.mjs/);
  assert.match(packageJson.scripts["check:syntax"], /src\/stem-separation-engine\.js/);
  assert.match(packageJson.scripts["check:syntax"], /src\/htdemucs-separation-engine\.js/);
  assert.match(packageJson.scripts["check:syntax"], /src\/htdemucs-separation-dsp\.js/);
  assert.match(packageJson.scripts.validate, /test\/htdemucs-separation-dsp\.test\.mjs/);
});

test("module graph validation catches missing imports and invalid syntax", (context) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "launchpad-module-contract-"));
  context.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

  fs.writeFileSync(path.join(fixtureRoot, "entry.js"), 'import "./missing.js";\n', "utf8");
  let result = validateModuleGraph(fixtureRoot, ["./entry.js"]);
  assert.deepEqual(result.failures, ["Browser module does not exist: missing.js"]);

  fs.writeFileSync(path.join(fixtureRoot, "broken.js"), "export const broken = ;\n", "utf8");
  fs.writeFileSync(path.join(fixtureRoot, "entry.js"), 'import "./broken.js";\n', "utf8");
  result = validateModuleGraph(fixtureRoot, ["./entry.js"]);
  assert.deepEqual(result.failures, ["Browser module has invalid syntax: broken.js"]);
});
