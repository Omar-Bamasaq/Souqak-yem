import test from "node:test";
import assert from "node:assert/strict";

test("install prompts are isolated by app identity and become available again when the browser offers them", async () => {
  const originalWindow = globalThis.window;
  const fakeWindow = new EventTarget();
  let standalone = false;
  fakeWindow.matchMedia = () => ({ matches: standalone });
  fakeWindow.navigator = { standalone: false };
  fakeWindow.__SOUQAK_STORE_PWA_APP__ = { storeId: "64d3d93a1a2b3c4d5e6f7701" };
  globalThis.window = fakeWindow;
  const { canInstallPWA, getPWAInstallTarget, installPWA, setPWAInstallTarget } = await import("../src/utils/pwaInstall.js");
  const installedTargets = [];
  const availabilityTargets = [];
  fakeWindow.addEventListener("pwa:installed", (event) => installedTargets.push(event.detail.target));
  fakeWindow.addEventListener("pwa:can-install", (event) => availabilityTargets.push(event.detail.target));

  const emitPrompt = (outcome) => {
    const event = new Event("beforeinstallprompt");
    event.preventDefault = () => {};
    event.prompt = () => {};
    event.userChoice = Promise.resolve({ outcome });
    fakeWindow.dispatchEvent(event);
  };

  try {
    assert.equal(getPWAInstallTarget(), "store:64d3d93a1a2b3c4d5e6f7701");
    emitPrompt("dismissed");
    assert.equal(canInstallPWA("store:64d3d93a1a2b3c4d5e6f7701"), true);
    standalone = true;
    assert.equal(canInstallPWA("store:64d3d93a1a2b3c4d5e6f7701"), false);
    standalone = false;

    setPWAInstallTarget("souqak");
    emitPrompt("dismissed");
    assert.equal(canInstallPWA("souqak"), true);

    setPWAInstallTarget("store:shop");
    emitPrompt("dismissed");
    assert.equal(canInstallPWA("store:shop"), true);
    assert.equal(canInstallPWA("souqak"), true);
    assert.equal(await installPWA("store:shop"), "dismissed");
    assert.equal(canInstallPWA("store:shop"), false);
    assert.equal(canInstallPWA("souqak"), true);
    assert.equal(await installPWA("souqak"), "dismissed");

    emitPrompt("accepted");
    assert.equal(canInstallPWA("store:shop"), true);
    assert.equal(await installPWA("store:shop"), "accepted");
    assert.deepEqual(installedTargets, ["store:shop"]);
    assert.equal(availabilityTargets.includes("souqak"), true);

    setPWAInstallTarget("souqak");
    emitPrompt("accepted");
    assert.equal(canInstallPWA("souqak"), true);
    emitPrompt("dismissed");
    assert.equal(canInstallPWA("store:shop"), false);
    standalone = true;
    setPWAInstallTarget("store:shop");
    emitPrompt("dismissed");
    assert.equal(canInstallPWA("store:shop"), true);
    assert.equal(canInstallPWA("souqak"), false);
  } finally {
    setPWAInstallTarget("souqak");
    globalThis.window = originalWindow;
  }
});
