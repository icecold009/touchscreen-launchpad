import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("downloads keep object URLs alive through delayed browser start and clean up", () => {
  assert.match(app, /function downloadText\(filename, content, mimeType\)/);
  assert.match(app, /document\.body\.append\(link\);/);
  assert.match(app, /try \{\s*link\.click\(\);\s*\} finally \{/);
  assert.match(app, /window\.setTimeout\(\(\) => \{\s*link\.remove\(\);\s*URL\.revokeObjectURL\(url\);/);
});

test("export and import surface file failures without discarding layout state", () => {
  assert.match(app, /function exportLayout\(\)/);
  assert.match(app, /Layout export failed\. Check browser download permissions and try again\./);
  assert.match(app, /const parsedLayout = JSON\.parse\(await file\.text\(\)\);/);
  assert.match(app, /if \(!saveLayout\("Layout imported and saved\."\)\) \{[\s\S]*pads = previousPads;/);
  assert.match(app, /Layout import failed; your existing layout was preserved\./);
});

test("imports validate schema, pad count, and missing local sample bytes", () => {
  assert.match(app, /function validateImportedLayout\(parsedLayout\)/);
  assert.match(app, /parsedLayout\.version !== 1/);
  assert.match(app, /parsedLayout\.pads\.length !== PAD_COUNT/);
  assert.match(app, /const missingSampleIds = \[\.\.\.new Set\(importedPads\.map\(\(pad\) => pad\.sampleId\)\.filter\(Boolean\)\)\]/);
  assert.match(app, /assigned \$\{sampleWord\} missing in this browser/);
});

test("saving returns an explicit result for import rollback", () => {
  assert.match(app, /setStatus\(storageMode === "memory" \? `\$\{message\} Memory-only mode: a reload may discard changes\.\` : message, storageMode === "memory" \? "error" : "success"\);\s*return true;/);
  assert.match(app, /setStatus\("This browser could not save the layout\.", "error"\);\s*return false;/);
});
