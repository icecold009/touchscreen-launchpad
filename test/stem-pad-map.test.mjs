import assert from "node:assert/strict";
import test from "node:test";

import { createStemPadAssignments } from "../src/stem-pad-map.js";

test("four ordered stems produce exactly four consecutive quarter regions each", () => {
  const assignments = createStemPadAssignments([
    { sampleId: "drums", label: "Drums" },
    { sampleId: "bass", label: "Bass" },
    { sampleId: "vocals", label: "Vocals" },
    { sampleId: "other", label: "Other" },
  ]);

  assert.equal(assignments.length, 16);
  assert.deepEqual(assignments.map(({ label, sampleId }) => [label, sampleId]), [
    ["Drums 1", "drums"], ["Drums 2", "drums"], ["Drums 3", "drums"], ["Drums 4", "drums"],
    ["Bass 1", "bass"], ["Bass 2", "bass"], ["Bass 3", "bass"], ["Bass 4", "bass"],
    ["Vocals 1", "vocals"], ["Vocals 2", "vocals"], ["Vocals 3", "vocals"], ["Vocals 4", "vocals"],
    ["Other 1", "other"], ["Other 2", "other"], ["Other 3", "other"], ["Other 4", "other"],
  ]);
  assert.deepEqual(assignments.slice(0, 4).map(({ sampleRegion }) => [sampleRegion.start, sampleRegion.end]), [
    [0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1],
  ]);
});

test("stem-pad mapping rejects incomplete or unsaved stem groups", () => {
  assert.throws(() => createStemPadAssignments([]), /exactly four stems/);
  assert.throws(() => createStemPadAssignments([{ sampleId: "drums" }, {}, {}, {}]), /saved audio sample/);
});
