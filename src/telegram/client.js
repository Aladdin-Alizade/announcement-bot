import { fetch } from "undici";
import { config } from "../config.js";
import { escapeHtml } from "./html.js";

async function post(method, body) {
  const token = config.telegram.botToken;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN təyin edilməyib");
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(`Telegram ${method} uğursuz: ${payload.description || response.status}`);
  }
  return payload;
}

export async function getUpdates(offset) {
  return post("getUpdates", {
    offset,
    timeout: 25,
    allowed_updates: ["message"],
  });
}

export async function sendMessage(chatId, text) {
  return post("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
  });
}

export async function sendHtml(chatId, html) {
  if (!config.telegram.enabled || !config.telegram.botToken) {
    console.warn(`Telegram aktiv deyil, mesaj göndərilmədi: chatId=${chatId}`);
    return;
  }
  return sendMessage(chatId, html);
}

export async function sendText(chatId, text) {
  return sendHtml(chatId, escapeHtml(text));
}
