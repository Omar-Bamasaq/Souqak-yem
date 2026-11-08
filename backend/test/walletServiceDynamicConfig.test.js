import test from "node:test";
import assert from "node:assert/strict";
import {
  getWalletServiceVersionAt,
  getWalletServiceVersion,
  isWalletServiceVersionValidAt,
  normalizeFormSchema,
  normalizeWalletServicePackages,
  validateFormAnswers
} from "../src/utils/walletServiceDynamicConfig.js";
import DigitalServiceCategory from "../src/models/DigitalServiceCategory.js";
import WalletService from "../src/models/WalletService.js";
import WalletServiceOrder from "../src/models/WalletServiceOrder.js";
import mongoose from "mongoose";

test("category slugs have a unique database constraint", () => {
  assert.ok(DigitalServiceCategory.schema.indexes().some(([fields, options]) =>
    fields.slug === 1 && options.unique === true
  ));
});

test("service documents reject executable schema types and mismatched package currencies", () => {
  const invalidSchema = new WalletService({
    name: "خدمة",
    unitPrice: 1,
    formSchema: [{ id: "unsafe", label: "غير آمن", type: "JAVASCRIPT" }]
  });
  assert.ok(invalidSchema.validateSync().errors.formSchema);

  const invalidPackageCurrency = new WalletService({
    name: "خدمة",
    currency: "USD",
    pricingType: "PACKAGE",
    packages: [{ id: "monthly", name: "شهري", price: 5, currency: "SAR" }]
  });
  assert.ok(invalidPackageCurrency.validateSync().errors.packages);
});

test("legacy orders remain valid and custom idempotency keys have a unique scoped index", () => {
  const legacyOrder = new WalletServiceOrder({
    user: new mongoose.Types.ObjectId(),
    orderType: "catalog",
    serviceName: "خدمة قديمة",
    whatsappNumber: "777123456",
    serviceAmount: 5,
    platformFee: 1,
    totalAmount: 6
  });
  assert.equal(legacyOrder.validateSync(), undefined);
  assert.ok(WalletServiceOrder.schema.indexes().some(([fields, options]) =>
    fields.user === 1 && fields.idempotencyKey === 1 && options.unique === true
  ));
});

test("dynamic schemas normalize supported field types and validate required answers and defaults", () => {
  const schema = normalizeFormSchema([
    {
      id: "plan",
      label: "الباقة",
      type: "SELECT",
      required: true,
      options: [
        { id: "basic", label: "أساسي", value: "basic" },
        { id: "pro", label: "احترافي", value: "pro" }
      ]
    },
    {
      id: "accountEmail",
      label: "البريد",
      type: "EMAIL",
      required: true,
      when: { fieldId: "plan", operator: "EQUALS", value: "pro" }
    },
    {
      id: "gift",
      label: "هدية",
      type: "BOOLEAN",
      defaultValue: false
    }
  ]);

  assert.deepEqual(validateFormAnswers(schema, { plan: "basic" }), {
    plan: "basic",
    gift: false
  });
  assert.deepEqual(validateFormAnswers(schema, {
    plan: "pro",
    accountEmail: "buyer@example.test"
  }), {
    plan: "pro",
    accountEmail: "buyer@example.test",
    gift: false
  });
  assert.throws(() => validateFormAnswers(schema, { plan: "pro" }), /يرجى إدخال البريد/);
  assert.throws(() => validateFormAnswers(schema, {
    plan: "basic",
    accountEmail: "hidden@example.test"
  }), /الحقل المخفي/);
});

test("dynamic schema validation rejects unknown fields, options, types, and circular visibility", () => {
  const schema = normalizeFormSchema([{
    id: "choice",
    label: "الاختيار",
    type: "SELECT",
    required: true,
    options: [{ id: "one", label: "واحد", value: "one" }]
  }]);

  assert.throws(() => validateFormAnswers(schema, { choice: "other" }), /خيارًا غير مسموح/);
  assert.throws(() => validateFormAnswers(schema, { choice: "one", injected: true }), /غير معروفة/);
  assert.throws(() => normalizeFormSchema([{
    id: "first",
    label: "الأول",
    type: "TEXT",
    when: { fieldId: "second", operator: "EQUALS", value: "yes" }
  }, {
    id: "second",
    label: "الثاني",
    type: "TEXT"
  }]), /حقل سابق/);
  assert.throws(() => normalizeFormSchema([{
    id: "custom",
    label: "مخصص",
    type: "JAVASCRIPT"
  }]), /نوع حقل النموذج غير مدعوم/);
});

test("text, number, URL, multi-select, and textarea fields enforce their declared types and bounds", () => {
  const schema = normalizeFormSchema([
    { id: "player", label: "المعرف", type: "TEXT", validation: { minLength: 3, maxLength: 20 } },
    { id: "amount", label: "العدد", type: "NUMBER", validation: { min: 1, max: 10 } },
    { id: "profile", label: "الرابط", type: "URL" },
    {
      id: "features",
      label: "الميزات",
      type: "MULTI_SELECT",
      options: [{ id: "one", label: "واحد", value: "one" }, { id: "two", label: "اثنان", value: "two" }]
    },
    { id: "notes", label: "ملاحظات", type: "TEXTAREA" }
  ]);
  assert.deepEqual(validateFormAnswers(schema, {
    player: "user-1",
    amount: 5,
    profile: "https://example.test/profile",
    features: ["one", "two"],
    notes: "طلب"
  }), {
    player: "user-1",
    amount: 5,
    profile: "https://example.test/profile",
    features: ["one", "two"],
    notes: "طلب"
  });
  assert.throws(() => validateFormAnswers(schema, {
    player: "user-1",
    amount: 11,
    profile: "https://example.test/profile",
    features: [],
    notes: ""
  }), /خارج الحدود/);
  assert.throws(() => validateFormAnswers(schema, {
    player: "user-1",
    amount: 5,
    profile: "javascript:alert(1)",
    features: [],
    notes: ""
  }), /HTTP أو HTTPS/);
});

test("Yemeni phone fields accept only 9-digit numbers starting with 73 or 77", () => {
  const schema = normalizeFormSchema([{
    id: "targetPhone",
    label: "رقم الهاتف",
    type: "TEXT",
    required: true,
    validation: {
      format: "YE_MOBILE_73_77",
      minLength: 9,
      maxLength: 9
    }
  }]);

  assert.deepEqual(validateFormAnswers(schema, { targetPhone: "731234567" }), {
    targetPhone: "731234567"
  });
  assert.deepEqual(validateFormAnswers(schema, { targetPhone: "771234567" }), {
    targetPhone: "771234567"
  });
  for (const targetPhone of ["701234567", "711234567", "73123456", "7312345678", "+967731234567"]) {
    assert.throws(() => validateFormAnswers(schema, { targetPhone }), /رقم الهاتف/);
  }
  assert.throws(() => normalizeFormSchema([{
    id: "targetPhone",
    label: "رقم الهاتف",
    type: "TEXT",
    validation: { format: "UNSUPPORTED" }
  }]), /صيغة التحقق غير مدعومة/);
});

test("package definitions enforce stable identifiers, currency, and cent precision", () => {
  assert.deepEqual(normalizeWalletServicePackages([{
    id: "monthly",
    name: "شهري",
    price: 4.5,
    currency: "USD"
  }], "USD"), [{
    id: "monthly",
    name: "شهري",
    description: "",
    price: 4.5,
    currency: "USD",
    isActive: true,
    sortOrder: 0
  }]);
  assert.throws(() => normalizeWalletServicePackages([{
    id: "monthly",
    name: "شهري",
    price: 4.501,
    currency: "USD"
  }], "USD"), /بيانات الباقة أو عملتها غير صالحة/);
  assert.throws(() => normalizeWalletServicePackages([{
    id: "monthly",
    name: "شهري",
    price: 4,
    currency: "SAR"
  }], "USD"), /بيانات الباقة أو عملتها غير صالحة/);
});

test("service versions resolve an immutable historical snapshot without replacing the current config", () => {
  const service = {
    serviceVersion: 3,
    name: "الحالي",
    versionHistory: [{ version: 2, snapshot: { name: "السابق", serviceVersion: 2 } }]
  };
  assert.equal(getWalletServiceVersion(service).name, "الحالي");
  assert.equal(getWalletServiceVersion(service, 2).name, "السابق");
  assert.equal(getWalletServiceVersion(service, 1), null);
});

test("service version dates identify only the configuration active when a draft was created", () => {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  const changedAt = new Date("2026-02-01T00:00:00.000Z");
  const service = {
    createdAt,
    serviceVersion: 2,
    versionHistory: [{ version: 1, createdAt: changedAt, snapshot: { serviceVersion: 1 } }]
  };
  assert.equal(getWalletServiceVersionAt(service, new Date("2026-01-15T00:00:00.000Z")), 1);
  assert.equal(getWalletServiceVersionAt(service, new Date("2026-02-15T00:00:00.000Z")), 2);
  assert.equal(isWalletServiceVersionValidAt(service, 1, changedAt), false);
  assert.equal(isWalletServiceVersionValidAt(service, 2, changedAt), true);
  assert.equal(isWalletServiceVersionValidAt(service, 1, new Date("2025-12-31T23:59:59.000Z")), false);
});
