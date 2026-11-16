function getStorePwaId() {
  if (typeof window === "undefined") return null;
  const storeId = window.__SOUQAK_STORE_PWA_APP__?.storeId;
  return /^[a-f\d]{24}$/i.test(String(storeId || "")) ? String(storeId) : null;
}

export function getAuthStorageKeys() {
  const storeId = typeof window !== "undefined" ? getStorePwaId() : null;
  if (!storeId) return { token: "token", user: "user", isStorePwa: false, storeId: null };
  const prefix = `souqak:store-pwa:${storeId}:`;
  return { token: `${prefix}token`, user: `${prefix}user`, isStorePwa: true, storeId };
}

export function getStoredAuthToken() {
  return localStorage.getItem(getAuthStorageKeys().token);
}

export function setStoredAuthToken(token) {
  localStorage.setItem(getAuthStorageKeys().token, token);
}

export function setStoredAuthUser(user) {
  localStorage.setItem(getAuthStorageKeys().user, JSON.stringify(user));
}

export function clearStoredAuth(expectedToken = null) {
  const keys = getAuthStorageKeys();
  if (expectedToken && localStorage.getItem(keys.token) !== expectedToken) return false;
  localStorage.removeItem(keys.token);
  localStorage.removeItem(keys.user);
  return true;
}
