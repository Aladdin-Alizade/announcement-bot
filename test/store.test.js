import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../src/db.js";
import {
  createFromDraft,
  deactivateSubscription,
  isSeen,
  listForUser,
  markSeen,
  registerUser,
} from "../src/store.js";

test("creates subscription, lists, deactivates, and tracks seen listings", () => {
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
  const stopped = deactivateSubscription(db, subscription.id, user);
  assert.equal(stopped.active, false);
  db.close();
});
