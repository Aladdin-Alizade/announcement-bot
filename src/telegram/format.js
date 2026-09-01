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
    `✅ <b>Axtarış aktivdir</b>  ·  #${subscription.id}`,
    "",
    `🏠 Növ: ${escapeHtml(propertyTypeLabel(subscription.propertyType))}`,
  ];
  const area = formatAreaLine(subscription);
  if (area) {
    lines.push(`📐 Sahə: ${area}`);
  }
  const rooms = formatRoomCount(subscription.roomCount);
  if (rooms) {
    lines.push(`🚪 Otaq: ${rooms}`);
  }
  if (subscription.cityName) {
    lines.push(`📍 Şəhər: ${escapeHtml(subscription.cityName)}`);
  }
  lines.push(`💰 Qiymət: ${escapeHtml(formatPriceRange(subscription))}`);
  lines.push(`🔎 Mənbələr: ${escapeHtml(formatSourceLabels(subscription.sources))}`);
  lines.push("");
  lines.push("Uyğun yeni elanlar avtomatik göndəriləcək.");
  lines.push("");
  lines.push("/list — axtarışların siyahısı");
  lines.push("/sil " + subscription.id + " — bu axtarışı dayandır");
  return lines.join("\n");
}

export function formatListHtml(subscriptions) {
  if (subscriptions.length === 0) {
    return "Aktiv axtarışınız yoxdur.\nYeni axtarış üçün /start yazın.";
  }
  const lines = ["📋 <b>Axtarışlarınız</b>", ""];
  for (const subscription of subscriptions) {
    const status = subscription.active ? "✅" : "⏸";
    const title = `${propertyTypeShortLabel(subscription.propertyType)} — ${subscription.cityName || "şəhər yoxdur"}`;
    lines.push(`${status} <b>#${subscription.id}</b>  ${escapeHtml(title)}`);
    lines.push(`    ${escapeHtml(formatDetails(subscription))}`);
    lines.push("");
  }
  lines.push("Dayandırmaq: /sil ID");
  lines.push("Yeni axtarış: /start");
  return lines.join("\n");
}
