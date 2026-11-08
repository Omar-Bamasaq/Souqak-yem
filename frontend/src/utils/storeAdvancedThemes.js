export const STORE_ADVANCED_PALETTES = {
  classic: {
    primaryColor: "#0b89ed",
    secondaryColor: "#0f172a",
    pageBackgroundColor: "#f1f5f9",
    storeInfoBackgroundColor: "#ffffff",
    sectionBackgroundColor: "#ffffff",
    productCardBackgroundColor: "#ffffff"
  },
  calm: {
    primaryColor: "#587967",
    secondaryColor: "#34483c",
    pageBackgroundColor: "#f2f5f0",
    storeInfoBackgroundColor: "#fbf8f1",
    sectionBackgroundColor: "#e5ede6",
    productCardBackgroundColor: "#fffdf8"
  },
  professional: {
    primaryColor: "#6d28d9",
    secondaryColor: "#1e1b4b",
    pageBackgroundColor: "#f5f3ff",
    storeInfoBackgroundColor: "#ecfeff",
    sectionBackgroundColor: "#ede9fe",
    productCardBackgroundColor: "#fffbeb"
  }
};

export function normalizeStoreAdvancedTheme(theme) {
  if (theme === "editorial" || theme === "artisan") return "custom";
  return Object.prototype.hasOwnProperty.call(STORE_ADVANCED_PALETTES, theme) || theme === "custom" ? theme : "classic";
}

export function getStoreAdvancedPalette(theme, fallback = STORE_ADVANCED_PALETTES.classic) {
  const normalizedTheme = normalizeStoreAdvancedTheme(theme);
  const palette = normalizedTheme === "custom" ? fallback : STORE_ADVANCED_PALETTES[normalizedTheme];
  return Object.fromEntries(Object.keys(STORE_ADVANCED_PALETTES.classic).map((field) => [field, palette[field]]));
}
