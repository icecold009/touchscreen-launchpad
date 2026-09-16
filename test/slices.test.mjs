import assert from "node:assert/strict";
import test from "node:test";

import { MAX_SLICE_COUNT, createEvenSlices, normalizeSliceDefinitions, updateSliceDefinition } from "../src/slices.js";

test("slice banks are bounded and evenly cover a source", () => {
  const slices = createEvenSlices(4);
  assert.equal(slices.length, 4);
  assert.deepEqual(slices[0], { id: "slice-1", label: "Slice 1", start: 0, end: 0.25 });
  assert.equal(slices.at(-1).end, 1);
  assert.equal(createEvenSlices(99).length, MAX_SLICE_COUNT);
});

test("slice metadata normalizes unsafe ids, labels, and regions", () => {
  const slices = normalizeSliceDefinitions([
    { id: "../bad", label: "  Intro  ", start: 0.8, end: 0.2 },
    { id: "slice-1", start: -1, end: 2 },
  ]);
  assert.equal(slices[0].id, "slice-1");
  assert.equal(slices[0].label, "Intro");
  assert.equal(slices[0].start, 0.8);
  assert.equal(slices[0].end, 0.8001);
  assert.equal(slices[1].id, "slice-2");
  assert.deepEqual(slices[1], { id: "slice-2", label: "Slice 2", start: 0, end: 1 });
});

test("slice marker edits stay ordered and preserve unrelated markers", () => {
  const original = createEvenSlices(2);
  const edited = updateSliceDefinition(original, 0, { start: 0.7, end: 0.4, label: "Drop" });
  assert.equal(edited[0].start, 0.7);
  assert.equal(edited[0].end, 0.7001);
  assert.equal(edited[0].label, "Drop");
  assert.deepEqual(edited[1], original[1]);
  assert.deepEqual(updateSliceDefinition(original, 99, { start: 0.2 }), original);
});
