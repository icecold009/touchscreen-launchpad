function cloneValue(value) {
  if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function createHistory({ limit = 20, clone = cloneValue } = {}) {
  const past = [];
  const future = [];
  const safeLimit = Math.max(1, Math.floor(Number(limit) || 20));

  function push(state) {
    past.push(clone(state));
    if (past.length > safeLimit) past.splice(0, past.length - safeLimit);
    future.length = 0;
  }

  function undo(currentState) {
    if (!past.length) return { changed: false, state: clone(currentState) };
    const previous = past.pop();
    future.push(clone(currentState));
    return { changed: true, state: clone(previous) };
  }

  function redo(currentState) {
    if (!future.length) return { changed: false, state: clone(currentState) };
    const next = future.pop();
    past.push(clone(currentState));
    return { changed: true, state: clone(next) };
  }

  return {
    clear() {
      past.length = 0;
      future.length = 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    get canUndo() {
      return past.length > 0;
    },
    get length() {
      return past.length;
    },
    push,
    redo,
    undo,
  };
}
