const MAX_SAMPLE_TAGS = 8;
const MAX_SAMPLE_TAG_LENGTH = 24;

function cleanTag(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_SAMPLE_TAG_LENGTH) : "";
}

export function normalizeSampleLibraryMetadata(candidate = {}) {
  const tags = Array.isArray(candidate.tags)
    ? candidate.tags.map(cleanTag).filter(Boolean)
    : typeof candidate.tags === "string"
      ? candidate.tags.split(",").map(cleanTag).filter(Boolean)
      : [];
  return {
    favorite: candidate.favorite === true,
    tags: [...new Set(tags)].slice(0, MAX_SAMPLE_TAGS),
  };
}

export function getSampleUsage(sampleId, kits = []) {
  return (kits || []).flatMap((kit) => (kit?.pads || []).flatMap((pad, padIndex) => (
    pad?.sampleId === sampleId ? [{ kitId: kit.id, kitName: kit.name, padIndex }] : []
  )));
}

export function getOrphanSampleIds(samples = [], kits = []) {
  const used = new Set((kits || []).flatMap((kit) => (kit?.pads || []).map((pad) => pad?.sampleId).filter(Boolean)));
  return (samples || []).map((sample) => sample.id).filter((id) => id && !used.has(id));
}

export function filterSampleRecords(samples = [], { query = "", favoritesOnly = false, tag = "", sort = "name" } = {}) {
  const normalizedQuery = String(query).trim().toLocaleLowerCase();
  const normalizedTag = cleanTag(tag).toLocaleLowerCase();
  return [...samples]
    .filter((sample) => {
      const metadata = normalizeSampleLibraryMetadata(sample?.libraryMeta);
      const haystack = `${sample?.name || ""} ${metadata.tags.join(" ")}`.toLocaleLowerCase();
      return (!normalizedQuery || haystack.includes(normalizedQuery))
        && (!favoritesOnly || metadata.favorite)
        && (!normalizedTag || metadata.tags.some((candidate) => candidate.toLocaleLowerCase() === normalizedTag));
    })
    .sort((left, right) => {
      if (sort === "newest") return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
      if (sort === "largest") return (Number(right.size) || 0) - (Number(left.size) || 0);
      if (sort === "favorite") {
        const favoriteDelta = Number(normalizeSampleLibraryMetadata(right.libraryMeta).favorite) - Number(normalizeSampleLibraryMetadata(left.libraryMeta).favorite);
        if (favoriteDelta) return favoriteDelta;
      }
      return String(left.name || "").localeCompare(String(right.name || ""));
    });
}

export function createBatchAssignments(sampleIds, padCount = 16, startIndex = 0) {
  return [...sampleIds].slice(0, Math.max(0, padCount)).map((sampleId, offset) => ({
    sampleId,
    padIndex: Math.min(Math.max(0, Number(startIndex) || 0) + offset, Math.max(0, padCount - 1)),
  }));
}
