import { test } from "node:test";
import assert from "node:assert/strict";
import { matches } from "../src/scrape/matcher.js";

function listing(title, price, extra = {}) {
  return {
    source: extra.source || "TAP_AZ",
    externalId: "1",
    title,
    price,
    currency: "AZN",
    region: extra.region ?? "Bakı",
    url: "https://tap.az/elanlar/1",
    imageUrl: null,
    landSot: extra.landSot ?? null,
    areaSqm: extra.areaSqm ?? null,
    roomCount: extra.roomCount ?? null,
  };
}

test("matches when keywords and price fit", () => {
  assert.equal(
    matches(listing("Apple iPhone 13", 1200), { keywords: "iphone", minPrice: 500, maxPrice: 2000 }),
    true,
  );
});

test("rejects when keyword missing", () => {
  assert.equal(
    matches(listing("Apple iPhone 13", 1200), { keywords: "samsung", minPrice: 100, maxPrice: 5000 }),
    false,
  );
});

test("rejects when price too high", () => {
  assert.equal(
    matches(listing("Apple iPhone 13", 1200), { keywords: "iphone", minPrice: 100, maxPrice: 500 }),
    false,
  );
});

test("land search rejects smaller sot and accepts larger", () => {
  const subscription = { propertyType: "LAND", landSot: 3, cityName: "Bakı", maxPrice: 10_000 };
  assert.equal(matches(listing("Torpaq - 1 sot", 5000, { landSot: 1 }), subscription), false);
  assert.equal(matches(listing("Torpaq - 5 sot", 8000, { landSot: 5 }), subscription), true);
});

test("land search rejects apartment", () => {
  assert.equal(
    matches(listing("3 otaqlı mənzil 90 m²", 100_000), { propertyType: "LAND", landSot: 3, cityName: "Bakı" }),
    false,
  );
});

test("house search rejects land", () => {
  assert.equal(
    matches(listing("Torpaq 10 sot", 5000, { landSot: 10 }), {
      propertyType: "HOUSE",
      roomCount: 3,
      cityName: "Bakı",
    }),
    false,
  );
});
