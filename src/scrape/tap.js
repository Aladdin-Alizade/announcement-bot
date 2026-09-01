import * as cheerio from "cheerio";
import { SOURCES } from "../data/sources.js";
import { TAP_LAND_MIN_SOT_PARAM, TAP_REGION_BY_BINA } from "./citySlugs.js";
import { parseRooms, parseSot, parseSqm, buildQuery } from "./textParser.js";
import { fetchHtml } from "./http.js";
import { config } from "../config.js";

export function buildSearchUrl(subscription) {
  const categoryPath =
    subscription.propertyType === "LAND" ? "torpaq-sahesi" : "menziller";
  const params = [];
  params.push(["q[price][]", subscription.minPrice ?? ""]);
  params.push(["q[price][]", subscription.maxPrice ?? ""]);
  params.push(["keywords_source", "typewritten"]);
  const region = TAP_REGION_BY_BINA[subscription.cityId];
  if (region) {
    params.push(["q[region_id]", region]);
  }
  if (subscription.propertyType === "LAND") {
    const key = `p[${TAP_LAND_MIN_SOT_PARAM}][]`;
    params.push([key, subscription.landSot ?? ""]);
    params.push([key, ""]);
  }
  return `${SOURCES.TAP_AZ.baseUrl}/elanlar/dasinmaz-emlak/${categoryPath}?${buildQuery(params)}`;
}

function toListing(ad) {
  const title = ad.title || "";
  const path = ad.path || "";
  let publishedAt = null;
  if (ad.updatedAt) {
    const parsed = Date.parse(ad.updatedAt);
    publishedAt = Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
  }
  return {
    source: SOURCES.TAP_AZ.name,
    sourceLabel: SOURCES.TAP_AZ.label,
    externalId: String(ad.legacyResourceId ?? ""),
    title,
    price: typeof ad.price === "number" ? ad.price : null,
    currency: "AZN",
    region: ad.region || null,
    url: `${SOURCES.TAP_AZ.baseUrl}${path}`,
    imageUrl: ad.photo && typeof ad.photo === "object" ? ad.photo.url || null : null,
    publishedAt,
    areaSqm: parseSqm([], title),
    landSot: parseSot([], title),
    roomCount: parseRooms([], title),
  };
}

export function parse(html) {
  const $ = cheerio.load(html);
  const nextData = $("#__NEXT_DATA__").text() || $("#__NEXT_DATA__").html();
  if (!nextData) {
    throw new Error("tap.az: __NEXT_DATA__ tapılmadı");
  }
  let root;
  try {
    root = JSON.parse(nextData);
  } catch {
    throw new Error("tap.az JSON parse xətası");
  }
  const apolloState = root?.props?.pageProps?.apolloState;
  if (!apolloState || typeof apolloState !== "object") {
    return [];
  }
  const listings = [];
  for (const [key, ad] of Object.entries(apolloState)) {
    if (!key.startsWith("Ad:") || !ad || ad.__typename !== "Ad") {
      continue;
    }
    listings.push(toListing(ad));
  }
  return listings;
}

export async function fetchListings(subscription) {
  const html = await fetchHtml(buildSearchUrl(subscription));
  return parse(html).slice(0, config.scraper.maxResultsPerSource);
}
