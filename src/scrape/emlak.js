import * as cheerio from "cheerio";
import { SOURCES } from "../data/sources.js";
import { EMLAK_CITY_BY_BINA } from "./citySlugs.js";
import { buildQuery, normalizeWhitespace, parsePriceText } from "./textParser.js";
import { fetchHtml, SourceFetchError } from "./http.js";
import { config } from "../config.js";

const LISTING_ID_PATTERN = /^\/(\d+)-/;
const ROOM_IN_TITLE = /(\d+)\s*otaqlı/iu;
const SQM_IN_TITLE = /(\d+(?:[.,]\d+)?)\s*m\s*(?:²|2|sup2)?/iu;
const SOT_IN_TITLE = /(\d+(?:[.,]\d+)?)\s*sot/iu;

function extractExternalId(href) {
  const match = LISTING_ID_PATTERN.exec(href);
  return match ? match[1] : null;
}

function parseRooms(title) {
  const match = ROOM_IN_TITLE.exec(title);
  return match ? Number(match[1]) : null;
}

function parseSqm(title) {
  if (title.toLowerCase().includes("sot")) {
    return null;
  }
  const match = SQM_IN_TITLE.exec(title);
  return match ? Math.round(Number(match[1].replace(",", "."))) : null;
}

function parseSotFromTitle(title) {
  const match = SOT_IN_TITLE.exec(title);
  return match ? Math.round(Number(match[1].replace(",", "."))) : null;
}

export function buildSearchUrl(subscription) {
  const params = [
    ["ann_type", "3"],
    ["sort_type", "0"],
    ["page", "1"],
  ];
  if (subscription.propertyType) {
    params.push(["property_type", subscription.propertyType === "LAND" ? "7" : "1"]);
    const city = EMLAK_CITY_BY_BINA[subscription.cityId];
    if (city) {
      params.push(["city", city]);
    }
    if (subscription.roomCount != null) {
      params.push(["room_min", subscription.roomCount]);
      params.push(["room_max", subscription.roomCount]);
    }
    if (subscription.propertyType === "HOUSE" && subscription.areaSqm != null) {
      params.push(["space_min", subscription.areaSqm]);
      params.push(["space_max", subscription.areaSqm]);
    }
    if (subscription.propertyType === "LAND" && subscription.landSot != null) {
      params.push(["space_min", subscription.landSot]);
    }
  } else {
    params.push(["property_type", "1"]);
  }
  if (subscription.minPrice != null) {
    params.push(["price_min", subscription.minPrice]);
  }
  if (subscription.maxPrice != null) {
    params.push(["price_max", subscription.maxPrice]);
  }
  return `${SOURCES.EMLAK_AZ.baseUrl}/elanlar/?${buildQuery(params)}`;
}

export function parse(html) {
  const $ = cheerio.load(html);
  const listings = [];
  $("div.ticket-list div.ticket").each((_, ticket) => {
    const el = $(ticket);
    const titleLink = el.find("h6.title a[href]").first();
    if (!titleLink.length) {
      return;
    }
    const href = titleLink.attr("href") || "";
    const externalId = extractExternalId(href);
    if (!externalId) {
      return;
    }
    const title = normalizeWhitespace(titleLink.text());
    const priceEl = el.find("p.price").first();
    const image = el.find("div.img img[src]").first();
    const region =
      el
        .find(".address .align-right a")
        .map((__, a) => $(a).text().trim())
        .get()
        .find(Boolean) || null;
    listings.push({
      source: SOURCES.EMLAK_AZ.name,
      sourceLabel: SOURCES.EMLAK_AZ.label,
      externalId,
      title,
      price: priceEl.length ? parsePriceText(priceEl.text()) : null,
      currency: "AZN",
      region,
      url: `${SOURCES.EMLAK_AZ.baseUrl}${href}`,
      imageUrl: image.length ? `${SOURCES.EMLAK_AZ.baseUrl}${image.attr("src")}` : null,
      publishedAt: null,
      areaSqm: parseSqm(title),
      landSot: parseSotFromTitle(title),
      roomCount: parseRooms(title),
    });
  });
  return listings;
}

export async function fetchListings(subscription) {
  const url = buildSearchUrl(subscription);
  try {
    const html = await fetchHtml(url);
    if (html.includes("Səhifə tapılmadı")) {
      console.warn(`emlak.az: səhifə tapılmadı — ${url}`);
      return [];
    }
    return parse(html).slice(0, config.scraper.maxResultsPerSource);
  } catch (err) {
    if (err instanceof SourceFetchError && err.message.includes("Səhifə tapılmadı")) {
      console.warn(`emlak.az: ${err.statusCode} — ${url}`);
      return [];
    }
    throw err;
  }
}
