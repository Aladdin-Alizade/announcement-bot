import { deactivateSubscription, isInFlow, listForUser, registerUser } from "../store.js";
import { answerCallbackQuery, sendText } from "./client.js";
import { clearFlow, handlePriceCallback, handleStep, startConversation } from "./conversation.js";

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

Mənbələr: bina.az, tap.az, ev10.az, yeniemlak.az, emlak.az

/start — seçim axınına başla
/clear və ya clear — seçimləri sıfırla
/list — aktiv axtarışlar
/sil ID — axtarışı dayandır (məs: /sil 1)

Axın:
1) Ev (1) və ya Torpaq (2)
2) Sahə (ev: m², torpaq: sot)
3) Ev üçün otaq (0/- ilə keç)
4) Şəhər (nömrə və ya ad)
5) Qiymət (düymə ilə rejim, sonra rəqəm)`;
}

async function handleList(db, chatId, user) {
  const subscriptions = listForUser(db, user);
  if (subscriptions.length === 0) {
    await sendText(chatId, "Aktiv axtarışınız yoxdur. /start ilə yeni axtarış yaradın.");
    return;
  }
  const lines = ["📋 Axtarışlarınız:", ""];
  for (const subscription of subscriptions) {
    lines.push(`#${subscription.id}${subscription.active ? " ✅ " : " ⏸ "}${subscription.name}`);
  }
  lines.push("");
  lines.push("Dayandırmaq: /sil ID");
  lines.push("Yeni axtarış: /start");
  await sendText(chatId, lines.join("\n"));
}

async function handleDelete(db, chatId, user, text) {
  const parts = text.split(/\s+/);
  if (parts.length < 2) {
    await sendText(chatId, "İstifadə: /sil ID (məs: /sil 1)");
    return;
  }
  const id = Number(parts[1]);
  if (!Number.isInteger(id)) {
    await sendText(chatId, "ID rəqəm olmalıdır.");
    return;
  }
  const updated = deactivateSubscription(db, id, user);
  await sendText(chatId, updated ? `Axtarış #${id} dayandırıldı.` : "Axtarış tapılmadı.");
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
      await sendText(chatId, "Naməlum əmr. /help yazın.");
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
    await handlePriceCallback(db, chatId, query);
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
  await sendText(chatId, "Başlamaq üçün /start yazın. Kömək: /help");
}
