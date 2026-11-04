import mongoose from "mongoose";

const INPUT_AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const DECIMAL128_MAX_DIGITS = 34;
const DECIMAL128_MAX_SCALE = 6_144;

function partsFor(value, { allowExponent = false } = {}) {
  const text = typeof value === "string" ? value.trim() : value?.toString();
  if (!text || text.length > 6_200) {
    throw new TypeError("المبلغ غير صالح.");
  }

  const pattern = allowExponent
    ? /^(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/
    : INPUT_AMOUNT_PATTERN;
  const match = text.match(pattern);
  if (!match) throw new TypeError("أدخل مبلغًا عشريًا موجبًا صالحًا.");

  const whole = allowExponent ? match[1] : text.split(".")[0];
  const fraction = allowExponent ? match[2] || "" : text.split(".")[1] || "";
  const exponent = allowExponent ? Number(match[3] || 0) : 0;
  if (!Number.isSafeInteger(exponent)) throw new TypeError("المبلغ خارج النطاق.");

  let digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, "");
  let scale = fraction.length - exponent;
  if (scale < 0) {
    digits += "0".repeat(-scale);
    scale = 0;
  }
  if (scale > DECIMAL128_MAX_SCALE) {
    throw new TypeError("المبلغ خارج نطاق Decimal128.");
  }

  let coefficient = BigInt(digits || "0");
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }

  const significantDigits = coefficient === 0n ? 1 : coefficient.toString().length;
  if (significantDigits > DECIMAL128_MAX_DIGITS) {
    throw new TypeError("المبلغ يتجاوز دقة Decimal128.");
  }

  return { coefficient, scale };
}

function stringFromParts(coefficient, scale) {
  const digits = coefficient.toString();
  if (scale === 0) return digits;
  const padded = digits.padStart(scale + 1, "0");
  const point = padded.length - scale;
  return `${padded.slice(0, point)}.${padded.slice(point)}`;
}

export function parseAuctionAmount(value, fieldName = "المبلغ") {
  try {
    if (typeof value !== "string" || !INPUT_AMOUNT_PATTERN.test(value.trim())) {
      throw new TypeError();
    }
    const parts = partsFor(value);
    if (parts.coefficient <= 0n) throw new TypeError();
    const normalized = stringFromParts(parts.coefficient, parts.scale);
    return {
      decimal: mongoose.Types.Decimal128.fromString(normalized),
      normalized
    };
  } catch {
    throw new TypeError(`${fieldName} يجب أن يكون مبلغًا موجبًا صالحًا.`);
  }
}

export function compareAuctionAmounts(left, right) {
  const a = partsFor(left, { allowExponent: true });
  const b = partsFor(right, { allowExponent: true });
  const scale = Math.max(a.scale, b.scale);
  const leftValue = a.coefficient * 10n ** BigInt(scale - a.scale);
  const rightValue = b.coefficient * 10n ** BigInt(scale - b.scale);
  return leftValue === rightValue ? 0 : leftValue > rightValue ? 1 : -1;
}

export function addAuctionAmounts(left, right) {
  const a = partsFor(left, { allowExponent: true });
  const b = partsFor(right, { allowExponent: true });
  const scale = Math.max(a.scale, b.scale);
  const sum =
    a.coefficient * 10n ** BigInt(scale - a.scale) +
    b.coefficient * 10n ** BigInt(scale - b.scale);
  const normalized = stringFromParts(sum, scale);
  return mongoose.Types.Decimal128.fromString(normalized);
}

export function serializeAuctionAmount(value) {
  return value?.toString() ?? null;
}
