import { config } from "../config.js";
import { currentOffset, saveOffset } from "../store.js";
import { getUpdates } from "./client.js";
import { handleCallbackQuery, handleMessage } from "./commands.js";

const CONFLICT_BACKOFF_MS = 15_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(err) {
  return err?.name === "AbortError" || err?.code === "ABORT_ERR";
}

function isConflictError(err) {
  return String(err?.message || "").includes("terminated by other getUpdates");
}

export function startTelegramPoller(db) {
  console.log("Telegram polling başladı");
  let running = true;
  let abort = null;

  const stop = () => {
    running = false;
    abort?.abort();
  };

  const loop = async () => {
    while (running) {
      abort = new AbortController();
      try {
        if (!config.telegram.botToken) {
          await sleep(config.telegram.pollingIntervalMs);
          continue;
        }
        const offset = currentOffset(db);
        const response = await getUpdates(offset, abort.signal);
        if (!running) {
          break;
        }
        const updates = response.result || [];
        let nextOffset = offset;
        for (const update of updates) {
          nextOffset = update.update_id + 1;
          if (update.message) {
            try {
              await handleMessage(db, update.message);
            } catch (err) {
              console.error(`Telegram mesajı emal olunmadı: updateId=${update.update_id}`, err);
            }
          } else if (update.callback_query) {
            try {
              await handleCallbackQuery(db, update.callback_query);
            } catch (err) {
              console.error(`Telegram düyməsi emal olunmadı: updateId=${update.update_id}`, err);
            }
          }
        }
        if (updates.length > 0) {
          saveOffset(db, nextOffset);
        }
      } catch (err) {
        if (!running || isAbortError(err)) {
          break;
        }
        if (isConflictError(err)) {
          console.warn(
            "Telegram poll conflict: eyni anda iki instans getUpdates çağırır (adətən Railway deploy). 15s gözlənilir.",
          );
          await sleep(CONFLICT_BACKOFF_MS);
          continue;
        }
        console.error("Telegram poll xətası", err);
        await sleep(config.telegram.pollingIntervalMs);
      }
      if (running) {
        await sleep(config.telegram.pollingIntervalMs);
      }
    }
    console.log("Telegram polling dayandı");
  };
  loop();
  return stop;
}
