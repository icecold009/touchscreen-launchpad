import assert from "node:assert/strict";
import test from "node:test";

import {
  createArrangement,
  formatSceneChain,
  getNextChainPosition,
  getSceneName,
  normalizeArrangement,
  parseSceneChain,
  shouldLaunchAtStep,
} from "../src/arrangement.js";

test("arrangement settings stay bounded and preserve useful defaults", () => {
  const arrangement = normalizeArrangement({
    launchQuantize: "invalid",
    chainEnabled: true,
    chain: ["scene-b", "scene-b", "not-a-scene"],
    names: { "scene-a": "  Intro  ", "scene-b": "" },
  });
  assert.equal(arrangement.launchQuantize, "bar");
  assert.deepEqual(arrangement.chain, ["scene-b", "scene-a"]);
  assert.equal(arrangement.names["scene-a"], "Intro");
  assert.equal(arrangement.names["scene-b"], "Scene B");
  assert.equal(getSceneName(arrangement, "scene-b"), "Scene B");
  assert.deepEqual(createArrangement().chain, ["scene-a", "scene-b"]);
});

test("scene chains parse human input and advance deterministically", () => {
  const chain = parseSceneChain("A, B > A");
  assert.deepEqual(chain, ["scene-a", "scene-b"]);
  assert.equal(formatSceneChain(chain), "A → B");
  assert.equal(getNextChainPosition(chain, "scene-a", 0), 1);
  assert.equal(getNextChainPosition(chain, "scene-b", 1), 0);
});

test("scene launch quantization chooses beat or bar boundaries", () => {
  assert.equal(shouldLaunchAtStep("immediate", 3), true);
  assert.equal(shouldLaunchAtStep("beat", 4), true);
  assert.equal(shouldLaunchAtStep("beat", 5), false);
  assert.equal(shouldLaunchAtStep("bar", 15), false);
  assert.equal(shouldLaunchAtStep("bar", 16), true);
});
