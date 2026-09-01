import { config } from "../config.js";
import { currentOffset, saveOffset } from "../store.js";
import { getUpdates } from "./client.js";
import { handleMessage } from "./commands.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startTelegramPoller(db) {
  console.log("Telegram polling başladı");
  let running = true;
  const loop = async () => {
    while (running) {
      try {
        if (!config.telegram.botToken) {
          await sleep(config.telegram.pollingIntervalMs);
          continue;
        }
        const offset = currentOffset(db);
        const response = await getUpdates(offset);
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
          }
        }
        if (updates.length > 0) {
          saveOffset(db, nextOffset);
        }
      } catch (err) {
        console.error("Telegram poll xətası", err);
        await sleep(config.telegram.pollingIntervalMs);
      }
      await sleep(config.telegram.pollingIntervalMs);
    }
  };
  loop();
  return () => {
    running = false;
  };
}
