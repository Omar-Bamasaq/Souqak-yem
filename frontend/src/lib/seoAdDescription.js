export const SAFE_EMPTY_AD_DESCRIPTION = "إعلان مبوب في سوقك.";

export function sanitizeSeoAdDescription(value, maxLength = 2000) {
  if (typeof value !== "string") return SAFE_EMPTY_AD_DESCRIPTION;

  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    let failed = false;
    const next = decoded.replace(/(?:%[a-f\d]{2})+/gi, (encoded) => {
      try {
        return decodeURIComponent(encoded);
      } catch {
        failed = true;
        return "";
      }
    });
    if (failed) return SAFE_EMPTY_AD_DESCRIPTION;
    if (next === decoded) break;
    decoded = next;
  }
  if (/%[a-f\d]{2}/i.test(decoded)) return SAFE_EMPTY_AD_DESCRIPTION;

  let sanitized = decoded
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#64;|&#x40;/gi, "@")
    .replace(/&#47;|&#x2f;/gi, "/")
    .replace(/&#58;|&#x3a;/gi, ":")
    .replace(/&#61;|&#x3d;/gi, "=")
    .replace(/&commat;/gi, "@")
    .replace(/&(?:period|dot);/gi, ".")
    .replace(/&sol;/gi, "/")
    .replace(/&bsol;/gi, "\\")
    .replace(/&colon;/gi, ":")
    .replace(/&equals;/gi, "=")
    .replace(/&#(?:x([a-f\d]{1,2})|(\d{1,3}));/gi, (entity, hex, decimal) => {
      const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
      return codePoint <= 0x7f ? String.fromCharCode(codePoint) : entity;
    })
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/&(?:amp|quot|apos|lt|gt);/gi, " ");

  sanitized = sanitized
    .replace(/[\w.+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[تم إزالة البريد]")
    .replace(/(?:bearer\s+)?(?:password|passphrase|token|secret|api[_-]?key|session|cookie|authorization)\s*[:=]\s*[^\s,؛;]+/gi, "[تم إزالة اعتماد]")
    .replace(/(?:https?:\/\/|www\.|mailto:|tel:|javascript:|data:)[^\s<>"']+/gi, "[تم إزالة رابط]")
    .replace(/\b(?:[A-Z0-9-]+\.)+[A-Z]{2,}(?:\/[^\s]*)?/gi, "[تم إزالة رابط]")
    .replace(/\b(?:private(?:[_-]?uploads)?|identity|passport|verification|documents|attachments|wallet|admin|account|auth)(?:[\\/]|%2f)[^\s,؛;]+/gi, "[تم إزالة مسار خاص]")
    .replace(/(?:\+?967[\s().-]*)?7(?:[\s().-]*\d){7,8}\b/gi, "[تم إزالة رقم]");

  sanitized = sanitized
    .replace(/\b(?:\+?\d{1,4}[\s().-]?)(?:\d[\s().-]*){7,14}\d\b/g, "[تم إزالة رقم]")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.،؛])/g, "$1")
    .trim()
    .slice(0, maxLength)
    .trim();

  const meaningfulText = sanitized
    .replace(/\[(?:تم إزالة البريد|تم إزالة اعتماد|تم إزالة رابط|تم إزالة مسار خاص|تم إزالة رقم)\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!meaningfulText || !/[\p{L}\p{N}]/u.test(meaningfulText)) {
    return SAFE_EMPTY_AD_DESCRIPTION;
  }

  return sanitized;
}
