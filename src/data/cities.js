const CITIES = [
  { listIndex: 1, binaCityId: 1, name: "Bakı" },
  { listIndex: 2, binaCityId: 2, name: "Gəncə" },
  { listIndex: 3, binaCityId: 3, name: "Sumqayıt" },
  { listIndex: 4, binaCityId: 4, name: "Şəmkir" },
  { listIndex: 5, binaCityId: 5, name: "Şirvan" },
  { listIndex: 6, binaCityId: 6, name: "Salyan" },
  { listIndex: 7, binaCityId: 7, name: "Neftçala" },
  { listIndex: 8, binaCityId: 8, name: "Lənkəran" },
  { listIndex: 9, binaCityId: 9, name: "Cəlilabad" },
  { listIndex: 10, binaCityId: 10, name: "İmişli" },
  { listIndex: 11, binaCityId: 11, name: "Astara" },
  { listIndex: 12, binaCityId: 13, name: "Biləsuvar" },
  { listIndex: 13, binaCityId: 14, name: "Saatlı" },
  { listIndex: 14, binaCityId: 15, name: "Sabirabad" },
  { listIndex: 15, binaCityId: 16, name: "Şamaxı" },
  { listIndex: 16, binaCityId: 17, name: "Beyləqan" },
  { listIndex: 17, binaCityId: 18, name: "Bərdə" },
  { listIndex: 18, binaCityId: 19, name: "Şəki" },
  { listIndex: 19, binaCityId: 20, name: "Mingəçevir" },
  { listIndex: 20, binaCityId: 21, name: "Yevlax" },
  { listIndex: 21, binaCityId: 22, name: "Göyçay" },
  { listIndex: 22, binaCityId: 23, name: "Ağdaş" },
  { listIndex: 23, binaCityId: 24, name: "Quba" },
  { listIndex: 24, binaCityId: 25, name: "Qusar" },
  { listIndex: 25, binaCityId: 26, name: "Xaçmaz" },
  { listIndex: 26, binaCityId: 27, name: "Siyəzən" },
  { listIndex: 27, binaCityId: 28, name: "Şabran" },
  { listIndex: 28, binaCityId: 29, name: "Tovuz" },
  { listIndex: 29, binaCityId: 30, name: "Ağstafa" },
  { listIndex: 30, binaCityId: 31, name: "Xudat" },
  { listIndex: 31, binaCityId: 32, name: "Zaqatala" },
  { listIndex: 32, binaCityId: 33, name: "Qax" },
  { listIndex: 33, binaCityId: 34, name: "Xırdalan" },
  { listIndex: 34, binaCityId: 35, name: "Hacıqabul" },
  { listIndex: 35, binaCityId: 36, name: "Oğuz" },
  { listIndex: 36, binaCityId: 37, name: "Masallı" },
  { listIndex: 37, binaCityId: 38, name: "İsmayıllı" },
  { listIndex: 38, binaCityId: 39, name: "Qəbələ" },
  { listIndex: 39, binaCityId: 41, name: "Xızı" },
  { listIndex: 40, binaCityId: 74, name: "Goranboy" },
  { listIndex: 41, binaCityId: 75, name: "Ağsu" },
  { listIndex: 42, binaCityId: 76, name: "Balakən" },
  { listIndex: 43, binaCityId: 77, name: "Kəlbəcər" },
  { listIndex: 44, binaCityId: 79, name: "Qazax" },
  { listIndex: 45, binaCityId: 80, name: "Naxçıvan MR" },
  { listIndex: 46, binaCityId: 81, name: "Naftalan" },
  { listIndex: 47, binaCityId: 82, name: "Lerik" },
  { listIndex: 48, binaCityId: 83, name: "Gədəbəy" },
  { listIndex: 49, binaCityId: 84, name: "Ağdam" },
  { listIndex: 50, binaCityId: 85, name: "Ağcabədi" },
  { listIndex: 51, binaCityId: 86, name: "Füzuli" },
  { listIndex: 52, binaCityId: 87, name: "Göygöl" },
  { listIndex: 53, binaCityId: 88, name: "Tərtər" },
  { listIndex: 54, binaCityId: 89, name: "Daşkəsən" },
  { listIndex: 55, binaCityId: 96, name: "Laçın" },
  { listIndex: 56, binaCityId: 97, name: "Samux" },
  { listIndex: 57, binaCityId: 101, name: "Şuşa" },
  { listIndex: 58, binaCityId: 102, name: "Yardımlı" },
  { listIndex: 59, binaCityId: 129, name: "Qobustan" },
  { listIndex: 60, binaCityId: 130, name: "Naxçıvan" },
];

export function normalizeCity(value) {
  return value
    .toLocaleLowerCase("az")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function allCities() {
  return CITIES;
}

export function findCityByListIndex(index) {
  return CITIES.find((city) => city.listIndex === index) || null;
}

export function findCityByBinaId(binaCityId) {
  return CITIES.find((city) => city.binaCityId === binaCityId) || null;
}

export function findCityByInput(raw) {
  if (!raw || !String(raw).trim()) {
    return null;
  }
  const trimmed = String(raw).trim();
  if (/^\d+$/.test(trimmed)) {
    return findCityByListIndex(Number(trimmed));
  }
  const normalizedInput = normalizeCity(trimmed);
  const exact = CITIES.find((city) => normalizeCity(city.name) === normalizedInput);
  if (exact) {
    return exact;
  }
  return (
    CITIES.find(
      (city) =>
        normalizeCity(city.name).includes(normalizedInput) ||
        normalizedInput.includes(normalizeCity(city.name)),
    ) || null
  );
}

export function formatCityList() {
  return CITIES.map((city) => `${city.listIndex}. ${city.name}`).join("\n");
}
