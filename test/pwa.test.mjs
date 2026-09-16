import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const pagesWorkflow = fs.readFileSync(path.join(root, ".github", "workflows", "pages.yml"), "utf8");

test("the app reports service-worker updates and reloads after controller change", () => {
  assert.match(app, /const hadController = Boolean\(navigator\.serviceWorker\.controller\);/);
  assert.match(app, /registration\.waiting && hadController/);
  assert.match(app, /navigator\.serviceWorker\.addEventListener\("controllerchange"/);
  assert.match(app, /Launchpad updated for offline use\. Reloading…/);
  assert.match(app, /window\.location\.reload\(\);/);
});

test("the service worker caches a versioned shell and only falls back to HTML for navigations", () => {
  assert.match(serviceWorker, /const CACHE_NAME = "touchscreen-launchpad-v\d+";/);
  assert.match(serviceWorker, /"\.\/src\/bootstrap\.js\?version=\d+"/);
  assert.match(serviceWorker, /"\.\/app\.js\?version=\d+"/);
  assert.match(serviceWorker, /self\.skipWaiting\(\)/);
  assert.match(serviceWorker, /self\.clients\.claim\(\)/);
  assert.match(serviceWorker, /const CACHE_PREFIX = "touchscreen-launchpad-";/);
  assert.match(serviceWorker, /cacheName\.startsWith\(CACHE_PREFIX\)/);
  assert.match(serviceWorker, /caches\.open\(CACHE_NAME\)/);
  assert.match(serviceWorker, /const isNavigationRequest = event\.request\.mode === "navigate"/);
  assert.match(serviceWorker, /isNavigationRequest[\s\S]*caches\.open\(CACHE_NAME\)/);
  for (const moduleName of ["history", "input-adapter", "migrations", "recording", "transport", "voice-registry"]) {
    assert.match(serviceWorker, new RegExp(`"\\.\\/src\\/${moduleName}\\.js\\?version=\\d+"`));
  }
});

test("manifest and app shell use relative installable-PWA metadata", () => {
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.length > 0);
  assert.match(html, /<link rel="manifest" href="manifest\.webmanifest" \/>/);
  assert.match(html, /<meta name="theme-color" content="#f5f5f7" \/>/);
});

test("Pages validates and stages the same module graph that local checks exercise", () => {
  assert.match(pagesWorkflow, /npm run validate/);
  assert.match(pagesWorkflow, /cp -R src _site\/src/);
  assert.doesNotMatch(pagesWorkflow, /codex\/launchpad-\*/);
  assert.match(pagesWorkflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(pagesWorkflow, /actions\/checkout@[0-9a-f]{40}/g);
  assert.match(pagesWorkflow, /actions\/configure-pages@[0-9a-f]{40}/);
  assert.match(pagesWorkflow, /actions\/upload-pages-artifact@[0-9a-f]{40}/);
  assert.match(pagesWorkflow, /actions\/deploy-pages@[0-9a-f]{40}/);
});
