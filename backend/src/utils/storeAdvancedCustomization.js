import { sanitizeStoreText } from "./storeValidation.js";

export const STORE_ADVANCED_THEMES = ["classic", "calm", "professional", "custom"];
export const STORE_ADVANCED_SECTION_ORDER = ["intro", "hero", "story", "featuredProducts", "products"];
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
export const STORE_ADVANCED_DEFAULTS = {
  theme: "classic",
  ...STORE_ADVANCED_PALETTES.classic,
  hero: { title: "", text: "", buttonLabel: "", buttonTarget: "products" },
  story: { text: "" },
  featuredProductIds: [],
  sectionOrder: [...STORE_ADVANCED_SECTION_ORDER],
  hiddenSections: []
};

function normalizeHexColor(value) {
  const color = String(value ?? "").trim();
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) return null;
  return color.length === 4
    ? `#${[...color.slice(1)].map((digit) => digit + digit).join("")}`
    : color;
}

function hasOnlyKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).every((key) => keys.includes(key));
}

function normalizeSectionList(value, allowed, fallback, exact = false) {
  if (value === undefined) return [...fallback];
  if (!Array.isArray(value) || value.some((entry) => !allowed.includes(entry))
    || new Set(value).size !== value.length || (exact && value.length !== allowed.length)) return null;
  return [...value];
}

export function normalizeStoreAdvancedCustomization(input, existing = {}) {
  if (!hasOnlyKeys(input, [
    "theme", "primaryColor", "secondaryColor", "pageBackgroundColor",
    "storeInfoBackgroundColor", "sectionBackgroundColor", "productCardBackgroundColor", "hero", "story",
    "featuredProductIds", "sectionOrder", "hiddenSections"
  ]) || (input.hero !== undefined && !hasOnlyKeys(input.hero, ["title", "text", "buttonLabel", "buttonTarget"]))
    || (input.story !== undefined && !hasOnlyKeys(input.story, ["text"]))) {
    return { error: "حقول القسم الرئيسي أو قصتنا غير صالحة." };
  }

  const requestedTheme = input.theme ?? existing.theme ?? STORE_ADVANCED_DEFAULTS.theme;
  const theme = requestedTheme === "editorial" || requestedTheme === "artisan" ? "custom" : requestedTheme;
  const submittedPalette = Object.fromEntries(Object.keys(STORE_ADVANCED_PALETTES.classic).map((field) => [
    field,
    normalizeHexColor(input[field] ?? existing[field] ?? STORE_ADVANCED_DEFAULTS[field])
  ]));
  const buttonTarget = input.hero?.buttonTarget ?? existing.hero?.buttonTarget ?? "products";
  if (!STORE_ADVANCED_THEMES.includes(theme)
    || Object.values(submittedPalette).some((color) => !color)
    || !["products", "story", "contact"].includes(buttonTarget)) {
    return { error: "النمط أو الألوان أو وجهة الزر غير صالحة." };
  }
  const palette = theme === "custom" ? submittedPalette : STORE_ADVANCED_PALETTES[theme];

  const hero = {
    title: sanitizeStoreText(input.hero?.title ?? existing.hero?.title ?? "", { maxLength: 100, allowEmpty: true }),
    text: sanitizeStoreText(input.hero?.text ?? existing.hero?.text ?? "", { maxLength: 300, allowEmpty: true }),
    buttonLabel: sanitizeStoreText(input.hero?.buttonLabel ?? existing.hero?.buttonLabel ?? "", { maxLength: 30, allowEmpty: true }),
    buttonTarget
  };
  if (hero.buttonLabel && !(hero.title || hero.text)) {
    return { error: "أدخل عنوانًا أو نصًا للقسم الرئيسي قبل إضافة الزر." };
  }

  const storyText = sanitizeStoreText(input.story?.text ?? existing.story?.text ?? "", { maxLength: 1200, allowEmpty: true });
  const featuredProductIds = input.featuredProductIds ?? existing.featuredProductIds ?? [];
  if (!Array.isArray(featuredProductIds) || featuredProductIds.length > 8
    || featuredProductIds.some((id) => typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id))
    || new Set(featuredProductIds.map(String)).size !== featuredProductIds.length) {
    return { error: "اختر حتى 8 منتجات مميزة صالحة دون تكرار." };
  }

  const sectionOrder = normalizeSectionList(
    input.sectionOrder,
    STORE_ADVANCED_SECTION_ORDER,
    existing.sectionOrder || STORE_ADVANCED_DEFAULTS.sectionOrder,
    true
  );
  const hiddenSections = normalizeSectionList(
    input.hiddenSections,
    STORE_ADVANCED_SECTION_ORDER,
    existing.hiddenSections || []
  );
  if (!sectionOrder || !hiddenSections) return { error: "ترتيب أو أقسام المتجر غير صالحة." };

  return {
    value: {
      theme,
      ...palette,
      hero: { ...hero, image: existing.hero?.image || null },
      story: { text: storyText, images: Array.isArray(existing.story?.images) ? existing.story.images.slice(0, 3) : [] },
      featuredProductIds,
      sectionOrder,
      hiddenSections
    }
  };
}
