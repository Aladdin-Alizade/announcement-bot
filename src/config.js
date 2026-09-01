function envFlag(name, fallback = true) {
  const raw = process.env[name];
  if (raw == null || raw === "") {
    return fallback;
  }
  return raw.toLowerCase() !== "false" && raw !== "0";
}

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const config = {
  port: envNumber("PORT", 3000),
  sqlitePath: process.env.SQLITE_PATH || "./data/announcement.db",
  telegram: {
    enabled: envFlag("TELEGRAM_ENABLED", true),
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    pollingIntervalMs: envNumber("TELEGRAM_POLLING_INTERVAL_MS", 1500),
  },
  scraper: {
    enabled: envFlag("SCRAPER_ENABLED", true),
    pollIntervalMs: envNumber("SCRAPER_POLL_INTERVAL_MS", 1_800_000),
    requestDelayMs: envNumber("SCRAPER_REQUEST_DELAY_MS", 2500),
    maxResultsPerSource: envNumber("SCRAPER_MAX_RESULTS", 40),
    userAgent:
      process.env.SCRAPER_USER_AGENT ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    httpProxy: process.env.SCRAPER_HTTP_PROXY || "",
    flaresolverrUrl: process.env.SCRAPER_FLARESOLVERR_URL || "",
  },
};
