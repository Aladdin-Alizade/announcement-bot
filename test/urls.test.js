import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSearchUrl as binaUrl } from "../src/scrape/bina.js";
import { buildSearchUrl as tapUrl } from "../src/scrape/tap.js";
import { buildSearchUrl as ev10Url } from "../src/scrape/ev10.js";
import { buildSearchUrl as yeniemlakUrl } from "../src/scrape/yeniemlak.js";
import { buildSearchUrl as emlakUrl } from "../src/scrape/emlak.js";

const landBaku = {
  propertyType: "LAND",
  binaCategoryId: 9,
  cityId: 1,
  cityName: "Bakı",
  landSot: 3,
  maxPrice: 10_000,
};

test("bina builds SEO land URL", () => {
  const url = binaUrl(landBaku);
  assert.match(url, /\/baki\/alqi-satqi\/torpaq/);
  assert.match(url, /area_from=3/);
  assert.match(url, /price_to=10000/);
  assert.equal(url.includes("/items"), false);
});

test("bina builds nationwide URL when city is skipped", () => {
  const url = binaUrl({
    propertyType: "HOUSE",
    binaCategoryId: 2,
    cityId: null,
    cityName: null,
    maxPrice: 150_000,
  });
  assert.match(url, /\/alqi-satqi\/menzil/);
  assert.equal(url.includes("/baki/"), false);
  assert.match(url, /price_to=150000/);
});

test("tap builds torpaq search URL", () => {
  const decoded = decodeURIComponent(tapUrl(landBaku));
  assert.ok(decoded.startsWith("https://tap.az/elanlar/dasinmaz-emlak/torpaq-sahesi?"));
  assert.equal(
    decoded.slice(decoded.indexOf("?") + 1),
    "q[price][]=&q[price][]=10000&keywords_source=typewritten&q[region_id]=420&p[741][]=3&p[741][]=",
  );
});

test("ev10 builds torpaq search URL", () => {
  const url = decodeURIComponent(ev10Url(landBaku));
  assert.match(url, /\/alqi-satqi\/torpaq/);
  assert.match(url, /max_price=10000/);
  assert.match(url, /min_area=3/);
  assert.match(url, /location=Baki-seher/);
});

test("yeniemlak builds torpaq search URL", () => {
  const decoded = decodeURIComponent(yeniemlakUrl(landBaku));
  assert.equal(
    decoded.slice(decoded.indexOf("?") + 1),
    "elan_nov=1&emlak=3&menzil_nov=&qiymet=&qiymet2=10000&mertebe=&mertebe2=&otaq=&otaq2=&sahe_m=&sahe_m2=&sahe_s=3&sahe_s2=&seher[]=7",
  );
});

test("emlak builds valid search URL", () => {
  const url = emlakUrl(landBaku);
  assert.match(url, /\/elanlar\//);
  assert.match(url, /ann_type=3/);
  assert.match(url, /property_type=7/);
  assert.match(url, /city=3/);
  assert.match(url, /space_min=3/);
  assert.match(url, /price_max=10000/);
  assert.equal(url.includes("ann_type=1"), false);
});
