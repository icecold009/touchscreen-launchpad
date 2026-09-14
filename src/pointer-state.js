export function createPointerState() {
  const pointerPadById = new Map();
  const pointerIdByPad = new Map();

  return {
    activeEntries() {
      return [...pointerPadById].map(([pointerId, index]) => ({ pointerId, index }));
    },

    claim(pointerId, index) {
      if (pointerIdByPad.has(index) || pointerPadById.has(pointerId)) return false;
      pointerIdByPad.set(index, pointerId);
      pointerPadById.set(pointerId, index);
      return true;
    },

    release(pointerId, index) {
      const ownsPointer = pointerPadById.get(pointerId) === index;
      const ownsPad = pointerIdByPad.get(index) === pointerId;

      if (ownsPointer) pointerPadById.delete(pointerId);
      if (ownsPad) pointerIdByPad.delete(index);

      return {
        ownsPointer,
        ownsPad,
        shouldClearPressed: ownsPointer || ownsPad || !pointerIdByPad.has(index),
      };
    },

    clear() {
      pointerPadById.clear();
      pointerIdByPad.clear();
    },
  };
}
