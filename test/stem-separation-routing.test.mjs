import assert from "node:assert/strict";
import test from "node:test";
import { isHtdemucsBackendUnavailable } from "../src/stem-separation.js";

test("recognizes HT-Demucs backend and provider incompatibility errors", () => {
  for (const message of [
    "Could not find an implementation for ConstantOfShape(9) node",
    "provider type for node /real_istft/ConstantOfShape is not set",
    "std::bad_alloc",
    "no available backend found",
    "webgpuInit is not a function",
  ]) {
    assert.equal(isHtdemucsBackendUnavailable(new Error(message)), true, message);
  }
});

test("does not mask downloads, integrity checks, or unrelated failures as backend fallbacks", () => {
  for (const message of [
    "The HT-Demucs model could not be downloaded (503).",
    "The HT-Demucs model failed its size or integrity check. No stems were created.",
    "The local stem engine failed to load. Reload the site and try again.",
    "A decoded stereo song is required for stem separation.",
  ]) {
    assert.equal(isHtdemucsBackendUnavailable(new Error(message)), false, message);
  }
});
