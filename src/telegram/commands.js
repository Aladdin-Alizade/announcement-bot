import { deleteSubscription, isInFlow, listForUser, registerUser } from "../store.js";
import { answerCallbackQuery, sendHtml, sendText } from "./client.js";
import { clearFlow, handleFlowCallback, handleStep, startConversation } from "./conversation.js";
import { formatListHtml } from "./format.js";

function extractCommand(text) {
  const space = text.indexOf(" ");
  return space < 0 ? text : text.slice(0, space);
}

function isClearCommand(text) {
  const normalized = text.trim().toLocaleLowerCase("az");
  return (
    normalized === "clear" ||
    normalized === "/clear" ||
    normalized === "təmizlə" ||
    normalized === "temizle"
  );
}

function helpText() {
  return `🏠 Əmlak axtarış botu

Elanlar: bina.az, tap.az, ev10.az, yeniemlak.az, emlak.az

/start — yeni axtarış yarat
/list — axtarışların siyahısı
/sil 1 — axtarışı sil
/clear — seçimləri təmizlə
/help — bu mesaj

Addımlar: növ → sahə / otaq / şəhər (hamısı opsional) → qiymət`;
}

async function handleList(db, chatId, user) {
  const subscriptions = listForUser(db, user);
  await sendHtml(chatId, formatListHtml(subscriptions));
}

async function handleDelete(db, chatId, user, text) {
  const parts = text.split(/\s+/);
  if (parts.length < 2) {
    await sendText(chatId, "Belə yazın: /sil 1");
    return;
  }
  const id = Number(parts[1]);
  if (!Number.isInteger(id)) {
    await sendText(chatId, "Nömrə rəqəm olmalıdır. Məsələn: /sil 1");
    return;
  }
  const removed = deleteSubscription(db, id, user);
  await sendText(chatId, removed ? `Axtarış #${id} silindi.` : "Belə bir axtarış tapılmadı.");
}

async function handleCommand(db, chatId, user, text) {
  const command = extractCommand(text).toLowerCase();
  switch (command) {
    case "/start":
    case "/basla":
    case "/başla":
      await startConversation(db, chatId, user);
      break;
    case "/help":
    case "/komek":
    case "/kömək":
      await sendText(chatId, helpText());
      break;
    case "/list":
    case "/siyahı":
    case "/siyahi":
      await handleList(db, chatId, user);
      break;
    case "/sil":
    case "/delete":
      await handleDelete(db, chatId, user, text);
      break;
    default:
      await sendText(chatId, "Belə bir əmr yoxdur. /help yazın.");
  }
}

export async function handleCallbackQuery(db, query) {
  if (!query?.id) {
    return;
  }
  const chatId = query.message?.chat?.id;
  try {
    if (chatId == null) {
      return;
    }
    registerUser(db, chatId, query.from?.username, query.from?.first_name, query.from?.language_code);
    await handleFlowCallback(db, chatId, query);
  } finally {
    try {
      await answerCallbackQuery(query.id);
    } catch {
      // sorğu artıq cavablanıb və ya vaxtı keçib
    }
  }
}

export async function handleMessage(db, message) {
  if (!message?.text || !message.text.trim()) {
    return;
  }
  const chatId = message.chat.id;
  const user = registerUser(
    db,
    chatId,
    message.chat.username,
    message.chat.first_name,
    message.from?.language_code,
  );
  const text = message.text.trim();
  if (isClearCommand(text)) {
    await clearFlow(db, chatId);
    return;
  }
  if (text.startsWith("/")) {
    await handleCommand(db, chatId, user, text);
    return;
  }
  if (isInFlow(db, chatId)) {
    await handleStep(db, chatId, text);
    return;
  }
  await sendText(chatId, "Başlamaq üçün /start yazın. Kömək üçün: /help");
}
