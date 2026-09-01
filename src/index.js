import { config } from "./config.js";
import { openDb } from "./db.js";
import { startHealthServer } from "./health.js";
import { startScanLoop } from "./scrape/scanner.js";
import { startTelegramPoller } from "./telegram/poller.js";

const db = openDb(config.sqlitePath);
const healthServer = startHealthServer(config.port, db);

let stopPoller = null;
if (config.telegram.enabled && config.telegram.botToken) {
  stopPoller = startTelegramPoller(db);
} else {
  console.warn("Telegram deaktivdir — TELEGRAM_BOT_TOKEN təyin edin.");
}

if (config.scraper.enabled) {
  startScanLoop(db);
} else {
  console.warn("Scraper deaktivdir.");
}

console.log(`SQLite: ${config.sqlitePath}`);

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`${signal} — proses bağlanır`);
  stopPoller?.();
  healthServer.close(() => {
    try {
      db.close();
    } catch {
      // artıq bağlıdır
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
