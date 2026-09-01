const PRICE_PATTERN = /[\d\s]+/;
const ROOM_PATTERN = /(\d+)\s*otaq/iu;
const SQM_PATTERN = /(\d+)\s*m²/iu;
const SOT_PATTERN = /(\d+(?:[.,]\d+)?)\s*sot/iu;
const PRICE_AZN_PATTERN = /([\d\s.,]+)\s*AZN/iu;

function firstMatch(regex, text) {
  const match = regex.exec(text);
  return match ? match[1] : null;
}

export function parseRooms(params, title) {
  for (const param of params) {
    const value = firstMatch(ROOM_PATTERN, param.toLowerCase());
    if (value) {
      return Number(value);
    }
  }
  const fromTitle = firstMatch(ROOM_PATTERN, title.toLowerCase());
  return fromTitle ? Number(fromTitle) : null;
}

export function parseSqm(params, title) {
  for (const param of params) {
    const lower = param.toLowerCase();
    const value = firstMatch(SQM_PATTERN, lower);
    if (value && !lower.includes("sot")) {
      return Number(value);
    }
  }
  const lowerTitle = title.toLowerCase();
  const fromTitle = firstMatch(SQM_PATTERN, lowerTitle);
  if (fromTitle && !lowerTitle.includes("sot")) {
    return Number(fromTitle);
  }
  return null;
}

export function parseSotDecimal(params, title) {
  for (const param of params) {
    const value = firstMatch(SOT_PATTERN, param.toLowerCase());
    if (value) {
      return Number(value.replace(",", ".").replace(/ /g, ""));
    }
  }
  const fromTitle = firstMatch(SOT_PATTERN, title.toLowerCase());
  return fromTitle ? Number(fromTitle.replace(",", ".").replace(/ /g, "")) : null;
}

export function parseSot(params, title) {
  const value = parseSotDecimal(params, title);
  return value == null ? null : Math.round(value);
}

export function parsePriceText(text) {
  if (!text || !String(text).trim()) {
    return null;
  }
  const azn = PRICE_AZN_PATTERN.exec(text);
  if (azn) {
    const digits = azn[1].replace(/[\s.,]/g, "");
    if (digits) {
      return Number(digits);
    }
  }
  const match = PRICE_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  const digits = match[0].replace(/[\s.,]/g, "");
  return digits ? Number(digits) : null;
}

export function parsePriceFromText(text) {
  if (!text) {
    return null;
  }
  const match = PRICE_PATTERN.exec(text);
  if (!match) {
    return null;
  }
  const digits = match[0].replace(/\s+/g, "");
  return digits ? Number(digits) : null;
}

export function parsePriceNearPosting(html, postingId) {
  if (!html || !postingId) {
    return null;
  }
  const idx = html.indexOf(`/posting/${postingId}`);
  if (idx < 0) {
    return null;
  }
  const snippet = html.slice(idx, Math.min(html.length, idx + 2500));
  const match = PRICE_AZN_PATTERN.exec(snippet);
  return match ? parsePriceText(`${match[1]} AZN`) : null;
}

export function firstNonBlank(first, second) {
  if (first && first.trim() && !first.startsWith("data:")) {
    return first;
  }
  if (second && second.trim() && !second.startsWith("data:")) {
    return second;
  }
  return null;
}

export function normalizeWhitespace(text) {
  if (text == null) {
    return "";
  }
  return text.replace(/\s+/g, " ").trim();
}

export function buildQuery(params) {
  const search = new URLSearchParams();
  for (const [key, value] of params) {
    search.append(key, value == null ? "" : String(value));
  }
  return search.toString();
}
