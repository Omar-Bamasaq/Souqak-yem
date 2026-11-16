import test from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { clearCsrfToken } from "../src/api/csrf.js";
import { consumeStorePwaHandoff, getSessionRotationRetryDelay } from "../src/api/session.js";

test("refresh rotation retry delay honors server Retry-After and body hints", () => {
  assert.equal(
    getSessionRotationRetryDelay({
      response: {
        headers: { "retry-after": "1" },
        data: { retryAfterMs: 150 }
      }
    }, 0),
    1_000
  );

  assert.equal(
    getSessionRotationRetryDelay({
      response: { headers: {}, data: { retryAfterMs: 750 } }
    }, 0),
    750
  );
});

test("refresh rotation retry delay uses bounded backoff without server hints", () => {
  assert.equal(getSessionRotationRetryDelay({ response: { headers: {}, data: {} } }, 0), 250);
  assert.equal(getSessionRotationRetryDelay({ response: { headers: {}, data: {} } }, 4), 2_000);
});

test("concurrent handoff startup calls share one exchange and reuse its token", async () => {
  const originals = {
    window: globalThis.window,
    localStorage: globalThis.localStorage,
    navigator: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
    get: axios.get,
    post: axios.post
  };
  const values = new Map();
  globalThis.window = {
    __SOUQAK_STORE_PWA_APP__: { storeId: "64d3d93a1a2b3c4d5e6f7788" },
    location: { origin: "https://apps.souqak-yem.com" }
  };
  globalThis.localStorage = {
    getItem(key) { return values.get(key) || null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {}
  });
  let exchangeCalls = 0;
  axios.get = async () => ({ data: { csrfToken: "test-csrf-token" } });
  axios.post = async (url, _body, options) => {
    exchangeCalls += 1;
    assert.match(url, /\/auth\/store-pwa\/64d3d93a1a2b3c4d5e6f7788\/handoff\/exchange$/);
    assert.equal(options.withCredentials, true);
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { data: { token: "transferred-access-token" } };
  };

  try {
    const results = await Promise.all([
      consumeStorePwaHandoff(),
      consumeStorePwaHandoff()
    ]);
    assert.deepEqual(results, ["transferred-access-token", "transferred-access-token"]);
    assert.equal(exchangeCalls, 1);
    assert.equal(values.get("souqak:store-pwa:64d3d93a1a2b3c4d5e6f7788:token"), "transferred-access-token");
    assert.equal(await consumeStorePwaHandoff(), null);
    assert.equal(exchangeCalls, 1);
  } finally {
    axios.get = originals.get;
    axios.post = originals.post;
    clearCsrfToken();
    if (originals.window === undefined) delete globalThis.window;
    else globalThis.window = originals.window;
    if (originals.localStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originals.localStorage;
    if (originals.navigator) {
      Object.defineProperty(globalThis, "navigator", originals.navigator);
    } else {
      delete globalThis.navigator;
    }
  }
});
