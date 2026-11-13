import test from "node:test";
import assert from "node:assert/strict";
import { getPWAInstallGuidance } from "../src/utils/pwaInstall.js";

test("in-app browsers receive external-browser guidance even when a native prompt exists", () => {
  assert.equal(getPWAInstallGuidance({
    userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 FBAN/FB4A",
    canInstall: true
  }), "in-app");
  assert.equal(getPWAInstallGuidance({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) WhatsApp/24.18",
    canInstall: true
  }), "ios-in-app");
});

test("iPhone and Android Chrome receive manual instructions only when needed", () => {
  assert.equal(getPWAInstallGuidance({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15"
  }), "ios");
  assert.equal(getPWAInstallGuidance({
    userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile"
  }), "android-chrome");
  assert.equal(getPWAInstallGuidance({
    userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile",
    canInstall: true
  }), null);
});

test("installed app mode suppresses all manual install guidance", () => {
  assert.equal(getPWAInstallGuidance({
    userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 FBAN/FB4A",
    standalone: true
  }), null);
});
