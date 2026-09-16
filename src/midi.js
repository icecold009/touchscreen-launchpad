export const DEFAULT_MIDI_BASE_NOTE = 36;
const MIDI_TARGETS = new Set(["masterVolume", "warmth", "space", "punch", "tempo"]);
const MIDI_MESSAGE_COMMANDS = new Set(["controlchange", "channelaftertouch", "polyaftertouch"]);

export function normalizeMidiMapping(candidate = {}, fallbackNote = null) {
  const note = Number(candidate.note ?? fallbackNote);
  const channel = candidate.channel === null || candidate.channel === undefined || candidate.channel === "" ? null : Number(candidate.channel);
  return {
    note: Number.isInteger(note) && note >= 0 && note <= 127 ? note : null,
    channel: Number.isInteger(channel) && channel >= 0 && channel <= 15 ? channel : null,
  };
}

export function normalizeMidiControllerMapping(candidate = {}, index = 0) {
  const type = candidate.type === "aftertouch" ? "aftertouch" : "cc";
  const controller = Number(candidate.controller);
  const channel = candidate.channel === null || candidate.channel === undefined || candidate.channel === "" ? null : Number(candidate.channel);
  const safeId = typeof candidate.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(candidate.id)
    ? candidate.id
    : `controller-${index + 1}`;
  return {
    id: safeId,
    type,
    controller: type === "cc" && Number.isInteger(controller) && controller >= 0 && controller <= 127 ? controller : null,
    channel: Number.isInteger(channel) && channel >= 0 && channel <= 15 ? channel : null,
    target: MIDI_TARGETS.has(candidate.target) ? candidate.target : "masterVolume",
    enabled: candidate.enabled !== false,
  };
}

export function normalizeMidiConfig(candidate = {}) {
  const mappings = Array.isArray(candidate.controllerMappings)
    ? candidate.controllerMappings.slice(0, 12).map((mapping, index) => normalizeMidiControllerMapping(mapping, index))
    : [];
  const uniqueMappings = [];
  const ids = new Set();
  for (const mapping of mappings) {
    if (ids.has(mapping.id)) continue;
    ids.add(mapping.id);
    uniqueMappings.push(mapping);
  }
  return {
    profileName: typeof candidate.profileName === "string" && candidate.profileName.trim()
      ? candidate.profileName.trim().slice(0, 40)
      : "Default profile",
    inputId: typeof candidate.inputId === "string" ? candidate.inputId.slice(0, 128) : "",
    outputId: typeof candidate.outputId === "string" ? candidate.outputId.slice(0, 128) : "",
    clockIn: candidate.clockIn === true,
    clockOut: candidate.clockOut === true,
    controllerMappings: uniqueMappings,
  };
}

export function parseMidiMessage(data) {
  const bytes = [...(data || [])].map((value) => Number(value) & 0xff);
  if (!bytes.length) return null;
  const status = bytes[0];
  const realtime = {
    0xf8: "clock",
    0xfa: "start",
    0xfb: "continue",
    0xfc: "stop",
  }[status];
  if (realtime) return { command: realtime, channel: null, note: null, velocity: 0, value: 0 };
  if (bytes.length < 2) return null;
  const command = status & 0xf0;
  const channel = status & 0x0f;
  if (![0x80, 0x90, 0xa0, 0xb0, 0xd0].includes(command)) return null;
  const note = bytes[1];
  const value = bytes[2] || 0;
  if (command === 0xd0) {
    return { command: "channelaftertouch", channel, note: null, velocity: note / 127, value: note };
  }
  if (command === 0xa0) {
    return { command: "polyaftertouch", channel, note, velocity: value / 127, value };
  }
  return {
    command: command === 0xb0 ? "controlchange" : command === 0x90 && value > 0 ? "noteon" : "noteoff",
    channel,
    note,
    velocity: command === 0xb0 ? value / 127 : value / 127,
    value,
  };
}

export function getMidiControllerValue(message, mapping) {
  if (!message || !mapping || !MIDI_MESSAGE_COMMANDS.has(message.command)) return null;
  const normalized = normalizeMidiControllerMapping(mapping);
  if (!normalized.enabled) return null;
  if (normalized.channel !== null && normalized.channel !== message.channel) return null;
  if (normalized.type === "cc" && (message.command !== "controlchange" || normalized.controller !== message.note)) return null;
  if (normalized.type === "aftertouch" && !["channelaftertouch", "polyaftertouch"].includes(message.command)) return null;
  return Math.max(0, Math.min(1, Number(message.value) / 127));
}

export function getMidiMappingConflicts(pads, candidate, ignoredIndex = -1) {
  const normalized = normalizeMidiMapping(candidate);
  if (normalized.note === null) return [];
  return (pads || []).flatMap((pad, index) => {
    if (index === ignoredIndex) return [];
    const mapping = normalizeMidiMapping(pad?.midi);
    const channelOverlaps = mapping.channel === null || normalized.channel === null || mapping.channel === normalized.channel;
    return mapping.note === normalized.note && channelOverlaps ? [index] : [];
  });
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

export function createMidiControllerMessage(type, controller, value = 0, channel = 0) {
  const safeChannel = Math.max(0, Math.min(15, Number(channel) || 0));
  const safeValue = Math.max(0, Math.min(127, Math.round(Number(value) || 0)));
  if (type === "aftertouch") return [0xd0 | safeChannel, safeValue];
  return [0xb0 | safeChannel, Math.max(0, Math.min(127, Math.round(Number(controller) || 0))), safeValue];
}

export function createMidiClockMessage(command = "clock") {
  return [{ clock: 0xf8, start: 0xfa, continue: 0xfb, stop: 0xfc }[command] || 0xf8];
}

export function createMidiClockTracker({ onTempo = () => {} } = {}) {
  let running = false;
  let pulseCount = 0;
  let previousQuarterAt = null;
  let tempo = null;
  return {
    get running() {
      return running;
    },
    get tempo() {
      return tempo;
    },
    start() {
      running = true;
      pulseCount = 0;
      previousQuarterAt = null;
    },
    stop() {
      running = false;
      pulseCount = 0;
      previousQuarterAt = null;
    },
    tick(timestamp) {
      if (!running) running = true;
      pulseCount += 1;
      if (pulseCount < 24) return tempo;
      const now = Number(timestamp);
      if (Number.isFinite(now) && previousQuarterAt !== null) {
        const elapsed = now - previousQuarterAt;
        if (elapsed >= 250 && elapsed <= 1500) {
          tempo = Math.max(40, Math.min(240, 60000 / elapsed));
          onTempo(tempo);
        }
      }
      if (Number.isFinite(now)) previousQuarterAt = now;
      pulseCount = 0;
      return tempo;
    },
  };
}

export function createMidiLearnState({ onLearned = () => {} } = {}) {
  let active = false;
  let kind = "note";
  return {
    get active() {
      return active;
    },
    get kind() {
      return kind;
    },
    cancel() {
      active = false;
    },
    start({ mode = "note" } = {}) {
      active = true;
      kind = mode === "controller" ? "controller" : "note";
    },
    handle(message) {
      const noteMessage = message?.command === "noteon" || message?.command === "noteoff";
      const controllerMessage = MIDI_MESSAGE_COMMANDS.has(message?.command);
      if (!active || !message || (kind === "note" ? !noteMessage : !controllerMessage)) return false;
      active = false;
      onLearned(kind === "note" ? { note: message.note, channel: message.channel } : message);
      return true;
    },
  };
}
