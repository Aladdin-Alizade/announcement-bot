import * as cheerio from "cheerio";
import { SOURCES } from "../data/sources.js";
import { binaCitySlug } from "./citySlugs.js";
import { firstNonBlank, parsePriceFromText, parseSot, buildQuery } from "./textParser.js";
import { fetchHtml } from "./http.js";
import { config } from "../config.js";

const ROOM_PATTERN = /(\d+)\s*otaq/iu;
const SQM_PATTERN = /(\d+)\s*m²/iu;

function parseRooms(params, title) {
  for (const param of params) {
    const match = ROOM_PATTERN.exec(param.toLowerCase());
    if (match) {
      return Number(match[1]);
    }
  }
  const match = ROOM_PATTERN.exec(title.toLowerCase());
  return match ? Number(match[1]) : null;
}

function parseSqm(params, title) {
  for (const param of params) {
    const lower = param.toLowerCase();
    const match = SQM_PATTERN.exec(lower);
    if (match && !lower.includes("sot")) {
      return Number(match[1]);
    }
  }
  const lowerTitle = title.toLowerCase();
  const match = SQM_PATTERN.exec(lowerTitle);
  if (match && !lowerTitle.includes("sot")) {
    return Number(match[1]);
  }
  return null;
}

function applyFilters(params, subscription) {
  if (!subscription.propertyType) {
    if (subscription.minPrice != null) {
      params.push(["price_from", subscription.minPrice]);
    }
    if (subscription.maxPrice != null) {
      params.push(["price_to", subscription.maxPrice]);
    }
    return;
  }
  params.push(["category_id", subscription.binaCategoryId]);
  if (subscription.cityId != null) {
    params.push(["city_id", subscription.cityId]);
  }
  if (subscription.propertyType === "LAND" && subscription.landSot != null) {
    params.push(["area_from", subscription.landSot]);
  }
  if (subscription.propertyType === "HOUSE" && subscription.areaSqm != null) {
    params.push(["area_from", subscription.areaSqm]);
    params.push(["area_to", subscription.areaSqm]);
  }
  if (subscription.roomCount != null) {
    params.push(["room_ids[]", subscription.roomCount >= 5 ? "5+" : String(subscription.roomCount)]);
  }
  if (subscription.minPrice != null) {
    params.push(["price_from", subscription.minPrice]);
  }
  if (subscription.maxPrice != null) {
    params.push(["price_to", subscription.maxPrice]);
  }
}

export function buildSeoPath(subscription) {
  const categorySlug = subscription.propertyType === "LAND" ? "torpaq" : "menzil";
  const params = [];
  applyFilters(params, subscription);
  const hasCity = subscription.cityId != null || Boolean(subscription.cityName?.trim());
  if (hasCity) {
    const citySlug = binaCitySlug(subscription.cityId, subscription.cityName);
    return `${SOURCES.BINA_AZ.baseUrl}/${citySlug}/alqi-satqi/${categorySlug}?${buildQuery(params)}`;
  }
  return `${SOURCES.BINA_AZ.baseUrl}/alqi-satqi/${categorySlug}?${buildQuery(params)}`;
}

export function buildSearchUrl(subscription) {
  if (subscription.propertyType) {
    return buildSeoPath(subscription);
  }
  const params = [["leased", "false"]];
  const keywords = (subscription.keywords || "").trim();
  if (keywords) {
    params.push(["search_query", keywords]);
  }
  applyFilters(params, subscription);
  return `${SOURCES.BINA_AZ.baseUrl}/items?${buildQuery(params)}`;
}

export function parse(html) {
  const $ = cheerio.load(html);
  const container = $("#js-items-search");
  if (!container.length) {
    return [];
  }
  const listings = [];
  container.find(".items-i[data-item-id]").each((_, item) => {
    const el = $(item);
    const externalId = el.attr("data-item-id");
    if (!externalId) {
      return;
    }
    const image = el.find(".preview img[alt]").first();
    const title = image.length ? image.attr("alt") : `Elan #${externalId}`;
    const price = parsePriceFromText(el.find(".price-val").first().text());
    const region = el.find(".city_when").first().text().trim() || null;
    const params = el
      .find(".card_params .name li")
      .map((__, li) => $(li).text())
      .get();
    listings.push({
      source: SOURCES.BINA_AZ.name,
      sourceLabel: SOURCES.BINA_AZ.label,
      externalId,
      title,
      price,
      currency: "AZN",
      region,
      url: `${SOURCES.BINA_AZ.baseUrl}/items/${externalId}`,
      imageUrl: image.length ? firstNonBlank(image.attr("data-src"), image.attr("src")) : null,
      publishedAt: null,
      areaSqm: parseSqm(params, title),
      landSot: parseSot(params, title),
      roomCount: parseRooms(params, title),
    });
  });
  return listings;
}

export async function fetchListings(subscription) {
  const html = await fetchHtml(buildSearchUrl(subscription));
  return parse(html).slice(0, config.scraper.maxResultsPerSource);
}
