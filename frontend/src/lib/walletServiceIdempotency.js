function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function createKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, "");
  if (globalThis.crypto?.getRandomValues) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(24));
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  throw new Error("تعذر إنشاء مفتاح آمن للطلب. حدّث المتصفح ثم حاول مجددًا.");
}

function storageKey(type) {
  return `wallet-service-idempotency:${type}`;
}

export function getWalletServiceIdempotencyKey(type, payload) {
  const serializedPayload = JSON.stringify(canonicalize(payload));
  const key = storageKey(type);
  const current = sessionStorage.getItem(key);
  if (current) {
    const saved = JSON.parse(current);
    if (saved.payload === serializedPayload && /^[A-Za-z0-9._:-]{8,128}$/.test(saved.key)) return saved.key;
  }
  const idempotencyKey = createKey();
  sessionStorage.setItem(key, JSON.stringify({ key: idempotencyKey, payload: serializedPayload }));
  return idempotencyKey;
}

export function clearWalletServiceIdempotencyKey(type) {
  sessionStorage.removeItem(storageKey(type));
}
