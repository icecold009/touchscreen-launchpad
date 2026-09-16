export const MAX_SLICE_COUNT = 16;
const MIN_SLICE_LENGTH = 0.0001;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeSliceId(value, index) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : `slice-${index + 1}`;
}

function normalizeSlice(candidate, index) {
  const value = candidate && typeof candidate === "object" ? candidate : {};
  const start = clamp(Number.isFinite(Number(value.start)) ? Number(value.start) : 0, 0, 1);
  const end = Math.max(start + MIN_SLICE_LENGTH, clamp(Number.isFinite(Number(value.end)) ? Number(value.end) : 1, 0, 1));
  return {
    id: normalizeSliceId(value.id, index),
    label: typeof value.label === "string" && value.label.trim() ? value.label.trim().slice(0, 32) : `Slice ${index + 1}`,
    start,
    end: Math.min(1, end),
  };
}

export function normalizeSliceDefinitions(value) {
  if (!Array.isArray(value)) return [];
  const ids = new Set();
  return value.slice(0, MAX_SLICE_COUNT).map((candidate, index) => {
    const slice = normalizeSlice(candidate, index);
    let id = slice.id;
    if (ids.has(id)) id = `slice-${index + 1}`;
    ids.add(id);
    return { ...slice, id };
  });
}

export function createEvenSlices(count = 4) {
  const safeCount = clamp(Math.round(Number(count) || 1), 1, MAX_SLICE_COUNT);
  return Array.from({ length: safeCount }, (_, index) => ({
    id: `slice-${index + 1}`,
    label: `Slice ${index + 1}`,
    start: index / safeCount,
    end: (index + 1) / safeCount,
  }));
}

export function updateSliceDefinition(definitions, index, patch = {}) {
  const slices = normalizeSliceDefinitions(definitions);
  if (!Number.isInteger(Number(index)) || !slices[Number(index)]) return slices;
  const sliceIndex = Number(index);
  const current = slices[sliceIndex];
  const start = clamp(Number.isFinite(Number(patch.start)) ? Number(patch.start) : current.start, 0, 1);
  const end = Math.min(1, Math.max(start + MIN_SLICE_LENGTH, clamp(Number.isFinite(Number(patch.end)) ? Number(patch.end) : current.end, 0, 1)));
  slices[sliceIndex] = {
    ...current,
    label: typeof patch.label === "string" && patch.label.trim() ? patch.label.trim().slice(0, 32) : current.label,
    start,
    end,
  };
  return slices;
}
