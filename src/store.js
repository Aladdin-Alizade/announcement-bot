import { nowIso } from "./db.js";
import { DEFAULT_SOURCE_ALIASES } from "./data/sources.js";
import { PROPERTY_TYPES } from "./data/propertyType.js";

function mapUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    chatId: row.chat_id,
    username: row.username,
    firstName: row.first_name,
    languageCode: row.language_code,
  };
}

function mapSubscription(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    sources: row.sources,
    keywords: row.keywords,
    propertyType: row.property_type,
    binaCategoryId: row.bina_category_id,
    cityId: row.city_id,
    cityName: row.city_name,
    areaSqm: row.area_sqm,
    landSot: row.land_sot,
    roomCount: row.room_count,
    minPrice: row.min_price,
    maxPrice: row.max_price,
    city: row.city,
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user:
      row.chat_id != null
        ? { id: row.user_id, chatId: row.chat_id, username: row.username, firstName: row.first_name }
        : undefined,
  };
}

export function registerUser(db, chatId, username, firstName, languageCode) {
  const existing = db.prepare("SELECT * FROM telegram_users WHERE chat_id = ?").get(chatId);
  const ts = nowIso();
  if (existing) {
    db.prepare(
      `UPDATE telegram_users
       SET username = ?, first_name = ?, language_code = ?, updated_at = ?
       WHERE chat_id = ?`,
    ).run(username || null, firstName || null, languageCode || null, ts, chatId);
    return mapUser(db.prepare("SELECT * FROM telegram_users WHERE chat_id = ?").get(chatId));
  }
  const result = db
    .prepare(
      `INSERT INTO telegram_users (chat_id, username, first_name, language_code, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(chatId, username || null, firstName || null, languageCode || null, ts, ts);
  return mapUser(db.prepare("SELECT * FROM telegram_users WHERE id = ?").get(result.lastInsertRowid));
}

export function findUserByChatId(db, chatId) {
  return mapUser(db.prepare("SELECT * FROM telegram_users WHERE chat_id = ?").get(chatId));
}

function buildName(draft) {
  let base = draft.propertyType === "HOUSE" ? "Ev" : "Torpaq";
  if (draft.cityName) {
    base += ` — ${draft.cityName}`;
  }
  return base.length > 120 ? `${base.slice(0, 117)}...` : base;
}

export function createFromDraft(db, user, draft) {
  const type = PROPERTY_TYPES[draft.propertyType];
  const ts = nowIso();
  const result = db
    .prepare(
      `INSERT INTO search_subscriptions (
        user_id, name, sources, keywords, property_type, bina_category_id,
        city_id, city_name, city, area_sqm, land_sot, room_count,
        min_price, max_price, active, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(
      user.id,
      buildName(draft),
      DEFAULT_SOURCE_ALIASES,
      draft.propertyType,
      type.binaCategoryId,
      draft.cityId ?? null,
      draft.cityName ?? null,
      draft.cityName ?? null,
      draft.areaSqm ?? null,
      draft.landSot ?? null,
      draft.roomCount ?? null,
      draft.minPrice ?? null,
      draft.maxPrice ?? null,
      ts,
      ts,
    );
  return findSubscriptionWithUser(db, result.lastInsertRowid);
}

export function listForUser(db, user) {
  return db
    .prepare("SELECT * FROM search_subscriptions WHERE user_id = ? ORDER BY created_at DESC")
    .all(user.id)
    .map(mapSubscription);
}

export function activeSubscriptions(db) {
  return db
    .prepare(
      `SELECT s.*, u.chat_id, u.username, u.first_name
       FROM search_subscriptions s
       JOIN telegram_users u ON u.id = s.user_id
       WHERE s.active = 1`,
    )
    .all()
    .map(mapSubscription);
}

export function findSubscriptionWithUser(db, id) {
  return mapSubscription(
    db
      .prepare(
        `SELECT s.*, u.chat_id, u.username, u.first_name
         FROM search_subscriptions s
         JOIN telegram_users u ON u.id = s.user_id
         WHERE s.id = ?`,
      )
      .get(id),
  );
}

export function deactivateSubscription(db, subscriptionId, user) {
  const row = db
    .prepare("SELECT * FROM search_subscriptions WHERE id = ? AND user_id = ?")
    .get(subscriptionId, user.id);
  if (!row) {
    return null;
  }
  db.prepare("UPDATE search_subscriptions SET active = 0, updated_at = ? WHERE id = ?").run(
    nowIso(),
    subscriptionId,
  );
  return mapSubscription(db.prepare("SELECT * FROM search_subscriptions WHERE id = ?").get(subscriptionId));
}

export function findSession(db, chatId) {
  const row = db.prepare("SELECT * FROM user_conversation_sessions WHERE chat_id = ?").get(chatId);
  if (!row) {
    return null;
  }
  return {
    chatId: row.chat_id,
    userId: row.user_id,
    state: row.state,
    draft: JSON.parse(row.draft_json || "{}"),
  };
}

export function isInFlow(db, chatId) {
  const session = findSession(db, chatId);
  return Boolean(session && session.state !== "IDLE");
}

export function startFlow(db, user, chatId) {
  const ts = nowIso();
  db.prepare(
    `INSERT INTO user_conversation_sessions (chat_id, user_id, state, draft_json, updated_at)
     VALUES (?, ?, 'CHOOSE_PROPERTY_TYPE', '{}', ?)
     ON CONFLICT(chat_id) DO UPDATE SET
       user_id = excluded.user_id,
       state = excluded.state,
       draft_json = excluded.draft_json,
       updated_at = excluded.updated_at`,
  ).run(chatId, user.id, ts);
  return findSession(db, chatId);
}

export function updateSession(db, chatId, state, draft) {
  const ts = nowIso();
  const result = db
    .prepare(
      `UPDATE user_conversation_sessions
       SET state = ?, draft_json = ?, updated_at = ?
       WHERE chat_id = ?`,
    )
    .run(state, JSON.stringify(draft), ts, chatId);
  if (result.changes === 0) {
    throw new Error("Sessiya tapılmadı");
  }
  return findSession(db, chatId);
}

export function clearSession(db, chatId) {
  db.prepare("DELETE FROM user_conversation_sessions WHERE chat_id = ?").run(chatId);
}

export function isSeen(db, subscriptionId, source, externalId) {
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM seen_listings
         WHERE subscription_id = ? AND source = ? AND external_id = ?`,
      )
      .get(subscriptionId, source, externalId),
  );
}

export function markSeen(db, subscriptionId, source, externalId) {
  db.prepare(
    `INSERT OR IGNORE INTO seen_listings (subscription_id, source, external_id, notified_at)
     VALUES (?, ?, ?, ?)`,
  ).run(subscriptionId, source, externalId, nowIso());
}

const OFFSET_KEY = "telegram.update.offset";

export function currentOffset(db) {
  const row = db.prepare("SELECT state_value FROM app_state WHERE state_key = ?").get(OFFSET_KEY);
  return row ? Number(row.state_value) : 0;
}

export function saveOffset(db, offset) {
  const ts = nowIso();
  db.prepare(
    `INSERT INTO app_state (state_key, state_value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(state_key) DO UPDATE SET state_value = excluded.state_value, updated_at = excluded.updated_at`,
  ).run(OFFSET_KEY, String(offset), ts);
}
