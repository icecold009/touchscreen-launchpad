const INPUT_ACTIONS = new Set(["trigger", "release"]);
const INPUT_KINDS = new Set(["pointer", "keyboard", "midi", "sequencer"]);

export function normalizeInputEvent(candidate = {}, padCount = 16) {
  const padIndex = Number(candidate.padIndex);
  if (!Number.isInteger(padIndex) || padIndex < 0 || padIndex >= padCount) return null;

  const velocity = Number(candidate.velocity);
  const pressure = Number(candidate.pressure);
  return {
    action: INPUT_ACTIONS.has(candidate.action) ? candidate.action : "trigger",
    kind: INPUT_KINDS.has(candidate.kind) ? candidate.kind : "keyboard",
    padIndex,
    pointerId: Number.isInteger(candidate.pointerId) ? candidate.pointerId : null,
    velocity: Number.isFinite(velocity) ? Math.min(1, Math.max(0, velocity)) : 1,
    pressure: Number.isFinite(pressure) ? Math.min(1, Math.max(0, pressure)) : 0,
    timestamp: Number.isFinite(Number(candidate.timestamp)) ? Number(candidate.timestamp) : 0,
  };
}

export function createInputAdapter({ padCount = 16, onInput = () => {} } = {}) {
  const listeners = new Set();

  function emit(candidate) {
    const event = normalizeInputEvent(candidate, padCount);
    if (!event) return null;
    onInput(event);
    for (const listener of listeners) listener(event);
    return event;
  }

  return {
    emit,
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
