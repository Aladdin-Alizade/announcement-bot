import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS telegram_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL UNIQUE,
    username TEXT,
    first_name TEXT,
    language_code TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS search_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sources TEXT NOT NULL DEFAULT 'bina,tap,ev10,yeniemlak,emlak',
    keywords TEXT,
    property_type TEXT,
    bina_category_id INTEGER,
    city_id INTEGER,
    city_name TEXT,
    area_sqm INTEGER,
    land_sot INTEGER,
    room_count INTEGER,
    min_price INTEGER,
    max_price INTEGER,
    city TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES telegram_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON search_subscriptions (active);

CREATE TABLE IF NOT EXISTS seen_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    source TEXT NOT NULL,
    external_id TEXT NOT NULL,
    notified_at TEXT NOT NULL,
    UNIQUE (subscription_id, source, external_id),
    FOREIGN KEY (subscription_id) REFERENCES search_subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_seen_notified_at ON seen_listings (notified_at);

CREATE TABLE IF NOT EXISTS app_state (
    state_key TEXT PRIMARY KEY,
    state_value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_conversation_sessions (
    chat_id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    state TEXT NOT NULL,
    draft_json TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES telegram_users(id) ON DELETE CASCADE
);
`;

export function nowIso() {
  return new Date().toISOString();
}

export function openDb(sqlitePath) {
  const db =
    sqlitePath === ":memory:"
      ? new Database(":memory:")
      : (() => {
          const resolved = path.resolve(sqlitePath);
          fs.mkdirSync(path.dirname(resolved), { recursive: true });
          return new Database(resolved);
        })();
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA);
  return db;
}
