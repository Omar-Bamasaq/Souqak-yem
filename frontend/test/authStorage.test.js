import test from "node:test";
import assert from "node:assert/strict";

const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;
const { clearStoredAuth, getAuthStorageKeys } = await import("../src/api/authStorage.js");

test("each store PWA uses a distinct token and user storage namespace", () => {
  globalThis.window = {
    __SOUQAK_STORE_PWA_APP__: { storeId: "64d3d93a1a2b3c4d5e6f7788" }
  };
  const first = getAuthStorageKeys();
  globalThis.window.__SOUQAK_STORE_PWA_APP__.storeId = "64d3d93a1a2b3c4d5e6f7799";
  const second = getAuthStorageKeys();

  assert.notEqual(first.token, second.token);
  assert.notEqual(first.user, second.user);
  assert.equal(first.isStorePwa, true);
  assert.equal(second.isStorePwa, true);
});

test("main application retains its existing auth storage keys", () => {
  globalThis.window = {};
  assert.deepEqual(getAuthStorageKeys(), {
    token: "token",
    user: "user",
    isStorePwa: false,
    storeId: null
  });
});

test("clearing a failed store token does not remove a newer concurrent token", () => {
  const values = new Map([
    ["souqak:store-pwa:64d3d93a1a2b3c4d5e6f7788:token", "new-token"],
    ["souqak:store-pwa:64d3d93a1a2b3c4d5e6f7788:user", "{\"id\":\"user\"}"]
  ]);
  globalThis.window = {
    __SOUQAK_STORE_PWA_APP__: { storeId: "64d3d93a1a2b3c4d5e6f7788" }
  };
  globalThis.localStorage = {
    getItem(key) { return values.get(key) || null; },
    removeItem(key) { values.delete(key); }
  };

  assert.equal(clearStoredAuth("stale-token"), false);
  assert.equal(values.get("souqak:store-pwa:64d3d93a1a2b3c4d5e6f7788:token"), "new-token");
  assert.equal(values.has("souqak:store-pwa:64d3d93a1a2b3c4d5e6f7788:user"), true);
});

test.after(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalLocalStorage;
});
