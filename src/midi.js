export const DEFAULT_MIDI_BASE_NOTE = 36;

export function normalizeMidiMapping(candidate = {}, fallbackNote = null) {
  const note = Number(candidate.note ?? fallbackNote);
  const channel = Number(candidate.channel);
  return {
    note: Number.isInteger(note) && note >= 0 && note <= 127 ? note : null,
    channel: Number.isInteger(channel) && channel >= 0 && channel <= 15 ? channel : null,
  };
}

export function parseMidiMessage(data) {
  const bytes = [...(data || [])].map((value) => Number(value) & 0xff);
  if (bytes.length < 2) return null;
  const status = bytes[0];
  const command = status & 0xf0;
  const channel = status & 0x0f;
  if (command !== 0x80 && command !== 0x90 && command !== 0xb0) return null;
  const note = bytes[1];
  const value = bytes[2] || 0;
  return {
    command: command === 0xb0 ? "controlchange" : command === 0x90 && value > 0 ? "noteon" : "noteoff",
    channel,
    note,
    velocity: command === 0xb0 ? value / 127 : value / 127,
    value,
  };
}

export function getPadIndexForMidiNote(pads, note, { baseNote = DEFAULT_MIDI_BASE_NOTE, channel = null } = {}) {
  const explicit = pads.findIndex((pad) => {
    const mapping = normalizeMidiMapping(pad?.midi);
    return mapping.note === note && (mapping.channel === null || mapping.channel === channel);
  });
  if (explicit >= 0) return explicit;
  const fallback = Number(note) - Number(baseNote);
  return Number.isInteger(fallback) && fallback >= 0 && fallback < pads.length ? fallback : -1;
}

export function createMidiNoteMessage(command, note, velocity = 1, channel = 0) {
  const status = (command === "noteoff" ? 0x80 : 0x90) | (Math.max(0, Math.min(15, channel)) & 0x0f);
  return [status, Math.max(0, Math.min(127, Math.round(note))), Math.max(0, Math.min(127, Math.round(velocity * 127)))];
}

export function createMidiLearnState({ onLearned = () => {} } = {}) {
  let active = false;
  return {
    get active() {
      return active;
    },
    cancel() {
      active = false;
    },
    start() {
      active = true;
    },
    handle(message) {
      if (!active || !message || (message.command !== "noteon" && message.command !== "noteoff")) return false;
      active = false;
      onLearned({ note: message.note, channel: message.channel });
      return true;
    },
  };
}
