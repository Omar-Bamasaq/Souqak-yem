const STOP_WORDS = new Set([
  "انا", "انت", "انتي", "كيف", "ماذا", "ما", "هل", "من", "في", "على", "عن",
  "الى", "اريد", "ابغى", "ممكن", "لو", "سمحت", "طريقه", "اقدر", "استطيع",
  "يتم", "مع", "او", "the", "how", "do", "i", "can", "my"
]);

export function normalizeSupportText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670ـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMeaningfulWords(value) {
  const words = normalizeSupportText(value)
    .split(" ")
    .map((word) => word.startsWith("ال") && word.length > 4 ? word.slice(2) : word)
    .map((word) => word.endsWith("ات") && word.length > 5 ? word.slice(0, -2) : word)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));

  return [...new Set(words)];
}

export function findMatchingSupportFaq(question, faqs) {
  const normalizedQuestion = normalizeSupportText(question);
  const exactMatch = faqs.find((faq) =>
    [faq.question, ...(faq.keywords || [])]
      .some((phrase) => normalizeSupportText(phrase) === normalizedQuestion)
  );
  if (exactMatch) return exactMatch;

  const queryWords = getMeaningfulWords(question);
  if (!queryWords.length) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const faq of faqs) {
    const searchableText = [faq.question, ...(faq.keywords || [])].join(" ");
    const faqWords = new Set(getMeaningfulWords(searchableText));
    const matchedWords = queryWords.filter((word) => faqWords.has(word));
    const score = matchedWords.length / queryWords.length;

    if (
      matchedWords.length >= 2 &&
      score >= 0.6 &&
      score > bestScore
    ) {
      bestMatch = faq;
      bestScore = score;
    }
  }

  return bestMatch;
}
