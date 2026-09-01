import { findCityByInput, formatCityList } from "../data/cities.js";
import { propertyTypeFromChoice, propertyTypeFromName } from "../data/propertyType.js";
import {
  clearSession,
  createFromDraft,
  findSession,
  findUserByChatId,
  startFlow,
  updateSession,
} from "../store.js";
import { processSubscription } from "../scrape/scanner.js";
import { sendText } from "./client.js";

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

function promptPropertyType() {
  return `Əmlak növünü seçin:
1 — Ev (həyət evi / bağ evi)
2 — Torpaq

Cavab olaraq 1 və ya 2 yazın.
Sıfırlamaq: /clear`;
}

function promptPrice() {
  return `Qiymət (AZN, yalnız rəqəm):

1) Min və max:  1 50000 150000
2) Yalnız max:  2 150000
3) Yalnız min:  3 50000

Birinci rəqəm həmişə seçim nömrəsidir (1, 2 və ya 3).`;
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
  await sendText(chatId, `Şəhər / rayon seçin (nömrə və ya ad):\n\n${formatCityList()}`);
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
    await sendText(chatId, "Yalnız 1 (ev) və ya 2 (torpaq) yazın.");
    return;
  }
  draft.propertyType = type.name;
  if (type.name === "HOUSE") {
    updateSession(db, chatId, "HOUSE_AREA_SQM", draft);
    await sendText(chatId, "Ev üçün sahə (kv metr) yazın. Yalnız rəqəm.");
  } else {
    updateSession(db, chatId, "LAND_AREA_SOT", draft);
    await sendText(chatId, "Torpaq üçün sahə (sot) yazın. Yalnız rəqəm.");
  }
}

async function handleHouseArea(db, chatId, text, draft) {
  const area = parsePositiveInt(text, 1, 100_000);
  if (area == null) {
    await sendText(chatId, "Düzgün kv metr dəyəri daxil edin (məs: 120).");
    return;
  }
  draft.areaSqm = area;
  updateSession(db, chatId, "HOUSE_ROOMS", draft);
  await sendText(
    chatId,
    `Otaq sayı (istəyə bağlı):
1, 2, 3, 4 və ya 5 (5+ otaq)
Keçmək üçün: 0 və ya -`,
  );
}

async function handleHouseRooms(db, chatId, text, draft) {
  const normalized = text.trim().toLowerCase();
  if (normalized === "0" || normalized === "-" || normalized === "kec") {
    draft.roomCount = null;
  } else {
    const rooms = parsePositiveInt(text, 1, 5);
    if (rooms == null) {
      await sendText(chatId, "1–5 arası rəqəm, və ya keçmək üçün 0 / - yazın.");
      return;
    }
    draft.roomCount = rooms;
  }
  await askCity(db, chatId, draft);
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
    await sendText(chatId, "Şəhər tapılmadı. Siyahıdan nömrə və ya ad yazın.");
    return;
  }
  draft.cityId = city.binaCityId;
  draft.cityName = city.name;
  updateSession(db, chatId, "CHOOSE_PRICE", draft);
  await sendText(chatId, promptPrice());
}

async function handlePrice(db, chatId, text, draft) {
  const price = parsePriceInput(text);
  if (!price.valid) {
    await sendText(chatId, price.errorMessage);
    return;
  }
  draft.minPrice = price.min;
  draft.maxPrice = price.max;
  await finishAndSubscribe(db, chatId, draft);
}

export async function startConversation(db, chatId, user) {
  startFlow(db, user, chatId);
  await sendText(chatId, promptPropertyType());
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
