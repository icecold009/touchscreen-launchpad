import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createPointerState } from "../src/pointer-state.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("pointer interruption cleanup is centralized and clears pressed styles", () => {
  assert.match(app, /function clearPointerState\(\) \{[\s\S]*pointerState\.activeEntries\(\)[\s\S]*pointerState\.clear\(\);[\s\S]*querySelectorAll\("\.is-pressed"\)[\s\S]*classList\.remove\("is-pressed"\);[\s\S]*\}/);
  assert.match(app, /button\?\.hasPointerCapture\?\.\(pointerId\)[\s\S]*button\.releasePointerCapture\(pointerId\);/);
  assert.match(app, /function handleVisibilityChange\(\) \{[\s\S]*document\.hidden[\s\S]*document\.visibilityState === "hidden"[\s\S]*clearPointerState\(\);/);
  assert.match(app, /function renderPads\(\) \{\s*clearPointerState\(\);\s*padGrid\.replaceChildren\(\);/);
});

test("pointer lifecycle listeners cover hidden, blur, pagehide, and orientation interruption", () => {
  assert.match(app, /document\.addEventListener\("visibilitychange", handleVisibilityChange\);/);
  for (const eventName of ["blur", "orientationchange"]) {
    assert.match(app, new RegExp(`window\\.addEventListener\\("${eventName}", clearPointerState\\);`));
  }
  assert.match(app, /window\.addEventListener\("pagehide", \(\) => \{[\s\S]*clearPointerState\(\);[\s\S]*stopAll\(\{ announce: false \}\);/);
});

test("pointer ownership rejects duplicate pointer or pad claims", () => {
  assert.match(app, /if \(!pointerState\.claim\(event\.pointerId, index\)\) return;/);
  assert.match(app, /button\.addEventListener\("pointercancel", \(event\) => releasePadPointer\(button, event\)\);/);
  assert.match(app, /button\.addEventListener\("lostpointercapture", \(event\) => releasePadPointer\(button, event\)\);/);
});

test("pointer ownership handles duplicate claims, mismatched releases, and interruption clearing", () => {
  const state = createPointerState();

  assert.equal(state.claim(7, 2), true);
  assert.equal(state.claim(8, 2), false);
  assert.equal(state.claim(7, 3), false);
  assert.deepEqual(state.release(8, 2), {
    ownsPointer: false,
    ownsPad: false,
    shouldClearPressed: false,
  });
  assert.deepEqual(state.release(7, 2), {
    ownsPointer: true,
    ownsPad: true,
    shouldClearPressed: true,
  });

  assert.equal(state.claim(7, 3), true);
  assert.equal(state.claim(9, 4), true);
  assert.deepEqual(state.activeEntries(), [
    { pointerId: 7, index: 3 },
    { pointerId: 9, index: 4 },
  ]);
  state.clear();
  assert.deepEqual(state.activeEntries(), []);
});
