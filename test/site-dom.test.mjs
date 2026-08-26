import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function hasId(id) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<[^>]*\\bid=["']${escapedId}["']`, "i").test(html);
}

test("the launchpad DOM exposes its primary interaction surface", () => {
  const requiredIds = [
    "pad-grid",
    "status",
    "stop-all",
    "pad-editor",
    "sample-file",
    "save-layout",
    "export-layout",
    "import-layout",
    "reset-layout",
    "sample-search",
    "install-app",
  ];

  for (const id of requiredIds) {
    assert.equal(hasId(id), true, `index.html is missing #${id}`);
  }
});

test("the DOM loads the app as a module and keeps the static delivery model", () => {
  assert.match(html, /<script[^>]+type=["']module["'][^>]+src=["']app\.js(?:\?[^"']*)?["']/i);
  assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*(?:bundle|dist|build)[^"']*["']/i);
});
