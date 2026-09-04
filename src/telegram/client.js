import { fetch } from "undici";
import { config } from "../config.js";
import { escapeHtml } from "./html.js";

function requestSignal(external) {
  const timeout = AbortSignal.timeout(90_000);
  if (!external) {
    return timeout;
  }
  return AbortSignal.any([timeout, external]);
}

async function post(method, body, signal) {
  const token = config.telegram.botToken;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN təyin edilməyib");
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: requestSignal(signal),
  });
  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(`Telegram ${method} uğursuz: ${payload.description || response.status}`);
  }
  return payload;
}

export async function getUpdates(offset, signal) {
  return post(
    "getUpdates",
    {
      offset,
      timeout: 25,
      allowed_updates: ["message", "callback_query"],
    },
    signal,
  );
}

export async function sendMessage(chatId, text, extra = {}) {
  return post("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false,
    ...extra,
  });
}

export async function sendHtml(chatId, html, extra = {}) {
  if (!config.telegram.enabled || !config.telegram.botToken) {
    console.warn(`Telegram aktiv deyil, mesaj göndərilmədi: chatId=${chatId}`);
    return;
  }
  return sendMessage(chatId, html, extra);
}

export async function sendText(chatId, text, extra = {}) {
  return sendHtml(chatId, escapeHtml(text), extra);
}

export async function answerCallbackQuery(callbackQueryId, extra = {}) {
  if (!config.telegram.enabled || !config.telegram.botToken) {
    return;
  }
  return post("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...extra,
  });
}

export async function editText(chatId, messageId, text, extra = {}) {
  return editHtml(chatId, messageId, escapeHtml(text), extra);
}

export async function editHtml(chatId, messageId, html, extra = {}) {
  if (!config.telegram.enabled || !config.telegram.botToken) {
    return;
  }
  return post("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [] },
    ...extra,
  });
}
