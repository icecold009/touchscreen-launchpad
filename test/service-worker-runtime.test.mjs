import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serviceWorkerSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const shellVersion = serviceWorkerSource.match(/touchscreen-launchpad-v(\d+)/)?.[1];
const assetVersion = htmlSource.match(/bootstrap\.js\?version=(\d+)/)?.[1];

function createServiceWorkerHarness() {
  const listeners = new Map();
  const cacheRecords = new Map();
  const deletedCaches = [];
  const lifecycleCalls = [];
  const networkRequests = [];

  const caches = {
    async open(name) {
      if (!cacheRecords.has(name)) {
        cacheRecords.set(name, { added: [], responses: new Map([["./index.html", "cached-index"]]) });
      }
      const record = cacheRecords.get(name);
      return {
        async addAll(references) {
          record.added.push(...references);
        },
        async match(request) {
          const key = typeof request === "string" ? request : request.url;
          return record.responses.get(key);
        },
        async put(request, response) {
          const key = typeof request === "string" ? request : request.url;
          record.responses.set(key, response);
        },
      };
    },
    async keys() {
      return [...cacheRecords.keys()];
    },
    async delete(name) {
      deletedCaches.push(name);
      return cacheRecords.delete(name);
    },
    async match(request) {
      const key = typeof request === "string" ? request : request.url;
      for (const record of cacheRecords.values()) {
        if (record.responses.has(key)) return record.responses.get(key);
      }
      return undefined;
    },
  };

  const self = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    skipWaiting() {
      lifecycleCalls.push("skipWaiting");
      return Promise.resolve();
    },
    clients: {
      claim() {
        lifecycleCalls.push("claim");
        return Promise.resolve();
      },
    },
  };

  const onlineResponses = new Map();
  const context = vm.createContext({
    self,
    caches,
    Response: { error: () => ({ type: "error" }) },
    fetch: async (request) => {
      networkRequests.push(request);
      const url = typeof request === "string" ? request : request.url;
      if (onlineResponses.has(url)) return onlineResponses.get(url);
      throw new Error("offline");
    },
  });
  vm.runInContext(serviceWorkerSource, context, { filename: "sw.js" });

  return { listeners, cacheRecords, deletedCaches, lifecycleCalls, networkRequests, onlineResponses };
}

async function dispatchLifecycle(listeners, type, event = {}) {
  const waits = [];
  listeners.get(type)({ ...event, waitUntil(promise) { waits.push(promise); } });
  await Promise.all(waits);
}

test("install caches the complete versioned shell and activates immediately", async () => {
  const harness = createServiceWorkerHarness();
  await dispatchLifecycle(harness.listeners, "install");

  const currentCache = [...harness.cacheRecords.values()][0];
  assert.ok(shellVersion);
  assert.ok(assetVersion);
  assert.ok(Number(shellVersion) > Number(assetVersion));
  assert.ok(currentCache.added.includes(`./src/bootstrap.js?version=${assetVersion}`));
  assert.ok(currentCache.added.includes(`./app.js?version=${assetVersion}`));
  assert.ok(currentCache.added.includes(`./src/storage/indexed-db.js?version=${assetVersion}`));
  assert.ok(currentCache.added.includes(`./src/storage/local-settings.js?version=${assetVersion}`));
  assert.deepEqual(harness.lifecycleCalls, ["skipWaiting"]);
});

test("activate removes stale caches and claims clients", async () => {
  const harness = createServiceWorkerHarness();
  harness.cacheRecords.set("touchscreen-launchpad-v15", { added: [], responses: new Map() });
  harness.cacheRecords.set("unrelated-app-cache", { added: [], responses: new Map() });
  await dispatchLifecycle(harness.listeners, "activate");

  assert.deepEqual(harness.deletedCaches, ["touchscreen-launchpad-v15"]);
  assert.ok(harness.cacheRecords.has("unrelated-app-cache"));
  assert.deepEqual(harness.lifecycleCalls, ["claim"]);
});

test("fetches fresh navigations, falls back offline, and rejects offline assets", async () => {
  const harness = createServiceWorkerHarness();
  await dispatchLifecycle(harness.listeners, "install");

  const freshResponse = { ok: true, clone: () => "fresh-index" };
  harness.onlineResponses.set("https://example.test/live", freshResponse);
  const navigationResponses = [];
  harness.listeners.get("fetch")({
    request: { method: "GET", mode: "navigate", destination: "document", url: "https://example.test/live" },
    respondWith(promise) { navigationResponses.push(promise); },
  });
  assert.equal(await navigationResponses[0], freshResponse);
  assert.equal([...harness.cacheRecords.values()][0].responses.get("https://example.test/live"), "fresh-index");

  harness.onlineResponses.clear();
  const offlineNavigationResponses = [];
  harness.listeners.get("fetch")({
    request: { method: "GET", mode: "navigate", destination: "document", url: "https://example.test/deep-link" },
    respondWith(promise) { offlineNavigationResponses.push(promise); },
  });
  assert.equal(await offlineNavigationResponses[0], "cached-index");

  const assetResponses = [];
  harness.listeners.get("fetch")({
    request: { method: "GET", mode: "no-cors", destination: "script", url: "https://example.test/missing.js" },
    respondWith(promise) { assetResponses.push(promise); },
  });
  assert.deepEqual(await assetResponses[0], { type: "error" });
  assert.equal(harness.networkRequests.length, 3);

  const postEvent = { request: { method: "POST", mode: "navigate", destination: "document", url: "https://example.test/submit" }, respondWith() { throw new Error("POST must not be intercepted"); } };
  harness.listeners.get("fetch")(postEvent);
});
