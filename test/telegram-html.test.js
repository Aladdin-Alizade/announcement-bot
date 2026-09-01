import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHref, escapeHtml } from "../src/telegram/html.js";
import { parsePriceInput } from "../src/telegram/conversation.js";

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
