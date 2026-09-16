import { normalizePattern } from "./sequencer.js";

export const MIDI_TICKS_PER_BEAT = 480;
const MAX_MIDI_EVENTS = 4096;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function integer(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function encodeVariableLength(value) {
  let remaining = clamp(integer(value), 0, 0x0fffffff);
  const bytes = [remaining & 0x7f];
  while ((remaining >>= 7) > 0) bytes.unshift((remaining & 0x7f) | 0x80);
  return bytes;
}

function pushUint16(target, value) {
  target.push((value >> 8) & 0xff, value & 0xff);
}

function pushUint32(target, value) {
  target.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function pushTextMeta(target, type, value) {
  const bytes = new TextEncoder().encode(String(value).slice(0, 120));
  target.push(0x00, 0xff, type, ...encodeVariableLength(bytes.length), ...bytes);
}

function createTrack(events, title) {
  const track = [];
  pushTextMeta(track, 0x03, title);
  let previousTick = 0;
  for (const event of events.slice(0, MAX_MIDI_EVENTS)) {
    const tick = Math.max(previousTick, integer(event.tick));
    track.push(...encodeVariableLength(tick - previousTick));
    track.push(event.status, clamp(integer(event.note), 0, 127), clamp(integer(event.velocity, 100), 1, 127));
    previousTick = tick;
  }
  track.push(0x00, 0xff, 0x2f, 0x00);
  return track;
}

function createTempoTrack(bpm, ticksPerBeat) {
  const track = [];
  const microsPerBeat = clamp(Math.round(60000000 / clamp(Number(bpm) || 120, 20, 400)), 150000, 3000000);
  track.push(0x00, 0xff, 0x51, 0x03, (microsPerBeat >> 16) & 0xff, (microsPerBeat >> 8) & 0xff, microsPerBeat & 0xff);
  track.push(0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08);
  track.push(0x00, 0xff, 0x2f, 0x00);
  return track;
}

function createSceneTrack(scene, padNotes, ticksPerBeat) {
  const normalized = normalizePattern(scene?.pattern);
  const stepTicks = ticksPerBeat / 4;
  const events = [];
  normalized.tracks.forEach((track) => {
    const note = clamp(integer(padNotes?.[track.padIndex], 36 + track.padIndex), 0, 127);
    track.steps.forEach((step, stepIndex) => {
      if (!step.on) return;
      const swingTicks = stepIndex % 2 === 1 ? normalized.swing * stepTicks : 0;
      const startTick = Math.max(0, integer(stepIndex * stepTicks + swingTicks + step.microTiming * stepTicks));
      const endTick = startTick + Math.max(1, integer(stepTicks * 0.75));
      const velocity = clamp(integer(64 + step.probability * 63), 1, 127);
      events.push({ tick: startTick, status: 0x90, note, velocity, order: 1 });
      events.push({ tick: endTick, status: 0x80, note, velocity: 0, order: 0 });
    });
  });
  events.sort((left, right) => left.tick - right.tick || left.order - right.order || left.note - right.note);
  return createTrack(events, scene?.name || "Scene");
}

export function createMidiFile({ scenes = [], padNotes = [], bpm = 120, ticksPerBeat = MIDI_TICKS_PER_BEAT } = {}) {
  const normalizedTicks = clamp(integer(ticksPerBeat, MIDI_TICKS_PER_BEAT), 48, 0x7fff);
  const tracks = [createTempoTrack(bpm, normalizedTicks), ...scenes.slice(0, 2).map((scene) => createSceneTrack(scene, padNotes, normalizedTicks))];
  const output = [0x4d, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06, 0x00, tracks.length > 1 ? 0x01 : 0x00];
  pushUint16(output, tracks.length);
  pushUint16(output, normalizedTicks);
  for (const track of tracks) {
    output.push(0x4d, 0x54, 0x72, 0x6b);
    pushUint32(output, track.length);
    output.push(...track);
  }
  return new Uint8Array(output);
}
