export const SCENE_IDS = ["scene-a", "scene-b"];
export const SCENE_QUANTIZE_VALUES = ["immediate", "beat", "bar"];

const DEFAULT_SCENE_NAMES = {
  "scene-a": "Scene A",
  "scene-b": "Scene B",
};

function boundedText(value, fallback, maximum = 32) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maximum) : fallback;
}

export function normalizeSceneId(value) {
  return SCENE_IDS.includes(value) ? value : "scene-a";
}

export function createArrangement() {
  return {
    schemaVersion: 1,
    launchQuantize: "bar",
    chainEnabled: false,
    chain: [...SCENE_IDS],
    names: { ...DEFAULT_SCENE_NAMES },
  };
}

export function normalizeArrangement(candidate) {
  const fallback = createArrangement();
  const chain = Array.isArray(candidate?.chain)
    ? candidate.chain.map(normalizeSceneId).filter((sceneId, index, values) => values.indexOf(sceneId) === index).slice(0, 16)
    : fallback.chain;
  return {
    schemaVersion: 1,
    launchQuantize: SCENE_QUANTIZE_VALUES.includes(candidate?.launchQuantize) ? candidate.launchQuantize : fallback.launchQuantize,
    chainEnabled: candidate?.chainEnabled === true && chain.length > 0,
    chain: chain.length ? chain : fallback.chain,
    names: {
      "scene-a": boundedText(candidate?.names?.["scene-a"], DEFAULT_SCENE_NAMES["scene-a"]),
      "scene-b": boundedText(candidate?.names?.["scene-b"], DEFAULT_SCENE_NAMES["scene-b"]),
    },
  };
}

export function parseSceneChain(value) {
  const parsed = String(value || "")
    .split(/[\s,>→|]+/u)
    .map((token) => token.toLowerCase())
    .map((token) => token === "a" || token === "scene-a" ? "scene-a" : token === "b" || token === "scene-b" ? "scene-b" : null)
    .filter(Boolean);
  return normalizeArrangement({ chain: parsed }).chain;
}

export function formatSceneChain(chain) {
  return normalizeArrangement({ chain }).chain.map((sceneId) => sceneId === "scene-a" ? "A" : "B").join(" → ");
}

export function getSceneName(arrangement, sceneId) {
  const normalized = normalizeArrangement(arrangement);
  return normalized.names[normalizeSceneId(sceneId)];
}

export function shouldLaunchAtStep(mode, stepIndex) {
  const normalizedMode = SCENE_QUANTIZE_VALUES.includes(mode) ? mode : "bar";
  const index = Math.max(0, Number(stepIndex) || 0);
  if (normalizedMode === "immediate") return true;
  if (normalizedMode === "beat") return index % 4 === 0;
  return index % 16 === 0;
}

export function getNextChainPosition(chain, currentSceneId, currentPosition = -1) {
  const normalizedChain = normalizeArrangement({ chain }).chain;
  const foundPosition = normalizedChain.indexOf(normalizeSceneId(currentSceneId));
  const position = Number.isInteger(currentPosition) && currentPosition >= 0
    ? currentPosition
    : (foundPosition >= 0 ? foundPosition : 0);
  return (position + 1) % normalizedChain.length;
}
