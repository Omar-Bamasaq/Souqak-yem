import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getConfirmedPhoneVerificationSetting,
  getPhoneVerificationSettingUpdate,
  getUnknownPhoneVerificationSetting
} from "../src/utils/adminPhoneVerificationSetting.js";

const frontendRoot = path.resolve(process.cwd());

test("successful settings loads confirm the saved true or false value", () => {
  assert.deepEqual(
    getConfirmedPhoneVerificationSetting({ requirePhoneVerificationForAds: true }),
    { status: "confirmed", savedValue: true, draftValue: true }
  );
  assert.deepEqual(
    getConfirmedPhoneVerificationSetting({ requirePhoneVerificationForAds: false }),
    { status: "confirmed", savedValue: false, draftValue: false }
  );
  assert.equal(getConfirmedPhoneVerificationSetting({}).savedValue, true);
});

test("unknown load or save state cannot be represented as a confirmed setting or sent", () => {
  const unknown = getUnknownPhoneVerificationSetting();
  assert.deepEqual(unknown, { status: "unknown", savedValue: null, draftValue: null });
  assert.equal(getPhoneVerificationSettingUpdate(unknown, "admin"), null);
});

test("successful saves confirm the server value and failed saves require a reload", () => {
  const pending = {
    status: "confirmed",
    savedValue: true,
    draftValue: false
  };
  const update = getPhoneVerificationSettingUpdate(pending, "admin");
  assert.deepEqual(update, { requirePhoneVerificationForAds: false });

  const confirmed = getConfirmedPhoneVerificationSetting(update);
  assert.equal(confirmed.savedValue, false);
  assert.equal(getPhoneVerificationSettingUpdate(getUnknownPhoneVerificationSetting(), "admin"), null);
});

test("saving another setting omits an unchanged phone gate and supervisors never send it", () => {
  const unchanged = {
    status: "confirmed",
    savedValue: false,
    draftValue: false
  };
  assert.deepEqual(getPhoneVerificationSettingUpdate(unchanged, "admin"), {});
  assert.deepEqual(getPhoneVerificationSettingUpdate({
    ...unchanged,
    draftValue: true
  }, "supervisor"), {});
});

test("settings UI hides unconfirmed values, offers reload, and preserves admin-only control", () => {
  const adminSettings = fs.readFileSync(
    path.join(frontendRoot, "src", "pages", "AdminSettings.jsx"),
    "utf8"
  );

  assert.match(adminSettings, /اشتراط توثيق الهاتف لنشر الإعلانات/);
  assert.match(adminSettings, /if \(!settingsLoaded\) return;/);
  assert.match(adminSettings, /if \(!settingsLoaded\) \{/);
  assert.match(adminSettings, /إعادة تحميل الإعدادات/);
  assert.match(adminSettings, /قد يكون الخادم حفظ التغييرات/);
  assert.match(adminSettings, /setPhoneVerificationSetting\(getUnknownPhoneVerificationSetting\(\)\)/);
  assert.match(adminSettings, /checked=\{phoneVerificationSetting\.draftValue\}/);
  assert.match(adminSettings, /\{user\?\.role === "admin" && \(/);
  assert.match(adminSettings, /Object\.assign\(dataToSave, phoneVerificationUpdate\)/);
});

test("ad creation delegates phone verification to the backend response", () => {
  const addProduct = fs.readFileSync(
    path.join(frontendRoot, "src", "pages", "AddProduct.jsx"),
    "utf8"
  );

  assert.doesNotMatch(addProduct, /if \(!user\.phoneVerifiedAt\)/);
  assert.match(addProduct, /data\?\.code === "PHONE_VERIFICATION_REQUIRED"/);
  assert.match(addProduct, /to="\/verify-phone"/);
});
