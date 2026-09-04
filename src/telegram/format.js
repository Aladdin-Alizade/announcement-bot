import { propertyTypeLabel, propertyTypeShortLabel } from "../data/propertyType.js";
import { formatSourceLabels } from "../data/sources.js";
import { escapeHtml } from "./html.js";

export function formatAzNumber(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "";
  }
  return String(Math.trunc(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatRoomCount(count) {
  if (count == null) {
    return null;
  }
  return count === 5 ? "5+" : String(count);
}

export function formatPriceRange(subscription) {
  if (subscription.minPrice == null && subscription.maxPrice == null) {
    return "məhdudiyyət yoxdur";
  }
  if (subscription.minPrice != null && subscription.maxPrice != null) {
    return `${formatAzNumber(subscription.minPrice)} – ${formatAzNumber(subscription.maxPrice)} AZN`;
  }
  if (subscription.minPrice != null) {
    return `${formatAzNumber(subscription.minPrice)} AZN-dən`;
  }
  return `${formatAzNumber(subscription.maxPrice)} AZN-ə qədər`;
}

function formatAreaLine(subscription) {
  if (subscription.areaSqm != null) {
    return `${formatAzNumber(subscription.areaSqm)} m²`;
  }
  if (subscription.landSot != null) {
    return `${formatAzNumber(subscription.landSot)} sot`;
  }
  return null;
}

function formatDetails(subscription) {
  const parts = [];
  const area = formatAreaLine(subscription);
  if (area) {
    parts.push(area);
  }
  const rooms = formatRoomCount(subscription.roomCount);
  if (rooms) {
    parts.push(`${rooms} otaq`);
  }
  parts.push(formatPriceRange(subscription));
  return parts.join(" · ");
}

export function formatConfirmationHtml(subscription) {
  const lines = [
    `✅ <b>Axtarış aktivdir</b>`,
    `<code>#${subscription.id}</code>`,
    "",
    `🏠 ${escapeHtml(propertyTypeLabel(subscription.propertyType))}`,
  ];
  const meta = [];
  const area = formatAreaLine(subscription);
  if (area) {
    meta.push(`📐 ${area}`);
  }
  const rooms = formatRoomCount(subscription.roomCount);
  if (rooms) {
    meta.push(`🚪 ${rooms} otaq`);
  }
  if (meta.length) {
    lines.push(meta.join("  ·  "));
  }
  if (subscription.cityName) {
    lines.push(`📍 ${escapeHtml(subscription.cityName)}`);
  } else {
    lines.push("📍 Bütün şəhərlər");
  }
  lines.push(`💰 ${escapeHtml(formatPriceRange(subscription))}`);
  lines.push("");
  lines.push(`🔎 ${escapeHtml(formatSourceLabels(subscription.sources))}`);
  lines.push("");
  lines.push("<i>Uyğun yeni elanlar avtomatik göndəriləcək.</i>");
  lines.push("");
  lines.push(`/list — siyahı`);
  lines.push(`/sil ${subscription.id} — sil`);
  return lines.join("\n");
}

export function formatListHtml(subscriptions) {
  if (subscriptions.length === 0) {
    return [
      "📋 <b>Axtarışlarınız</b>",
      "",
      "Aktiv axtarış yoxdur.",
      "",
      "Yeni axtarış üçün /start yazın.",
    ].join("\n");
  }
  const lines = ["📋 <b>Axtarışlarınız</b>", ""];
  for (const subscription of subscriptions) {
    const status = subscription.active ? "✅" : "⏸";
    const place = subscription.cityName || "bütün şəhərlər";
    const title = `${propertyTypeShortLabel(subscription.propertyType)} · ${place}`;
    lines.push(`${status} <b>#${subscription.id}</b>  ${escapeHtml(title)}`);
    lines.push(`     ${escapeHtml(formatDetails(subscription))}`);
    lines.push("");
  }
  lines.push("<i>Silmək:</i> /sil ID");
  lines.push("<i>Yeni:</i> /start");
  return lines.join("\n");
}

export function formatHelpHtml() {
  return [
    "🏠 <b>Əmlak axtarış botu</b>",
    "",
    "Elanlar: bina.az · tap.az · ev10.az · yeniemlak.az · emlak.az",
    "",
    "<b>Əmrlər</b>",
    "/start — yeni axtarış",
    "/list — axtarış siyahısı",
    "/sil 1 — axtarışı sil",
    "/clear — seçimləri təmizlə",
    "/help — bu mesaj",
    "",
    "<b>Addımlar</b>",
    "növ → sahə / otaq / şəhər <i>(opsional)</i> → qiymət",
  ].join("\n");
}
