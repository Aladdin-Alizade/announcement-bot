export function escapeHtml(value) {
  if (value == null) {
    return "";
  }
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function escapeHref(url) {
  if (url == null) {
    return "";
  }
  return String(url).replaceAll("&", "&amp;");
}

function formatPrice(price) {
  if (price == null) {
    return "";
  }
  if (Number.isInteger(price)) {
    return String(price);
  }
  return String(price);
}

export function formatListingMessage(listing) {
  const lines = [
    `🆕 <b>Yeni elan</b> (${listing.sourceLabel || listing.source})`,
    "",
    `<b>${escapeHtml(listing.title)}</b>`,
  ];
  if (listing.price != null) {
    let priceLine = `💰 ${formatPrice(listing.price)}`;
    if (listing.currency) {
      priceLine += ` ${listing.currency}`;
    }
    lines.push(priceLine);
  }
  if (listing.region && listing.region.trim()) {
    lines.push(`📍 ${escapeHtml(listing.region)}`);
  }
  lines.push("");
  lines.push(`🔗 <a href="${escapeHref(listing.url)}">Elana bax</a>`);
  return lines.join("\n");
}
