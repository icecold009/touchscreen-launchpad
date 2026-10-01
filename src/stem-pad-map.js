const STEMS_PER_KIT = 4;
const PADS_PER_STEM = 4;

const DEFAULT_STEM_LABELS = ["Drums", "Bass", "Vocals", "Other"];

export function createStemPadAssignments(stems) {
  if (!Array.isArray(stems) || stems.length !== STEMS_PER_KIT) {
    throw new TypeError("Choose exactly four stems to fill 16 pads.");
  }

  const normalized = stems.map((stem, index) => ({
    sampleId: typeof stem?.sampleId === "string" ? stem.sampleId.trim() : "",
    label: typeof stem?.label === "string" && stem.label.trim() ? stem.label.trim().slice(0, 24) : DEFAULT_STEM_LABELS[index],
  }));
  if (normalized.some((stem) => !stem.sampleId)) {
    throw new TypeError("Each stem needs a saved audio sample.");
  }

  return normalized.flatMap((stem, stemIndex) => Array.from({ length: PADS_PER_STEM }, (_, sectionIndex) => ({
    label: `${stem.label} ${sectionIndex + 1}`,
    sampleId: stem.sampleId,
    sliceId: null,
    sampleRegion: {
      start: sectionIndex / PADS_PER_STEM,
      end: (sectionIndex + 1) / PADS_PER_STEM,
      loopStart: sectionIndex / PADS_PER_STEM,
      loopEnd: (sectionIndex + 1) / PADS_PER_STEM,
      reverse: false,
    },
  })));
}
