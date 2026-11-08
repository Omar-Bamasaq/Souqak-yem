import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import storesRouter from "../src/routes/stores.js";
import StoreProfile from "../src/models/StoreProfile.js";
import StoreSubscription from "../src/models/StoreSubscription.js";
import PurchaseRequest from "../src/models/PurchaseRequest.js";
import City from "../src/models/City.js";

function query(value) {
  return {
    select() { return this; },
    sort() { return this; },
    populate() { return this; },
    lean() { return Promise.resolve(value); }
  };
}

function routeHandler(method, routePath) {
  const layer = storesRouter.stack.find((entry) => entry.route?.path === routePath && entry.route.methods[method]);
  assert.ok(layer, `Expected ${method.toUpperCase()} ${routePath} route`);
  return layer.route.stack.at(-1).handle;
}

function responseCapture() {
  const result = { statusCode: 200, body: null };
  return {
    result,
    res: {
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; }
    }
  };
}

test("store owner can add multiple bank accounts in supported currencies and edit/delete by embedded id", async () => {
  const handler = routeHandler("patch", "/me");
  const originals = {
    storeFindOne: StoreProfile.findOne,
    storeUpdate: StoreProfile.findByIdAndUpdate,
    subscriptionFindOne: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    cityFind: City.find
  };
  const accountId = "507f1f77bcf86cd799439013";
  const store = {
    _id: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    storeType: "store",
    status: "active",
    storeName: "متجر تجريبي",
    businessActivity: "تجارة",
    bankAccounts: [{
      _id: accountId,
      bankName: "البنك القديم",
      accountHolderName: "صاحب المتجر",
      accountNumber: "12345",
      currency: "YER"
    }]
  };
  let savedUpdate;

  StoreProfile.findOne = () => query(store);
  StoreProfile.findByIdAndUpdate = (_id, update) => {
    savedUpdate = update;
    return query({ ...store, ...update });
  };
  StoreSubscription.findOne = () => query({
    status: "active",
    endDate: new Date(Date.now() + 86400000),
    planId: { type: "store", features: { customization: true } }
  });
  StoreSubscription.getStoreSubscriptionStatus = (subscription) => subscription?.status || "inactive";
  City.find = () => query([]);

  try {
    const inputAccounts = [
      { bankName: "بنك اليمن", accountHolderName: "صاحب المتجر", accountNumber: "12345", currency: "YER" },
      { bankName: "بنك السعودية", accountHolderName: "صاحب المتجر", accountNumber: "67890", currency: "SAR" },
      { bankName: "بنك دولي", accountHolderName: "صاحب المتجر", accountNumber: "USD-001", currency: "USD" },
      { bankName: "حساب إضافي", accountHolderName: "صاحب المتجر", accountNumber: "YER-002", currency: "YER" }
    ];
    const addCapture = responseCapture();
    await handler({ user: { id: store.userId }, body: { bankAccounts: JSON.stringify(inputAccounts) }, files: {} }, addCapture.res);

    assert.equal(addCapture.result.statusCode, 200);
    assert.equal(savedUpdate.bankAccounts.length, 4);
    assert.deepEqual(savedUpdate.bankAccounts.map((account) => account.currency), ["YER", "SAR", "USD", "YER"]);
    assert.equal(new Set(savedUpdate.bankAccounts.map((account) => String(account._id))).size, 4);

    const editCapture = responseCapture();
    await handler({
      user: { id: store.userId },
      body: {
        bankAccounts: JSON.stringify([{
          _id: accountId,
          bankName: "البنك المعدل",
          accountHolderName: "صاحب المتجر",
          accountNumber: "54321",
          currency: "SAR"
        }])
      },
      files: {}
    }, editCapture.res);

    assert.equal(editCapture.result.statusCode, 200);
    assert.equal(savedUpdate.bankAccounts.length, 1);
    assert.equal(String(savedUpdate.bankAccounts[0]._id), accountId);
    assert.equal(savedUpdate.bankAccounts[0].bankName, "البنك المعدل");
    assert.equal(savedUpdate.bankAccounts[0].currency, "SAR");

    const deleteCapture = responseCapture();
    await handler({ user: { id: store.userId }, body: { bankAccounts: "[]" }, files: {} }, deleteCapture.res);
    assert.equal(deleteCapture.result.statusCode, 200);
    assert.deepEqual(savedUpdate.bankAccounts, []);
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreProfile.findByIdAndUpdate = originals.storeUpdate;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    City.find = originals.cityFind;
  }
});

test("store bank account validation rejects unsupported currency, missing fields, unknown fields, and foreign ids", async () => {
  const handler = routeHandler("patch", "/me");
  const originals = {
    storeFindOne: StoreProfile.findOne,
    subscriptionFindOne: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    cityFind: City.find
  };
  const store = {
    _id: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    storeType: "store",
    status: "active",
    bankAccounts: []
  };
  StoreProfile.findOne = () => query(store);
  StoreSubscription.findOne = () => query({
    status: "active",
    endDate: new Date(Date.now() + 86400000),
    planId: { type: "store", features: { customization: true } }
  });
  StoreSubscription.getStoreSubscriptionStatus = (subscription) => subscription?.status || "inactive";
  City.find = () => query([]);

  try {
    const invalidEntries = [
      { bankName: "بنك", accountHolderName: "مالك", accountNumber: "123", currency: "EUR" },
      { bankName: "بنك", accountHolderName: "", accountNumber: "123", currency: "YER" },
      { bankName: "بنك", accountHolderName: "مالك", accountNumber: "123", currency: "YER", iban: "not-allowed" },
      { _id: "507f1f77bcf86cd799439099", bankName: "بنك", accountHolderName: "مالك", accountNumber: "123", currency: "YER" }
    ];
    for (const account of invalidEntries) {
      const capture = responseCapture();
      await handler({ user: { id: store.userId }, body: { bankAccounts: JSON.stringify([account]) }, files: {} }, capture.res);
      assert.equal(capture.result.statusCode, 400);
    }
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    City.find = originals.cityFind;
  }
});

test("other users, expired subscriptions, and plans without customization cannot change bank accounts", async () => {
  const handler = routeHandler("patch", "/me");
  const originals = {
    storeFindOne: StoreProfile.findOne,
    subscriptionFindOne: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    cityFind: City.find
  };
  const store = {
    _id: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    storeType: "store",
    status: "active",
    bankAccounts: []
  };
  let subscription = {
    status: "active",
    endDate: new Date(Date.now() + 86400000),
    planId: { type: "store", features: { customization: true } }
  };
  StoreProfile.findOne = (filter) => query(String(filter.userId) === store.userId ? store : null);
  StoreSubscription.findOne = () => query(subscription);
  StoreSubscription.getStoreSubscriptionStatus = (value) => (
    value?.endDate && new Date(value.endDate) < new Date() ? "expired" : value?.status || "inactive"
  );
  City.find = () => query([]);

  try {
    const body = { bankAccounts: "[]" };
    for (const userId of ["111111111111111111111111", store.userId]) {
      if (userId === store.userId) subscription = { ...subscription, endDate: new Date(Date.now() - 86400000) };
      const capture = responseCapture();
      await handler({ user: { id: userId }, body, files: {} }, capture.res);
      assert.ok([403, 404].includes(capture.result.statusCode));
    }
    subscription = {
      status: "active",
      endDate: new Date(Date.now() + 86400000),
      planId: { type: "store", features: { customization: false } }
    };
    const disabledCapture = responseCapture();
    await handler({ user: { id: store.userId }, body, files: {} }, disabledCapture.res);
    assert.equal(disabledCapture.result.statusCode, 403);
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    City.find = originals.cityFind;
  }
});

test("owner endpoint returns bank accounts only with an active subscription and customization enabled", async () => {
  const handler = routeHandler("get", "/me");
  const originals = {
    storeFindOne: StoreProfile.findOne,
    subscriptionFindOne: StoreSubscription.findOne,
    subscriptionStatus: StoreSubscription.getStoreSubscriptionStatus,
    pendingFindOne: PurchaseRequest.findOne
  };
  const bankAccounts = [{
    _id: "507f1f77bcf86cd799439013",
    bankName: "بنك خاص",
    accountHolderName: "صاحب المتجر",
    accountNumber: "12345",
    currency: "YER"
  }];
  const store = {
    _id: "507f1f77bcf86cd799439011",
    userId: "507f1f77bcf86cd799439012",
    storeType: "store",
    status: "active",
    bankAccounts
  };
  let features = { customization: true };
  StoreProfile.findOne = () => query(store);
  StoreSubscription.findOne = () => query({
    status: "active",
    endDate: new Date(Date.now() + 86400000),
    planId: { type: "store", features }
  });
  StoreSubscription.getStoreSubscriptionStatus = (subscription) => subscription?.status || "inactive";
  PurchaseRequest.findOne = () => query(null);

  try {
    const enabledCapture = responseCapture();
    await handler({ user: { id: store.userId }, query: {} }, enabledCapture.res);
    assert.deepEqual(enabledCapture.result.body.bankAccounts, bankAccounts);

    features = { customization: false };
    const disabledCapture = responseCapture();
    await handler({ user: { id: store.userId }, query: {} }, disabledCapture.res);
    assert.equal(Object.hasOwn(disabledCapture.result.body, "bankAccounts"), false);
  } finally {
    StoreProfile.findOne = originals.storeFindOne;
    StoreSubscription.findOne = originals.subscriptionFindOne;
    StoreSubscription.getStoreSubscriptionStatus = originals.subscriptionStatus;
    PurchaseRequest.findOne = originals.pendingFindOne;
  }
});

test("bank accounts are returned only by the gated owner endpoint, never public store or product projections", () => {
  const storesSource = fs.readFileSync(path.resolve(process.cwd(), "src/routes/stores.js"), "utf8");
  const adSource = fs.readFileSync(path.resolve(process.cwd(), "src/routes/ads.js"), "utf8");
  const modelSource = fs.readFileSync(path.resolve(process.cwd(), "src/models/StoreProfile.js"), "utf8");
  assert.match(modelSource, /bankAccounts:\s*\{\s*type:\s*\[storeBankAccountSchema\]/);
  assert.match(modelSource, /bankAccounts:.*select:\s*false/);
  assert.match(storesSource, /mayReadBankAccounts/);
  assert.match(storesSource, /\.select\("\+bankAccounts(?:\s+\+notificationEmail)?"\)/);
  assert.match(storesSource, /\.\.\.\(mayReadBankAccounts \? \{ bankAccounts: bankAccounts \|\| \[\] \} : \{\}\)/);
  assert.match(storesSource, /\.select\("storeName slug storeType activityKey description businessActivity logo cover location selectedCategories status phone email social userId deliveryAvailable"\)/);
  assert.doesNotMatch(adSource, /bankAccounts/);
});
