import { parseSotDecimal } from "./textParser.js";
import { detectKind, isHouse, isLand } from "./propertyKind.js";

function keywordList(subscription) {
  if (!subscription.keywords || !subscription.keywords.trim()) {
    return [];
  }
  return subscription.keywords
    .split(/\s+/)
    .map((word) => word.trim().toLocaleLowerCase("az"))
    .filter(Boolean);
}

function isPropertySearch(subscription) {
  return Boolean(subscription.propertyType);
}

function matchesKeywords(listing, subscription) {
  const haystack = listing.title.toLocaleLowerCase("az");
  return keywordList(subscription).every((word) => haystack.includes(word));
}

function matchesPrice(listing, subscription) {
  if (listing.price == null) {
    return subscription.minPrice == null && subscription.maxPrice == null;
  }
  const price = Number(listing.price);
  if (subscription.minPrice != null && price < subscription.minPrice) {
    return false;
  }
  if (subscription.maxPrice != null && price > subscription.maxPrice) {
    return false;
  }
  return true;
}

function matchesCityName(listing, subscription) {
  const city = subscription.cityName || subscription.city;
  if (!city || !String(city).trim()) {
    return true;
  }
  if (!listing.region || !listing.region.trim()) {
    return subscription.cityId != null;
  }
  return listing.region
    .toLocaleLowerCase("az")
    .includes(String(city).toLocaleLowerCase("az"));
}

function matchesPropertyKind(listing, subscription) {
  const kind = detectKind(listing.title);
  if (subscription.propertyType === "LAND") {
    if (isHouse(listing.title)) {
      return false;
    }
    return kind === "LAND" || (kind === "UNKNOWN" && listing.landSot != null);
  }
  if (subscription.propertyType === "HOUSE") {
    if (isLand(listing.title)) {
      return false;
    }
    return kind === "HOUSE" || (kind === "UNKNOWN" && listing.roomCount != null);
  }
  return false;
}

function matchesHouse(listing, subscription) {
  if (subscription.areaSqm != null) {
    if (listing.areaSqm == null || listing.areaSqm !== subscription.areaSqm) {
      return false;
    }
  }
  if (subscription.roomCount != null) {
    if (listing.roomCount == null) {
      return false;
    }
    if (subscription.roomCount === 5) {
      return listing.roomCount >= 5;
    }
    return listing.roomCount === subscription.roomCount;
  }
  return true;
}

function matchesLand(listing, subscription) {
  if (subscription.landSot == null) {
    return true;
  }
  const sot =
    listing.landSot != null
      ? Number(listing.landSot)
      : parseSotDecimal([], listing.title);
  if (sot == null) {
    return false;
  }
  return sot >= subscription.landSot;
}

function matchesPropertyListing(listing, subscription) {
  if (!matchesPropertyKind(listing, subscription)) {
    return false;
  }
  if (!matchesPrice(listing, subscription)) {
    return false;
  }
  if (!matchesCityName(listing, subscription)) {
    return false;
  }
  if (subscription.propertyType === "HOUSE") {
    return matchesHouse(listing, subscription);
  }
  if (subscription.propertyType === "LAND") {
    return matchesLand(listing, subscription);
  }
  return false;
}

function matchesLegacyListing(listing, subscription) {
  if (keywordList(subscription).length > 0 && !matchesKeywords(listing, subscription)) {
    return false;
  }
  if (!matchesPrice(listing, subscription)) {
    return false;
  }
  return matchesCityName(listing, subscription);
}

export function matches(listing, subscription) {
  if (isPropertySearch(subscription)) {
    return matchesPropertyListing(listing, subscription);
  }
  return matchesLegacyListing(listing, subscription);
}
