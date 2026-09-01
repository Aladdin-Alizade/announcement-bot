const HOUSE_MARKERS =
  /otaqlı|otaqli|mənzil|menzil|yeni tikili|köhnə tikili|kohne tikili|həyət evi|heyet evi|bağ evi|bag evi|villa|m²|m2/iu;
const LAND_MARKERS = /torpaq|sot\b|torpaq sah/iu;

export function detectKind(title) {
  if (!title || !title.trim()) {
    return "UNKNOWN";
  }
  const haystack = title.toLocaleLowerCase("az");
  const land = LAND_MARKERS.test(haystack);
  const house = HOUSE_MARKERS.test(haystack);
  if (land && !house) {
    return "LAND";
  }
  if (house && !land) {
    return "HOUSE";
  }
  if (land) {
    return "LAND";
  }
  if (house) {
    return "HOUSE";
  }
  return "UNKNOWN";
}

export function isLand(title) {
  return detectKind(title) === "LAND";
}

export function isHouse(title) {
  return detectKind(title) === "HOUSE";
}
