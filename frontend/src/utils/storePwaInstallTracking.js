const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getStorePwaInstallationId({
  storeId,
  storage = window.localStorage,
  cryptoApi = window.crypto
}) {
  if (!/^[a-f\d]{24}$/i.test(String(storeId || ""))) {
    throw new Error("A valid store ID is required to track a PWA installation.");
  }

  const key = `souqak:store-pwa-install:${storeId}`;
  const existingId = storage.getItem(key);
  if (UUID_PATTERN.test(existingId || "")) return existingId;
  if (!cryptoApi?.getRandomValues) throw new Error("Secure random IDs are unavailable.");

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const installationId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  storage.setItem(key, installationId);
  return installationId;
}
