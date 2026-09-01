import { config } from "../config.js";
import { currentOffset, saveOffset } from "../store.js";
import { getUpdates } from "./client.js";
import { handleCallbackQuery, handleMessage } from "./commands.js";

const CONFLICT_BACKOFF_MS = 15_000;

function sleep(ms, signal) {
  if (signal?.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
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
  const abort = new AbortController();

  const stop = () => {
    running = false;
    abort.abort();
  };

  const loop = async () => {
    while (running) {
      try {
        if (!config.telegram.botToken) {
          await sleep(config.telegram.pollingIntervalMs, abort.signal);
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
          await sleep(CONFLICT_BACKOFF_MS, abort.signal);
          continue;
        }
        console.error("Telegram poll xətası", err);
        await sleep(config.telegram.pollingIntervalMs, abort.signal);
      }
      if (running) {
        await sleep(config.telegram.pollingIntervalMs, abort.signal);
      }
    }
    console.log("Telegram polling dayandı");
  };
  loop();
  return stop;
}
