function readPositiveInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive safe integer`);
  }
  return value;
}

function readNonNegativeInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer`);
  }
  return value;
}

export const AUCTION_BID_RATE_WINDOW_MS = readPositiveInteger(
  "AUCTION_BID_RATE_WINDOW_MS",
  60_000
);
export const AUCTION_BID_RATE_LIMIT = readPositiveInteger(
  "AUCTION_BID_RATE_LIMIT",
  10
);
export const AUCTION_LIFECYCLE_POLL_MS = readPositiveInteger(
  "AUCTION_LIFECYCLE_POLL_MS",
  5_000
);
export const AUCTION_EXTENSION_WINDOW_MS = readNonNegativeInteger(
  "AUCTION_EXTENSION_WINDOW_MS",
  0
);
export const AUCTION_EXTENSION_DURATION_MS = readNonNegativeInteger(
  "AUCTION_EXTENSION_DURATION_MS",
  0
);
export const AUCTION_DURATION_OPTIONS = Object.freeze([
  Object.freeze({ days: 1, label: "يوم واحد" }),
  Object.freeze({ days: 4, label: "4 أيام" }),
  Object.freeze({ days: 7, label: "أسبوع" })
]);
export const AUCTION_DURATION_DAYS = Object.freeze(
  AUCTION_DURATION_OPTIONS.map(({ days }) => days)
);
export function auctionDurationLabel(days) {
  return AUCTION_DURATION_OPTIONS.find((option) => option.days === days)?.label || "غير محددة";
}
export const AUCTION_OWNER_ACKNOWLEDGMENT_VERSION = "v1";
export const AUCTION_OWNER_ACKNOWLEDGMENT_TEXT =
  "أقر بصحة بيانات المزاد والصور ومعلومات حالة السلعة والتسليم، وألتزم بشروط استخدام سوقك المتعلقة بالمزادات.";

if (
  (AUCTION_EXTENSION_WINDOW_MS === 0) !==
  (AUCTION_EXTENSION_DURATION_MS === 0)
) {
  throw new Error(
    "AUCTION_EXTENSION_WINDOW_MS and AUCTION_EXTENSION_DURATION_MS must both be zero or both be positive"
  );
}
