import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serviceWorkerSource = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const shellVersion = serviceWorkerSource.match(/touchscreen-launchpad-v(\d+)/)?.[1];

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

  const context = vm.createContext({
    self,
    caches,
    Response: { error: () => ({ type: "error" }) },
    fetch: async (request) => {
      networkRequests.push(request);
      throw new Error("offline");
    },
  });
  vm.runInContext(serviceWorkerSource, context, { filename: "sw.js" });

  return { listeners, cacheRecords, deletedCaches, lifecycleCalls, networkRequests };
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
  assert.ok(currentCache.added.includes(`./src/bootstrap.js?version=${shellVersion}`));
  assert.ok(currentCache.added.includes(`./app.js?version=${shellVersion}`));
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

test("fetch preserves cached responses, falls back for navigations, and rejects offline assets", async () => {
  const harness = createServiceWorkerHarness();
  await dispatchLifecycle(harness.listeners, "install");

  const navigationResponses = [];
  harness.listeners.get("fetch")({
    request: { method: "GET", mode: "navigate", destination: "document", url: "https://example.test/deep-link" },
    respondWith(promise) { navigationResponses.push(promise); },
  });
  assert.equal(await navigationResponses[0], "cached-index");

  const assetResponses = [];
  harness.listeners.get("fetch")({
    request: { method: "GET", mode: "no-cors", destination: "script", url: "https://example.test/missing.js" },
    respondWith(promise) { assetResponses.push(promise); },
  });
  assert.deepEqual(await assetResponses[0], { type: "error" });
  assert.equal(harness.networkRequests.length, 2);

  const postEvent = { request: { method: "POST", mode: "navigate", destination: "document", url: "https://example.test/submit" }, respondWith() { throw new Error("POST must not be intercepted"); } };
  harness.listeners.get("fetch")(postEvent);
});
