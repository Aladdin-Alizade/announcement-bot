import { findCityByBinaId, findCityByInput, normalizeCity } from "../data/cities.js";

export function findCity(binaCityId, cityName) {
  if (binaCityId != null) {
    const byId = findCityByBinaId(binaCityId);
    if (byId) {
      return byId;
    }
  }
  if (cityName && cityName.trim()) {
    return findCityByInput(cityName);
  }
  return null;
}

function resolveName(binaCityId, cityName) {
  return findCity(binaCityId, cityName)?.name || cityName || "Bakı";
}

function transliterateForEv10(name) {
  const normalized = normalizeCity(name)
    .replaceAll("ə", "e")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ğ", "g")
    .replaceAll("ş", "s")
    .replaceAll("ç", "c")
    .replaceAll(" ", "");
  return normalized;
}

function slugify(name) {
  return normalizeCity(name)
    .replaceAll("ə", "e")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u")
    .replaceAll("ğ", "g")
    .replaceAll("ş", "s")
    .replaceAll("ç", "c")
    .replaceAll(" ", "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

export function binaCitySlug(binaCityId, cityName) {
  if (binaCityId != null) {
    switch (binaCityId) {
      case 1:
        return "baki";
      case 2:
        return "gence";
      case 3:
        return "sumqayit";
      case 33:
        return "xirdalan";
      default:
        return slugify(cityName || "baki");
    }
  }
  return slugify(cityName || "baki");
}

export function ev10Location(binaCityId, cityName) {
  const base = transliterateForEv10(resolveName(binaCityId, cityName));
  if (!base) {
    return "Baki-seher";
  }
  return base.charAt(0).toUpperCase() + base.slice(1) + "-seher";
}

export const TAP_REGION_BY_BINA = {
  1: "420",
  2: "421",
  3: "422",
  33: "423",
};

export const TAP_LAND_MIN_SOT_PARAM = "741";

export const YENIEMLAK_CITY_BY_BINA = {
  1: "7",
  2: "2",
  3: "3",
  33: "1",
};

export const EMLAK_CITY_BY_BINA = {
  1: "3",
  2: "6",
  3: "4",
  4: "48",
  5: "49",
  6: "40",
  7: "32",
  8: "12",
  9: "17",
  10: "21",
  11: "24",
  12: "13",
  13: "16",
  14: "41",
  15: "46",
  16: "15",
  17: "8",
  18: "14",
  19: "47",
  20: "30",
  21: "57",
  22: "21",
  23: "35",
  24: "53",
  25: "27",
  26: "45",
  27: "44",
  28: "51",
  29: "30",
  30: "55",
  31: "58",
  32: "34",
  33: "5",
  34: "23",
  35: "33",
  36: "29",
  37: "36",
  38: "38",
  39: "54",
  40: "20",
  41: "11",
  42: "13",
  43: "77",
  44: "36",
  45: "7",
  46: "31",
  47: "56",
  48: "19",
  49: "84",
  50: "8",
  51: "61",
  52: "22",
  53: "50",
  54: "18",
  55: "96",
  56: "43",
  57: "101",
  58: "56",
  59: "37",
  60: "7",
};
