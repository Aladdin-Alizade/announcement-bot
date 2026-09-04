import { allCities, findCityByInput, findCityByListIndex } from "../data/cities.js";
import { PROPERTY_TYPES, propertyTypeFromChoice, propertyTypeFromName } from "../data/propertyType.js";
import {
  clearSession,
  createFromDraft,
  findSession,
  findUserByChatId,
  startFlow,
  updateSession,
} from "../store.js";
import { processSubscription } from "../scrape/scanner.js";
import { sendHtml, editHtml } from "./client.js";
import { formatConfirmationHtml } from "./format.js";
import { escapeHtml } from "./html.js";

const CITIES_PER_PAGE = 12;

const PRICE_MODES = {
  minmax: {
    id: 1,
    label: "↕️  Min – Max",
    prompt: [
      "💰 <b>Qiymət</b>  ·  Min – Max",
      "Minimum və maksimumu yazın (AZN).",
      "",
      "<i>Məsələn: 50000 150000</i>",
    ].join("\n"),
  },
  max: {
    id: 2,
    label: "⬇️  Yalnız maks",
    prompt: [
      "💰 <b>Qiymət</b>  ·  Yalnız maksimum",
      "Maksimum qiyməti yazın (AZN).",
      "",
      "<i>Məsələn: 150000</i>",
    ].join("\n"),
  },
  min: {
    id: 3,
    label: "⬆️  Yalnız min",
    prompt: [
      "💰 <b>Qiymət</b>  ·  Yalnız minimum",
      "Minimum qiyməti yazın (AZN).",
      "",
      "<i>Məsələn: 50000</i>",
    ].join("\n"),
  },
};

function parsePositiveInt(text, min, max) {
  if (!text || !/^\d+$/.test(text.trim())) {
    return null;
  }
  const value = Number(text.trim());
  if (value < min || value > max) {
    return null;
  }
  return value;
}

function parseAmount(raw) {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

export function parsePriceInput(text) {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) {
    return { valid: false, errorMessage: "Qiymət formatı səhvdir. Məsələn: 1 50000 150000" };
  }
  const mode = Number(parts[0]);
  if (!Number.isInteger(mode)) {
    return { valid: false, errorMessage: "İlk rəqəm seçim nömrəsi olmalıdır (1, 2 və ya 3)." };
  }
  if (mode === 1) {
    if (parts.length !== 3) {
      return { valid: false, errorMessage: "Minimum və maksimum üçün: 1 min max (məsələn: 1 50000 150000)" };
    }
    const min = parseAmount(parts[1]);
    const max = parseAmount(parts[2]);
    if (min == null || max == null) {
      return { valid: false, errorMessage: "Qiymət yalnız rəqəm olmalıdır." };
    }
    if (min > max) {
      return { valid: false, errorMessage: "Minimum qiymət maksimumdan böyük ola bilməz." };
    }
    return { valid: true, min, max };
  }
  if (mode === 2 || mode === 3) {
    if (parts.length !== 2) {
      return {
        valid: false,
        errorMessage:
          mode === 2
            ? "Maksimum üçün: 2 qiymət (məsələn: 2 150000)"
            : "Minimum üçün: 3 qiymət (məsələn: 3 50000)",
      };
    }
    const amount = parseAmount(parts[1]);
    if (amount == null) {
      return { valid: false, errorMessage: "Qiymət yalnız rəqəm olmalıdır." };
    }
    return mode === 2 ? { valid: true, min: null, max: amount } : { valid: true, min: amount, max: null };
  }
  return { valid: false, errorMessage: "Seçim 1, 2 və ya 3 olmalıdır." };
}

export function parsePriceAmounts(text, mode) {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  if (mode === 1) {
    if (parts.length !== 2) {
      return { valid: false, errorMessage: "Minimum və maksimum üçün iki rəqəm yazın (məsələn: 50000 150000)" };
    }
    const min = parseAmount(parts[0]);
    const max = parseAmount(parts[1]);
    if (min == null || max == null) {
      return { valid: false, errorMessage: "Qiymət yalnız rəqəm olmalıdır." };
    }
    if (min > max) {
      return { valid: false, errorMessage: "Minimum qiymət maksimumdan böyük ola bilməz." };
    }
    return { valid: true, min, max };
  }
  if (mode === 2 || mode === 3) {
    if (parts.length !== 1) {
      return {
        valid: false,
        errorMessage:
          mode === 2
            ? "Maksimum qiyməti yazın (məsələn: 150000)"
            : "Minimum qiyməti yazın (məsələn: 50000)",
      };
    }
    const amount = parseAmount(parts[0]);
    if (amount == null) {
      return { valid: false, errorMessage: "Qiymət yalnız rəqəm olmalıdır." };
    }
    return mode === 2 ? { valid: true, min: null, max: amount } : { valid: true, min: amount, max: null };
  }
  return { valid: false, errorMessage: "Əvvəlcə qiymət rejimini seçin." };
}

function buttonRows(buttons, perRow) {
  const rows = [];
  for (let i = 0; i < buttons.length; i += perRow) {
    rows.push(buttons.slice(i, i + perRow));
  }
  return rows;
}

function priceKeyboard() {
  return {
    inline_keyboard: [
      [{ text: PRICE_MODES.minmax.label, callback_data: "price:minmax" }],
      [{ text: PRICE_MODES.max.label, callback_data: "price:max" }],
      [{ text: PRICE_MODES.min.label, callback_data: "price:min" }],
    ],
  };
}

function propertyTypeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🏠  Ev (həyət / bağ)", callback_data: "type:house" }],
      [{ text: "🌿  Torpaq", callback_data: "type:land" }],
    ],
  };
}

function skipKeyboard(callbackData) {
  return {
    inline_keyboard: [[{ text: "⏭  Keç", callback_data: callbackData }]],
  };
}

function roomsKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "1", callback_data: "rooms:1" },
        { text: "2", callback_data: "rooms:2" },
        { text: "3", callback_data: "rooms:3" },
      ],
      [
        { text: "4", callback_data: "rooms:4" },
        { text: "5+", callback_data: "rooms:5" },
      ],
      [{ text: "⏭  Keç", callback_data: "rooms:skip" }],
    ],
  };
}

function isSkipText(text) {
  const normalized = text.trim().toLowerCase();
  return normalized === "0" || normalized === "-" || normalized === "kec" || normalized === "keç";
}

function cityPageCount() {
  return Math.max(1, Math.ceil(allCities().length / CITIES_PER_PAGE));
}

function cityKeyboard(page) {
  const cities = allCities();
  const totalPages = cityPageCount();
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const slice = cities.slice(safePage * CITIES_PER_PAGE, (safePage + 1) * CITIES_PER_PAGE);
  const rows = buttonRows(
    slice.map((city) => ({ text: city.name, callback_data: `city:i:${city.listIndex}` })),
    2,
  );
  const nav = [];
  if (safePage > 0) {
    nav.push({ text: "‹ Əvvəlki", callback_data: `city:p:${safePage - 1}` });
  }
  if (safePage < totalPages - 1) {
    nav.push({ text: "Növbəti ›", callback_data: `city:p:${safePage + 1}` });
  }
  if (nav.length) {
    rows.push(nav);
  }
  rows.push([{ text: "⏭  Keç", callback_data: "city:skip" }]);
  return { inline_keyboard: rows };
}

function promptPropertyType() {
  return [
    "🏠 <b>Yeni axtarış</b>",
    "Əmlak növünü seçin:",
  ].join("\n");
}

function promptHouseArea() {
  return [
    "📐 <b>Sahə</b>",
    "Evin sahəsini m² ilə yazın.",
    "",
    "<i>Məsələn: 120</i>",
    "<i>İstəməsəniz Keç basın.</i>",
  ].join("\n");
}

function promptLandArea() {
  return [
    "📐 <b>Sahə</b>",
    "Torpağın sahəsini sot ilə yazın.",
    "",
    "<i>Məsələn: 10</i>",
    "<i>İstəməsəniz Keç basın.</i>",
  ].join("\n");
}

function promptRooms() {
  return [
    "🚪 <b>Otaq sayı</b>",
    "Otaq sayını seçin.",
    "",
    "<i>İstəməsəniz Keç basın.</i>",
  ].join("\n");
}

function promptCity(page) {
  return [
    `📍 <b>Şəhər</b>  ·  ${page + 1}/${cityPageCount()}`,
    "Şəhər və ya rayonu seçin.",
    "",
    "<i>İstəməsəniz Keç basın.</i>",
  ].join("\n");
}

function promptPrice() {
  return [
    "💰 <b>Qiymət</b>",
    "Qiymət rejimini seçin:",
  ].join("\n");
}

async function confirmChoice(query, text, replyMarkup) {
  const messageId = query.message?.message_id;
  const chatId = query.message?.chat?.id;
  if (chatId == null || messageId == null) {
    return;
  }
  try {
    await editHtml(chatId, messageId, text, replyMarkup ? { reply_markup: replyMarkup } : {});
  } catch {
    // köhnə mesaj redaktə olunmasa belə növbəti prompt göndərilir
  }
}

async function askCity(db, chatId, draft) {
  updateSession(db, chatId, "CHOOSE_CITY", draft);
  await sendHtml(chatId, promptCity(0), { reply_markup: cityKeyboard(0) });
}

async function askPrice(db, chatId, draft) {
  updateSession(db, chatId, "CHOOSE_PRICE", draft);
  await sendHtml(chatId, promptPrice(), { reply_markup: priceKeyboard() });
}

async function continueAfterPropertyType(db, chatId, draft, type) {
  draft.propertyType = type.name;
  if (type.name === "HOUSE") {
    updateSession(db, chatId, "HOUSE_AREA_SQM", draft);
    await sendHtml(chatId, promptHouseArea(), {
      reply_markup: skipKeyboard("area:skip"),
    });
  } else {
    updateSession(db, chatId, "LAND_AREA_SOT", draft);
    await sendHtml(chatId, promptLandArea(), {
      reply_markup: skipKeyboard("land:skip"),
    });
  }
}

async function continueAfterArea(db, chatId, draft, areaSqm) {
  draft.areaSqm = areaSqm;
  updateSession(db, chatId, "HOUSE_ROOMS", draft);
  await sendHtml(chatId, promptRooms(), { reply_markup: roomsKeyboard() });
}

async function continueAfterRooms(db, chatId, draft, roomCount) {
  draft.roomCount = roomCount;
  await askCity(db, chatId, draft);
}

async function continueAfterCity(db, chatId, draft, city) {
  if (city) {
    draft.cityId = city.binaCityId;
    draft.cityName = city.name;
  } else {
    draft.cityId = null;
    draft.cityName = null;
  }
  await askPrice(db, chatId, draft);
}

async function continueAfterLandSot(db, chatId, draft, landSot) {
  draft.landSot = landSot;
  await askCity(db, chatId, draft);
}

async function finishAndSubscribe(db, chatId, draft) {
  const user = findUserByChatId(db, chatId);
  if (!user) {
    throw new Error("İstifadəçi tapılmadı");
  }
  const subscription = createFromDraft(db, user, draft);
  try {
    await processSubscription(db, subscription, false);
  } catch {
    // ilkin skan uğursuz olsa belə abunəlik aktiv qalır
  }
  clearSession(db, chatId);
  await sendHtml(chatId, formatConfirmationHtml(subscription));
}

async function handlePropertyType(db, chatId, text, draft) {
  const choice = parsePositiveInt(text, 1, 2);
  let type = choice != null ? propertyTypeFromChoice(choice) : null;
  if (!type) {
    type = propertyTypeFromName(text);
  }
  if (!type) {
    await sendHtml(
      chatId,
      "Düymədən seçin və ya <b>1</b> (ev) / <b>2</b> (torpaq) yazın.",
      { reply_markup: propertyTypeKeyboard() },
    );
    return;
  }
  await continueAfterPropertyType(db, chatId, draft, type);
}

async function handleHouseArea(db, chatId, text, draft) {
  if (isSkipText(text)) {
    await continueAfterArea(db, chatId, draft, null);
    return;
  }
  const area = parsePositiveInt(text, 1, 100_000);
  if (area == null) {
    await sendHtml(chatId, `${promptHouseArea()}\n\n⚠️ Düzgün rəqəm yazın.`, {
      reply_markup: skipKeyboard("area:skip"),
    });
    return;
  }
  await continueAfterArea(db, chatId, draft, area);
}

async function handleHouseRooms(db, chatId, text, draft) {
  if (isSkipText(text)) {
    await continueAfterRooms(db, chatId, draft, null);
    return;
  }
  const rooms = parsePositiveInt(text, 1, 5);
  if (rooms == null) {
    await sendHtml(chatId, `${promptRooms()}\n\n⚠️ Düymədən seçin və ya 1–5 yazın.`, {
      reply_markup: roomsKeyboard(),
    });
    return;
  }
  await continueAfterRooms(db, chatId, draft, rooms);
}

async function handleLandSot(db, chatId, text, draft) {
  if (isSkipText(text)) {
    await continueAfterLandSot(db, chatId, draft, null);
    return;
  }
  const sot = parsePositiveInt(text, 1, 1_000_000);
  if (sot == null) {
    await sendHtml(chatId, `${promptLandArea()}\n\n⚠️ Düzgün rəqəm yazın.`, {
      reply_markup: skipKeyboard("land:skip"),
    });
    return;
  }
  await continueAfterLandSot(db, chatId, draft, sot);
}

async function handleCity(db, chatId, text, draft) {
  if (isSkipText(text)) {
    await continueAfterCity(db, chatId, draft, null);
    return;
  }
  const city = findCityByInput(text);
  if (!city) {
    await sendHtml(chatId, `${promptCity(0)}\n\n⚠️ Şəhər tapılmadı.`, {
      reply_markup: cityKeyboard(0),
    });
    return;
  }
  await continueAfterCity(db, chatId, draft, city);
}

async function applyPrice(db, chatId, draft, price) {
  draft.minPrice = price.min;
  draft.maxPrice = price.max;
  delete draft.priceMode;
  await finishAndSubscribe(db, chatId, draft);
}

async function selectPriceMode(db, chatId, draft, mode, query) {
  draft.priceMode = mode.id;
  updateSession(db, chatId, "CHOOSE_PRICE", draft);
  if (query) {
    await confirmChoice(query, mode.prompt, priceKeyboard());
    return;
  }
  await sendHtml(chatId, mode.prompt, { reply_markup: priceKeyboard() });
}

async function handlePrice(db, chatId, text, draft) {
  if (draft.priceMode) {
    const price = parsePriceAmounts(text, draft.priceMode);
    if (!price.valid) {
      await sendHtml(chatId, `⚠️ ${escapeHtml(price.errorMessage)}`, {
        reply_markup: priceKeyboard(),
      });
      return;
    }
    await applyPrice(db, chatId, draft, price);
    return;
  }
  const price = parsePriceInput(text);
  if (!price.valid) {
    await sendHtml(chatId, `${promptPrice()}\n\n⚠️ Düymələrdən birini seçin.`, {
      reply_markup: priceKeyboard(),
    });
    return;
  }
  await applyPrice(db, chatId, draft, price);
}

export async function handleFlowCallback(db, chatId, query) {
  const session = findSession(db, chatId);
  if (!session || session.state === "IDLE") {
    return;
  }
  const data = String(query.data || "");
  const [kind, a, b] = data.split(":");
  const draft = session.draft || {};

  if (kind === "type" && session.state === "CHOOSE_PROPERTY_TYPE") {
    const type = a === "house" ? PROPERTY_TYPES.HOUSE : a === "land" ? PROPERTY_TYPES.LAND : null;
    if (!type) {
      return;
    }
    await confirmChoice(query, `✅ <b>${escapeHtml(type.label)}</b>`);
    await continueAfterPropertyType(db, chatId, draft, type);
    return;
  }

  if (kind === "area" && session.state === "HOUSE_AREA_SQM") {
    if (a === "skip") {
      await confirmChoice(query, "📐 Sahə: <i>fərq etməz</i>");
      await continueAfterArea(db, chatId, draft, null);
    }
    return;
  }

  if (kind === "land" && session.state === "LAND_AREA_SOT") {
    if (a === "skip") {
      await confirmChoice(query, "📐 Sahə: <i>fərq etməz</i>");
      await continueAfterLandSot(db, chatId, draft, null);
    }
    return;
  }

  if (kind === "rooms" && session.state === "HOUSE_ROOMS") {
    if (a === "skip") {
      await confirmChoice(query, "🚪 Otaq: <i>fərq etməz</i>");
      await continueAfterRooms(db, chatId, draft, null);
      return;
    }
    const rooms = Number(a);
    if (!Number.isInteger(rooms) || rooms < 1 || rooms > 5) {
      return;
    }
    await confirmChoice(query, `🚪 Otaq: <b>${rooms === 5 ? "5+" : rooms}</b>`);
    await continueAfterRooms(db, chatId, draft, rooms);
    return;
  }

  if (kind === "city" && session.state === "CHOOSE_CITY") {
    if (a === "skip") {
      await confirmChoice(query, "📍 Şəhər: <i>bütün şəhərlər</i>");
      await continueAfterCity(db, chatId, draft, null);
      return;
    }
    if (a === "p") {
      const page = Number(b);
      if (!Number.isInteger(page) || page < 0 || page >= cityPageCount()) {
        return;
      }
      await confirmChoice(query, promptCity(page), cityKeyboard(page));
      return;
    }
    if (a === "i") {
      const city = findCityByListIndex(Number(b));
      if (!city) {
        return;
      }
      await confirmChoice(query, `📍 <b>${escapeHtml(city.name)}</b>`);
      await continueAfterCity(db, chatId, draft, city);
    }
    return;
  }

  if (kind === "price" && session.state === "CHOOSE_PRICE") {
    const mode = PRICE_MODES[a];
    if (!mode) {
      return;
    }
    await selectPriceMode(db, chatId, draft, mode, query);
  }
}

export async function startConversation(db, chatId, user) {
  startFlow(db, user, chatId);
  await sendHtml(chatId, promptPropertyType(), { reply_markup: propertyTypeKeyboard() });
}

export async function clearFlow(db, chatId) {
  clearSession(db, chatId);
  await sendHtml(
    chatId,
    "🧹 Seçimlər təmizləndi.\nYenidən başlamaq üçün /start yazın.",
  );
}

export async function handleStep(db, chatId, text) {
  const session = findSession(db, chatId);
  if (!session || session.state === "IDLE") {
    await sendHtml(chatId, "Aktiv seçim axını yoxdur.\nBaşlamaq üçün /start yazın.");
    return;
  }
  const draft = session.draft || {};
  switch (session.state) {
    case "CHOOSE_PROPERTY_TYPE":
      await handlePropertyType(db, chatId, text, draft);
      break;
    case "HOUSE_AREA_SQM":
      await handleHouseArea(db, chatId, text, draft);
      break;
    case "HOUSE_ROOMS":
      await handleHouseRooms(db, chatId, text, draft);
      break;
    case "LAND_AREA_SOT":
      await handleLandSot(db, chatId, text, draft);
      break;
    case "CHOOSE_CITY":
      await handleCity(db, chatId, text, draft);
      break;
    case "CHOOSE_PRICE":
      await handlePrice(db, chatId, text, draft);
      break;
    default:
      await sendHtml(chatId, "Naməlum addım.\n/clear yazıb yenidən başlayın.");
  }
}
