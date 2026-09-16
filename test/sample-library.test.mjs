import assert from "node:assert/strict";
import test from "node:test";

import {
  createBatchAssignments,
  filterSampleRecords,
  getOrphanSampleIds,
  getSampleUsage,
  normalizeSampleLibraryMetadata,
} from "../src/sample-library.js";

test("sample metadata, filtering, and usage stay bounded", () => {
  assert.deepEqual(normalizeSampleLibraryMetadata({
    favorite: true,
    tags: [" drums ", "drums", "a".repeat(40)],
  }), { favorite: true, tags: ["drums", "a".repeat(24)] });
  const samples = [
    { id: "a", name: "Kick", size: 2, createdAt: "2026-01-01", libraryMeta: { favorite: true, tags: ["drums"] } },
    { id: "b", name: "Pad", size: 1, createdAt: "2026-01-02", libraryMeta: { tags: ["music"] } },
  ];
  assert.deepEqual(filterSampleRecords(samples, { favoritesOnly: true }).map((sample) => sample.id), ["a"]);
  assert.deepEqual(filterSampleRecords(samples, { query: "drums" }).map((sample) => sample.id), ["a"]);
  assert.deepEqual(getSampleUsage("a", [{ id: "kit-1", name: "Starter", pads: [{ sampleId: "a" }, {}] }]), [{ kitId: "kit-1", kitName: "Starter", padIndex: 0 }]);
  assert.deepEqual(getOrphanSampleIds(samples, [{ pads: [{ sampleId: "a" }] }]), ["b"]);
});

test("batch assignment maps a bounded selection onto pads", () => {
  assert.deepEqual(createBatchAssignments(["a", "b", "c"], 16, 2), [
    { sampleId: "a", padIndex: 2 },
    { sampleId: "b", padIndex: 3 },
    { sampleId: "c", padIndex: 4 },
  ]);
  assert.equal(createBatchAssignments(Array.from({ length: 20 }, (_, index) => String(index)), 16).length, 16);
});
