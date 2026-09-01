import { config } from "../config.js";
import { parseSourceSet } from "../data/sources.js";
import { matches } from "./matcher.js";
import { SourceFetchError } from "./http.js";
import { activeSubscriptions, findSubscriptionWithUser, isSeen, markSeen, pruneOldSeenListings } from "../store.js";
import { formatListingMessage } from "../telegram/html.js";
import { sendHtml } from "../telegram/client.js";
import * as bina from "./bina.js";
import * as tap from "./tap.js";
import * as ev10 from "./ev10.js";
import * as yeniemlak from "./yeniemlak.js";
import * as emlak from "./emlak.js";

const FETCHERS = {
  BINA_AZ: bina.fetchListings,
  TAP_AZ: tap.fetchListings,
  EV10_AZ: ev10.fetchListings,
  YENIEMLAK_AZ: yeniemlak.fetchListings,
  EMLAK_AZ: emlak.fetchListings,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function notifyAndMarkSeen(db, subscription, listing) {
  await sendHtml(subscription.user.chatId, formatListingMessage(listing));
  markSeen(db, subscription.id, listing.source, listing.externalId);
}

async function handleListing(db, subscription, listing, sendNotifications) {
  if (!matches(listing, subscription)) {
    return false;
  }
  if (isSeen(db, subscription.id, listing.source, listing.externalId)) {
    return false;
  }
  if (!sendNotifications) {
    markSeen(db, subscription.id, listing.source, listing.externalId);
    return false;
  }
  await notifyAndMarkSeen(db, subscription, listing);
  console.log(
    `Yeni elan bildirişi: subscriptionId=${subscription.id} source=${listing.source} externalId=${listing.externalId} chatId=${subscription.user?.chatId}`,
  );
  return true;
}

export async function processSubscription(db, subscription, sendNotifications = true) {
  const active = findSubscriptionWithUser(db, subscription.id) || subscription;
  console.log(
    `Skan başladı: subscriptionId=${active.id} ad=${active.name} bildiriş=${sendNotifications}`,
  );
  for (const source of parseSourceSet(active.sources)) {
    const fetchListings = FETCHERS[source.name];
    if (!fetchListings) {
      console.warn(`Mənbə dəstəklənmir: ${source.name}`);
      continue;
    }
    try {
      const listings = await fetchListings(active);
      let matched = 0;
      let notified = 0;
      for (const listing of listings) {
        try {
          if (await handleListing(db, active, listing, sendNotifications)) {
            notified += 1;
          } else if (matches(listing, active)) {
            matched += 1;
          }
        } catch (err) {
          if (matches(listing, active)) {
            matched += 1;
          }
          console.error(
            `Elan bildirişi uğursuz: subscriptionId=${active.id} source=${listing.source} externalId=${listing.externalId}`,
            err,
          );
        }
      }
      console.log(
        `Skan bitdi: subscriptionId=${active.id} source=${source.name} elan=${listings.length} uygun=${matched + notified} yeni=${notified}`,
      );
      await sleep(config.scraper.requestDelayMs);
    } catch (err) {
      if (err instanceof SourceFetchError && err.cloudflareBlock) {
        console.warn(`Skan atlandı (Cloudflare): subscription=${active.id}, source=${source.name}, url=${err.url}`);
      } else {
        console.error(`Skan xətası: subscription=${active.id}, source=${source.name}`, err);
      }
    }
  }
}

export async function scanActiveSubscriptions(db) {
  pruneOldSeenListings(db);
  const subscriptions = activeSubscriptions(db);
  console.log(`Skan dövrü: aktiv axtarış=${subscriptions.length}`);
  for (const subscription of subscriptions) {
    await processSubscription(db, subscription, true);
  }
}

export function startScanLoop(db) {
  const run = async () => {
    try {
      await scanActiveSubscriptions(db);
    } catch (err) {
      console.error("Skan dövrü xətası", err);
    }
  };
  setTimeout(run, 5_000);
  setInterval(run, config.scraper.pollIntervalMs);
}
