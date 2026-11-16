import test from "node:test";
import assert from "node:assert/strict";

const originalWindow = globalThis.window;
const { getAuthStorageKeys } = await import("../src/api/authStorage.js");

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

test.after(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
});
