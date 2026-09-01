import { test } from "node:test";
import assert from "node:assert/strict";
import { parse as parseBina } from "../src/scrape/bina.js";
import { parse as parseTap } from "../src/scrape/tap.js";
import { parse as parseEv10 } from "../src/scrape/ev10.js";
import { parse as parseYeniemlak } from "../src/scrape/yeniemlak.js";
import { parse as parseEmlak } from "../src/scrape/emlak.js";

test("bina parses listing cards", () => {
  const html = `
    <div id="js-items-search">
      <div class="items-i" data-item-id="99">
        <a class="item_link" href="/items/99"></a>
        <div class="preview"><img alt="3 otaqlı mənzil" data-src="https://bina.az/img.jpg"/></div>
        <div class="card_params">
          <span class="price-val">1 200</span>
          <ul class="name"><li>3 otaqlı</li><li>110 m²</li></ul>
          <div class="city_when">Bakı, bu gün</div>
        </div>
      </div>
    </div>`;
  const listings = parseBina(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "99");
  assert.equal(listings[0].title, "3 otaqlı mənzil");
  assert.equal(listings[0].areaSqm, 110);
  assert.equal(listings[0].roomCount, 3);
});

test("ev10 parses posting cards", () => {
  const html = `
    <a href="/posting/255269">
      <img alt="Satılır,   10 sot
      torpaq ,  Binə q." src="https://cdn.ev10.az/img.webp"/>
    </a>
    7,500 AZN`;
  const listings = parseEv10(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "255269");
  assert.equal(listings[0].landSot, 10);
  assert.equal(listings[0].region, "Binə q.");
  assert.equal(listings[0].price, 7500);
});

test("yeniemlak parses listing table", () => {
  const html = `
    <table class="list">
      <tr><td class="title"><price>135000</price><titem>Elan: <g><b>990693</b></g></titem></td></tr>
      <tr><td><a class="detail" href="/elan/satilir-3-otaqli-menzil-masazir-990693">Ətraflı</a></td></tr>
      <tr><td class="text">
        <emlak>Bina evi menzil</emlak> / Yeni tikili
        <div class="params"><b>3</b> otaq</div>
        <div class="params"><b>93</b> m2</div>
        <div class="params"><b>Abşeron</b></div><div class="params"><b>Masazır</b></div>
      </td></tr>
    </table>`;
  const listings = parseYeniemlak(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "990693");
  assert.equal(listings[0].price, 135000);
  assert.equal(listings[0].roomCount, 3);
  assert.equal(listings[0].areaSqm, 93);
});

test("emlak parses ticket cards", () => {
  const html = `
    <div class="ticket-list">
      <div class="ticket">
        <h6 class="title">
          <a href="/1346713-satilir-3-otaqli-96-m2-yeni-tikili.html">Satılır 3 otaqlı 96 m2 yeni tikili</a>
        </h6>
        <p class="price">259 000 AZN</p>
        <div class="address"><div class="align-right"><a>Asan Xidmət-1</a></div></div>
      </div>
    </div>`;
  const listings = parseEmlak(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "1346713");
  assert.equal(listings[0].price, 259000);
  assert.equal(listings[0].roomCount, 3);
  assert.equal(listings[0].areaSqm, 96);
});

test("tap parses __NEXT_DATA__ ads", () => {
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
    props: {
      pageProps: {
        apolloState: {
          "Ad:1": {
            __typename: "Ad",
            legacyResourceId: "555",
            path: "/elanlar/555",
            title: "Torpaq 6 sot",
            price: 9000,
            region: "Bakı",
            photo: { url: "https://tap.az/a.jpg" },
          },
        },
      },
    },
  })}</script>`;
  const listings = parseTap(html);
  assert.equal(listings.length, 1);
  assert.equal(listings[0].externalId, "555");
  assert.equal(listings[0].price, 9000);
  assert.equal(listings[0].landSot, 6);
});
