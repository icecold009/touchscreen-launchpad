export function createVoiceRegistry({ maxVoices = 32, maxVoicesPerPad = 4 } = {}) {
  const voicesByPad = new Map();
  const metadata = new Map();
  let sequence = 0;
  const safeMaxVoices = Math.max(1, Math.floor(Number(maxVoices) || 32));
  const safeMaxPerPad = Math.max(1, Math.floor(Number(maxVoicesPerPad) || 4));

  function get(padIndex) {
    return voicesByPad.get(padIndex) || new Set();
  }

  function oldest(entries) {
    return [...entries]
      .map((voice) => ({ voice, entry: metadata.get(voice) }))
      .filter(({ entry }) => entry)
      .sort((left, right) => left.entry.sequence - right.entry.sequence)[0]?.voice;
  }

  function remove(padIndex, voice) {
    const voices = voicesByPad.get(padIndex);
    if (!voices?.delete(voice)) return false;
    metadata.delete(voice);
    if (!voices.size) voicesByPad.delete(padIndex);
    return true;
  }

  function add(padIndex, voice) {
    const stolen = [];
    let voices = voicesByPad.get(padIndex);
    if (!voices) {
      voices = new Set();
      voicesByPad.set(padIndex, voices);
    }

    while (voices.size >= safeMaxPerPad) {
      const victim = oldest(voices);
      if (!victim) break;
      remove(padIndex, victim);
      stolen.push({ padIndex, voice: victim, reason: "pad-limit" });
    }

    while (size() >= safeMaxVoices) {
      const allVoices = [...metadata.entries()];
      const victim = allVoices.sort((left, right) => left[1].sequence - right[1].sequence)[0];
      if (!victim) break;
      remove(victim[1].padIndex, victim[0]);
      stolen.push({ padIndex: victim[1].padIndex, voice: victim[0], reason: "global-limit" });
    }

    voices = voicesByPad.get(padIndex) || new Set();
    voices.add(voice);
    voicesByPad.set(padIndex, voices);
    metadata.set(voice, { padIndex, sequence: sequence++ });
    return { stolen };
  }

  function size() {
    return metadata.size;
  }

  function clear() {
    voicesByPad.clear();
    metadata.clear();
  }

  return {
    add,
    clear,
    get,
    remove,
    size,
    get byPad() {
      return voicesByPad;
    },
    entries() {
      return [...metadata.entries()].map(([voice, entry]) => ({ voice, ...entry }));
    },
  };
}
