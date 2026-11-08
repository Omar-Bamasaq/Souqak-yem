const ARABIC_WORDS = new Map([
  ["متجر", "matjar"],
  ["المتجر", "al-matjar"],
  ["اسرة", "osra"],
  ["أسرة", "osra"],
  ["منتجة", "montaja"],
  ["صناعات", "sinaat"],
  ["سوقك", "souqak"],
  ["البامسق", "albamasaq"]
]);

const ARABIC_LETTERS = {
  ا: "a", أ: "a", إ: "i", آ: "aa", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh",
  د: "d", ذ: "th", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z",
  ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", ة: "a",
  و: "w", ي: "y", ى: "a"
};

function transliterateWord(word) {
  const normalized = word.replace(/[ًٌٍَُِّْـ]/g, "");
  const knownWord = ARABIC_WORDS.get(normalized);
  if (knownWord) return knownWord;
  return Array.from(normalized, (letter) => ARABIC_LETTERS[letter] || letter).join("");
}

export function slugifyStoreName(name) {
  const latin = String(name || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(transliterateWord)
    .join("-");
  return latin
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function isValidStoreSlug(slug) {
  const value = String(slug || "");
  return value.length >= 3 && value.length <= 60 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}
