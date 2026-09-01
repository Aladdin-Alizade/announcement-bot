import { config } from "./config.js";
import { openDb } from "./db.js";
import { startHealthServer } from "./health.js";
import { startScanLoop } from "./scrape/scanner.js";
import { startTelegramPoller } from "./telegram/poller.js";

const db = openDb(config.sqlitePath);
startHealthServer(config.port, db);

if (config.telegram.enabled && config.telegram.botToken) {
  startTelegramPoller(db);
} else {
  console.warn("Telegram deaktivdir — TELEGRAM_BOT_TOKEN təyin edin.");
}

if (config.scraper.enabled) {
  startScanLoop(db);
} else {
  console.warn("Scraper deaktivdir.");
}

console.log(`SQLite: ${config.sqlitePath}`);
