import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHref, escapeHtml } from "../src/telegram/html.js";
import { parsePriceAmounts, parsePriceInput } from "../src/telegram/conversation.js";
import {
  formatAzNumber,
  formatConfirmationHtml,
  formatHelpHtml,
  formatListHtml,
  formatPriceRange,
} from "../src/telegram/format.js";

test("escapeHtml escapes angle brackets and ampersand", () => {
  assert.equal(escapeHtml("İstifadə: /sil <id> & mətn"), "İstifadə: /sil &lt;id&gt; &amp; mətn");
});

test("escapeHref escapes ampersand in URL", () => {
  assert.equal(escapeHref("https://example.com?a=1&b=2"), "https://example.com?a=1&amp;b=2");
});

test("parsePriceInput accepts min-max", () => {
  assert.deepEqual(parsePriceInput("1 50000 150000"), { valid: true, min: 50000, max: 150000 });
});

test("parsePriceInput rejects min greater than max", () => {
  assert.equal(parsePriceInput("1 200 100").valid, false);
});

test("parsePriceAmounts accepts numbers after min-max button", () => {
  assert.deepEqual(parsePriceAmounts("50000 150000", 1), { valid: true, min: 50000, max: 150000 });
});

test("parsePriceAmounts accepts a single max after max button", () => {
  assert.deepEqual(parsePriceAmounts("150000", 2), { valid: true, min: null, max: 150000 });
});

test("parsePriceAmounts accepts a single min after min button", () => {
  assert.deepEqual(parsePriceAmounts("50000", 3), { valid: true, min: 50000, max: null });
});

test("formatAzNumber groups thousands with spaces", () => {
  assert.equal(formatAzNumber(50000), "50 000");
  assert.equal(formatAzNumber(100000), "100 000");
});

test("formatPriceRange uses Azerbaijani suffixes", () => {
  assert.equal(formatPriceRange({ minPrice: 50000, maxPrice: 100000 }), "50 000 – 100 000 AZN");
  assert.equal(formatPriceRange({ minPrice: 50000, maxPrice: null }), "50 000 AZN-dən");
  assert.equal(formatPriceRange({ minPrice: null, maxPrice: 150000 }), "150 000 AZN-ə qədər");
});

test("formatConfirmationHtml uses Azerbaijani type and site names", () => {
  const html = formatConfirmationHtml({
    id: 2,
    propertyType: "HOUSE",
    areaSqm: 100,
    roomCount: 3,
    cityName: "Bakı",
    minPrice: 50000,
    maxPrice: 100000,
    sources: "bina,tap,ev10,yeniemlak,emlak",
  });
  assert.match(html, /Ev \(həyət evi \/ bağ evi\)/);
  assert.doesNotMatch(html, /HOUSE/);
  assert.match(html, /bina\.az, tap\.az/);
  assert.match(html, /50 000 – 100 000 AZN/);
  assert.match(html, /#2/);
});

test("formatListHtml shows short type labels", () => {
  const html = formatListHtml([
    {
      id: 2,
      active: true,
      propertyType: "HOUSE",
      cityName: "Bakı",
      areaSqm: 100,
      roomCount: 3,
      minPrice: 50000,
      maxPrice: 100000,
    },
  ]);
  assert.match(html, /Ev · Bakı/);
  assert.doesNotMatch(html, /HOUSE/);
  assert.match(html, /\/start/);
});

test("formatHelpHtml includes commands", () => {
  const html = formatHelpHtml();
  assert.match(html, /\/start/);
  assert.match(html, /\/list/);
  assert.match(html, /opsional/);
});
