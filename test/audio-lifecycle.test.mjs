import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("audio startup reports suspended, closed, and unavailable context states", () => {
  assert.match(app, /if \(context\.state === "closed"\) throw new Error\("Audio is unavailable\./);
  assert.match(app, /if \(context\.state === "suspended"\) \{[\s\S]*await context\.resume\(\);[\s\S]*Audio is suspended/);
  assert.match(app, /if \(context\.state !== "running"\) throw new Error\("Audio is unavailable/);
});

test("failed voice starts release their registered state", () => {
  assert.match(app, /function startRegisteredVoice\(index, voice, startAt, stopAt\) \{[\s\S]*voice\.source\.start\(startAt\);[\s\S]*voice\.source\.stop\(stopAt\);[\s\S]*releaseVoice\(index, voice\);/);
  assert.match(app, /sample\.bufferPromise = undefined;/);
});

test("visibility and stop-all invalidate pending playback without changing controls", () => {
  assert.match(app, /stopAll\(\{ announce: false \}\);/);
  assert.match(app, /playbackGeneration \+= 1;/);
  assert.match(app, /pendingPads\.clear\(\);/);
  assert.match(app, /Tempo \$\{tempo\} BPM · Quantize \$\{quantizeState\}\./);
});

test("rapid informational playback announcements are throttled", () => {
  assert.match(app, /function setPlaybackStatus\(message, type = "info", \{ force = false \} = \{\}\)/);
  assert.match(app, /now - lastPlaybackStatusAt < 250/);
});
