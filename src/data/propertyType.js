export const PROPERTY_TYPES = {
  HOUSE: { name: "HOUSE", userChoice: 1, binaCategoryId: 5, label: "Ev / həyət evi" },
  LAND: { name: "LAND", userChoice: 2, binaCategoryId: 9, label: "Torpaq" },
};

export function propertyTypeFromChoice(choice) {
  return Object.values(PROPERTY_TYPES).find((type) => type.userChoice === choice) || null;
}

export function propertyTypeFromName(raw) {
  if (raw == null) {
    return null;
  }
  const normalized = raw.trim().toLocaleLowerCase("az");
  if (normalized === "1" || normalized === "ev" || normalized === "evi") {
    return PROPERTY_TYPES.HOUSE;
  }
  if (normalized === "2" || normalized === "torpaq" || normalized === "torpaqi") {
    return PROPERTY_TYPES.LAND;
  }
  return null;
}
