import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import {
  createFromDraft,
  deleteSubscription,
  isSeen,
  listForUser,
  markSeen,
  pruneOldSeenListings,
  registerUser,
} from "../src/store.js";

test("creates subscription, lists, deletes, and tracks seen listings", () => {
  const db = openDb(":memory:");
  const user = registerUser(db, 42, "ali", "Ali", "az");
  const subscription = createFromDraft(db, user, {
    propertyType: "LAND",
    landSot: 3,
    cityId: 1,
    cityName: "Bakı",
    maxPrice: 10000,
  });
  assert.equal(subscription.name, "Torpaq — Bakı");
  assert.equal(subscription.active, true);
  assert.equal(listForUser(db, user).length, 1);
  assert.equal(isSeen(db, subscription.id, "BINA_AZ", "99"), false);
  markSeen(db, subscription.id, "BINA_AZ", "99");
  assert.equal(isSeen(db, subscription.id, "BINA_AZ", "99"), true);
  const removed = deleteSubscription(db, subscription.id, user);
  assert.equal(removed.id, subscription.id);
  assert.equal(listForUser(db, user).length, 0);
  assert.equal(isSeen(db, subscription.id, "BINA_AZ", "99"), false);
  db.close();
});

test("pruneOldSeenListings removes rows older than retention days", () => {
  const db = openDb(":memory:");
  const user = registerUser(db, 7, "ali", "Ali", "az");
  const subscription = createFromDraft(db, user, {
    propertyType: "HOUSE",
    areaSqm: 80,
    cityId: 1,
    cityName: "Bakı",
    minPrice: 10000,
    maxPrice: 50000,
  });
  const oldIso = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO seen_listings (subscription_id, source, external_id, notified_at)
     VALUES (?, ?, ?, ?)`,
  ).run(subscription.id, "BINA_AZ", "old", oldIso);
  markSeen(db, subscription.id, "BINA_AZ", "fresh");
  assert.equal(pruneOldSeenListings(db, 30), 1);
  assert.equal(isSeen(db, subscription.id, "BINA_AZ", "old"), false);
  assert.equal(isSeen(db, subscription.id, "BINA_AZ", "fresh"), true);
  db.close();
});
