import * as cheerio from "cheerio";
import { SOURCES } from "../data/sources.js";
import { ev10Location } from "./citySlugs.js";
import {
  buildQuery,
  firstNonBlank,
  normalizeWhitespace,
  parsePriceNearPosting,
  parseRooms,
  parseSot,
  parseSqm,
} from "./textParser.js";
import { fetchHtml } from "./http.js";
import { config } from "../config.js";

function extractRegion(title) {
  const comma = title.lastIndexOf(",");
  if (comma < 0 || comma >= title.length - 1) {
    return null;
  }
  return title.slice(comma + 1).trim();
}

export function buildSearchUrl(subscription) {
  const category = subscription.propertyType === "LAND" ? "torpaq" : "menzil";
  const params = [
    ["page_number", 1],
    ["media_type", "image"],
    ["sort_by", "date_desc"],
  ];
  if (subscription.cityId != null || subscription.cityName) {
    params.push(["location", ev10Location(subscription.cityId, subscription.cityName)]);
  }
  if (subscription.minPrice != null) {
    params.push(["min_price", subscription.minPrice]);
  }
  if (subscription.maxPrice != null) {
    params.push(["max_price", subscription.maxPrice]);
  }
  if (subscription.propertyType === "LAND" && subscription.landSot != null) {
    params.push(["min_area", subscription.landSot]);
  }
  if (subscription.propertyType === "HOUSE") {
    if (subscription.areaSqm != null) {
      params.push(["min_area", subscription.areaSqm]);
    }
    if (subscription.roomCount != null) {
      params.push(["rooms", subscription.roomCount]);
    }
  }
  return `${SOURCES.EV10_AZ.baseUrl}/alqi-satqi/${category}?${buildQuery(params)}`;
}

export function parse(html) {
  const $ = cheerio.load(html);
  const byId = new Map();
  $('a[href^="/posting/"]').each((_, link) => {
    const el = $(link);
    const href = el.attr("href") || "";
    const externalId = href.replace("/posting/", "").trim();
    if (!externalId || byId.has(externalId)) {
      return;
    }
    const image = el.find("img[alt]").first();
    const title = image.length
      ? normalizeWhitespace(image.attr("alt"))
      : `Elan #${externalId}`;
    byId.set(externalId, {
      source: SOURCES.EV10_AZ.name,
      sourceLabel: SOURCES.EV10_AZ.label,
      externalId,
      title,
      price: parsePriceNearPosting(html, externalId),
      currency: "AZN",
      region: extractRegion(title),
      url: `${SOURCES.EV10_AZ.baseUrl}${href}`,
      imageUrl: image.length ? firstNonBlank(image.attr("src"), image.attr("data-src")) : null,
      publishedAt: null,
      areaSqm: parseSqm([title], title),
      landSot: parseSot([title], title),
      roomCount: parseRooms([title], title),
    });
  });
  return [...byId.values()];
}

export async function fetchListings(subscription) {
  const html = await fetchHtml(buildSearchUrl(subscription));
  return parse(html).slice(0, config.scraper.maxResultsPerSource);
}
