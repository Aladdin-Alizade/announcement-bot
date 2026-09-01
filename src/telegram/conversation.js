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
import { editText, sendText } from "./client.js";

const CITIES_PER_PAGE = 12;

const PRICE_MODES = {
  minmax: {
    id: 1,
    label: "Min və max",
    prompt: "Minimum və maksimum qiyməti yazın.\nNümunə: 50000 150000",
  },
  max: {
    id: 2,
    label: "Yalnız max",
    prompt: "Maksimum qiyməti yazın.\nNümunə: 150000",
  },
  min: {
    id: 3,
    label: "Yalnız min",
    prompt: "Minimum qiyməti yazın.\nNümunə: 50000",
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
    return { valid: false, errorMessage: "Qiymət formatı səhvdir. Nümunə: 1 50000 150000" };
  }
  const mode = Number(parts[0]);
  if (!Number.isInteger(mode)) {
    return { valid: false, errorMessage: "İlk simvol seçim nömrəsi olmalıdır (1, 2 və ya 3)." };
  }
  if (mode === 1) {
    if (parts.length !== 3) {
      return { valid: false, errorMessage: "Min-max üçün: 1 min max (məs: 1 50000 150000)" };
    }
    const min = parseAmount(parts[1]);
    const max = parseAmount(parts[2]);
    if (min == null || max == null) {
      return { valid: false, errorMessage: "Qiymət yalnız rəqəm olmalıdır." };
    }
    if (min > max) {
      return { valid: false, errorMessage: "Minimum maksimumdan böyük ola bilməz." };
    }
    return { valid: true, min, max };
  }
  if (mode === 2 || mode === 3) {
    if (parts.length !== 2) {
      return {
        valid: false,
        errorMessage: mode === 2 ? "Max üçün: 2 qiymət (məs: 2 150000)" : "Min üçün: 3 qiymət (məs: 3 50000)",
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
      return { valid: false, errorMessage: "Min-max üçün iki rəqəm yazın (məs: 50000 150000)" };
    }
    const min = parseAmount(parts[0]);
    const max = parseAmount(parts[1]);
    if (min == null || max == null) {
      return { valid: false, errorMessage: "Qiymət yalnız rəqəm olmalıdır." };
    }
    if (min > max) {
      return { valid: false, errorMessage: "Minimum maksimumdan böyük ola bilməz." };
    }
    return { valid: true, min, max };
  }
  if (mode === 2 || mode === 3) {
    if (parts.length !== 1) {
      return {
        valid: false,
        errorMessage: mode === 2 ? "Maksimum qiyməti yazın (məs: 150000)" : "Minimum qiyməti yazın (məs: 50000)",
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
      [{ text: "Ev (həyət / bağ)", callback_data: "type:house" }],
      [{ text: "Torpaq", callback_data: "type:land" }],
    ],
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
        { text: "Keç", callback_data: "rooms:skip" },
      ],
    ],
  };
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
    nav.push({ text: "« Əvvəl", callback_data: `city:p:${safePage - 1}` });
  }
  if (safePage < totalPages - 1) {
    nav.push({ text: "Növbəti »", callback_data: `city:p:${safePage + 1}` });
  }
  if (nav.length) {
    rows.push(nav);
  }
  return { inline_keyboard: rows };
}

function promptPropertyType() {
  return "Əmlak növünü seçin:";
}

function promptRooms() {
  return "Otaq sayını seçin:";
}

function promptCity(page) {
  return `Şəhər / rayon seçin (${page + 1}/${cityPageCount()}):`;
}

function promptPrice() {
  return "Qiymət rejimini seçin (AZN):";
}

async function confirmChoice(query, text, replyMarkup) {
  const messageId = query.message?.message_id;
  const chatId = query.message?.chat?.id;
  if (chatId == null || messageId == null) {
    return;
  }
  try {
    await editText(chatId, messageId, text, replyMarkup ? { reply_markup: replyMarkup } : {});
  } catch {
    // köhnə mesaj redaktə olunmasa belə növbəti prompt göndərilir
  }
}

function formatPriceRange(subscription) {
  if (subscription.minPrice == null && subscription.maxPrice == null) {
    return "məhdudiyyət yoxdur";
  }
  if (subscription.minPrice != null && subscription.maxPrice != null) {
    return `${subscription.minPrice} – ${subscription.maxPrice} AZN`;
  }
  if (subscription.minPrice != null) {
    return `${subscription.minPrice} AZN-dan`;
  }
  return `${subscription.maxPrice} AZN-a qədər`;
}

function formatConfirmation(subscription) {
  const lines = [`✅ Axtarış aktivdir (#${subscription.id})`, "", `Növ: ${subscription.propertyType}`];
  if (subscription.areaSqm != null) {
    lines.push(`Sahə: ${subscription.areaSqm} m²`);
  }
  if (subscription.landSot != null) {
    lines.push(`Sahə: ${subscription.landSot} sot`);
  }
  if (subscription.roomCount != null) {
    lines.push(`Otaq: ${subscription.roomCount}`);
  }
  lines.push(`Şəhər: ${subscription.cityName}`);
  lines.push(`Qiymət: ${formatPriceRange(subscription)}`);
  lines.push(`Mənbələr: ${subscription.sources}`);
  lines.push("");
  lines.push("Yeni uyğun elanlar avtomatik göndəriləcək.");
  lines.push("Sıfırlamaq: /clear | Siyahı: /list");
  return lines.join("\n");
}

async function askCity(db, chatId, draft) {
  updateSession(db, chatId, "CHOOSE_CITY", draft);
  await sendText(chatId, promptCity(0), { reply_markup: cityKeyboard(0) });
}

async function askPrice(db, chatId, draft) {
  updateSession(db, chatId, "CHOOSE_PRICE", draft);
  await sendText(chatId, promptPrice(), { reply_markup: priceKeyboard() });
}

async function continueAfterPropertyType(db, chatId, draft, type) {
  draft.propertyType = type.name;
  if (type.name === "HOUSE") {
    updateSession(db, chatId, "HOUSE_AREA_SQM", draft);
    await sendText(chatId, "Ev üçün sahə (kv metr) yazın. Yalnız rəqəm.");
  } else {
    updateSession(db, chatId, "LAND_AREA_SOT", draft);
    await sendText(chatId, "Torpaq üçün sahə (sot) yazın. Yalnız rəqəm.");
  }
}

async function continueAfterRooms(db, chatId, draft, roomCount) {
  draft.roomCount = roomCount;
  await askCity(db, chatId, draft);
}

async function continueAfterCity(db, chatId, draft, city) {
  draft.cityId = city.binaCityId;
  draft.cityName = city.name;
  await askPrice(db, chatId, draft);
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
  await sendText(chatId, formatConfirmation(subscription));
}

async function handlePropertyType(db, chatId, text, draft) {
  const choice = parsePositiveInt(text, 1, 2);
  let type = choice != null ? propertyTypeFromChoice(choice) : null;
  if (!type) {
    type = propertyTypeFromName(text);
  }
  if (!type) {
    await sendText(chatId, "Düymədən seçin, və ya 1 (ev) / 2 (torpaq) yazın.", {
      reply_markup: propertyTypeKeyboard(),
    });
    return;
  }
  await continueAfterPropertyType(db, chatId, draft, type);
}

async function handleHouseArea(db, chatId, text, draft) {
  const area = parsePositiveInt(text, 1, 100_000);
  if (area == null) {
    await sendText(chatId, "Düzgün kv metr dəyəri daxil edin (məs: 120).");
    return;
  }
  draft.areaSqm = area;
  updateSession(db, chatId, "HOUSE_ROOMS", draft);
  await sendText(chatId, promptRooms(), { reply_markup: roomsKeyboard() });
}

async function handleHouseRooms(db, chatId, text, draft) {
  const normalized = text.trim().toLowerCase();
  if (normalized === "0" || normalized === "-" || normalized === "kec" || normalized === "keç") {
    await continueAfterRooms(db, chatId, draft, null);
    return;
  }
  const rooms = parsePositiveInt(text, 1, 5);
  if (rooms == null) {
    await sendText(chatId, "Düymədən seçin, və ya 1–5 / Keç yazın.", { reply_markup: roomsKeyboard() });
    return;
  }
  await continueAfterRooms(db, chatId, draft, rooms);
}

async function handleLandSot(db, chatId, text, draft) {
  const sot = parsePositiveInt(text, 1, 1_000_000);
  if (sot == null) {
    await sendText(chatId, "Düzgün sot dəyəri daxil edin (məs: 10).");
    return;
  }
  draft.landSot = sot;
  await askCity(db, chatId, draft);
}

async function handleCity(db, chatId, text, draft) {
  const city = findCityByInput(text);
  if (!city) {
    await sendText(chatId, "Şəhər tapılmadı. Düymədən seçin və ya ad yazın.", {
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

async function handlePrice(db, chatId, text, draft) {
  if (draft.priceMode) {
    const price = parsePriceAmounts(text, draft.priceMode);
    if (!price.valid) {
      await sendText(chatId, price.errorMessage);
      return;
    }
    await applyPrice(db, chatId, draft, price);
    return;
  }
  const price = parsePriceInput(text);
  if (!price.valid) {
    await sendText(chatId, "Aşağıdakı düymələrdən birini seçin, sonra qiyməti yazın.", {
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
    await confirmChoice(query, `Növ: ${type.label}`);
    await continueAfterPropertyType(db, chatId, draft, type);
    return;
  }

  if (kind === "rooms" && session.state === "HOUSE_ROOMS") {
    if (a === "skip") {
      await confirmChoice(query, "Otaq: fərq etməz");
      await continueAfterRooms(db, chatId, draft, null);
      return;
    }
    const rooms = Number(a);
    if (!Number.isInteger(rooms) || rooms < 1 || rooms > 5) {
      return;
    }
    await confirmChoice(query, `Otaq: ${rooms === 5 ? "5+" : rooms}`);
    await continueAfterRooms(db, chatId, draft, rooms);
    return;
  }

  if (kind === "city" && session.state === "CHOOSE_CITY") {
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
      await confirmChoice(query, `Şəhər: ${city.name}`);
      await continueAfterCity(db, chatId, draft, city);
    }
    return;
  }

  if (kind === "price" && session.state === "CHOOSE_PRICE") {
    const mode = PRICE_MODES[a];
    if (!mode) {
      return;
    }
    draft.priceMode = mode.id;
    updateSession(db, chatId, "CHOOSE_PRICE", draft);
    await confirmChoice(query, `Qiymət: ${mode.label}`);
    await sendText(chatId, mode.prompt);
  }
}

export async function startConversation(db, chatId, user) {
  startFlow(db, user, chatId);
  await sendText(chatId, promptPropertyType(), { reply_markup: propertyTypeKeyboard() });
}

export async function clearFlow(db, chatId) {
  clearSession(db, chatId);
  await sendText(chatId, "Seçimlər sıfırlandı. Yenidən başlamaq üçün /start yazın.");
}

export async function handleStep(db, chatId, text) {
  const session = findSession(db, chatId);
  if (!session || session.state === "IDLE") {
    await sendText(chatId, "Aktiv seçim axını yoxdur. Başlamaq üçün /start yazın.");
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
      await sendText(chatId, "Naməlum addım. /clear ilə sıfırlayın.");
  }
}
