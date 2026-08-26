import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("pointer interruption cleanup is centralized and clears pressed styles", () => {
  assert.match(app, /function clearPointerState\(\) \{[\s\S]*pointerPadById\.clear\(\);[\s\S]*pointerIdByPad\.clear\(\);[\s\S]*querySelectorAll\("\.is-pressed"\)[\s\S]*classList\.remove\("is-pressed"\);[\s\S]*\}/);
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
  assert.match(app, /if \(pointerIdByPad\.has\(index\) \|\| pointerPadById\.has\(event\.pointerId\)\) return;/);
  assert.match(app, /button\.addEventListener\("pointercancel", \(event\) => releasePadPointer\(button, event\)\);/);
  assert.match(app, /button\.addEventListener\("lostpointercapture", \(event\) => releasePadPointer\(button, event\)\);/);
});
