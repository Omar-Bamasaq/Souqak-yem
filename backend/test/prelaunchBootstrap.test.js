import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import {
  connectPrelaunchDatabase,
  requireReferenceDataApproval,
  resolvePrelaunchTarget,
  safeErrorSummary
} from "../src/lib/prelaunchDatabase.js";
import SystemSettings from "../src/models/SystemSettings.js";
import ConfigEngine from "../src/engines/ConfigEngine.js";
import { createInitialAdmin, run as runAdminSeed } from "../seedAdmin.js";
import { seedCategories } from "../seedCategories.js";
import { seedYemenLocations } from "../seedYemenLocations.js";
import {
  initializeApprovedSystemSettings,
  validateApprovedSystemSettings
} from "../seedSystemSettings.js";

const validTarget = {
  PRELAUNCH_MONGODB_URI: "mongodb://127.0.0.1:27018/souqak_prelaunch_test",
  PRELAUNCH_DATABASE_NAME: "souqak_prelaunch_test"
};

function approvedSettingsFixture() {
  return {
    adReviewMode: "manual",
    adReviewDelayMinutes: 0,
    prohibitedKeywords: ["owner-approved-policy"],
    withdrawalIdentityThresholdUsd: 250,
    exchangeRates: { USD: 1, SAR: 3.75, YER: 1, YER_SANAA: 1, YER_ADEN: 1 },
    exchangeRatePairs: {
      SAR: { buy: 3.75, sell: 3.75 },
      YER_SANAA: { buy: 1, sell: 1 },
      YER_ADEN: { buy: 1, sell: 1 }
    },
    exchangeRatesUpdatedAt: null,
    welcomePromotion: { enabled: false, durationHours: 6, maxBeneficiaries: 100 },
    brokerageEnabled: false,
    referralProgram: {
      programEnabled: false,
      defaultReferralRate: 0,
      saleReferralRate: 0,
      safePurchaseReferralRate: 0,
      promotionReferralRate: 0,
      minimumWithdrawal: { YER: 0, YER_ADEN: 0, YER_SANAA: 0, SAR: 0, USD: 0 },
      pendingPeriod: 0,
      maxDailyReferralRewards: 0,
      maxDailyWithdrawals: 0,
      fraudReviewEnabled: true
    }
  };
}

function fakeUpsertModel(records, getKey) {
  return {
    async findOne(filter) {
      return records.find((record) => getKey(record) === getKey(filter)) || null;
    },
    async findOneAndUpdate(filter, update, options) {
      let record = records.find((item) => getKey(item) === getKey(filter));
      if (!record && options.upsert) {
        record = { ...(update.$setOnInsert || {}), ...(update.$set || {}) };
        if (filter.slug) record.slug = filter.slug;
        if (filter.categoryId) {
          record.categoryId = filter.categoryId;
          record.name = filter.name;
        }
        record._id ||= `id-${records.length + 1}`;
        records.push(record);
      } else if (record) {
        Object.assign(record, update.$set || {});
      }
      return record || null;
    }
  };
}

test("prelaunch target requires explicit URI and database name", () => {
  assert.throws(
    () => resolvePrelaunchTarget({ PRELAUNCH_DATABASE_NAME: validTarget.PRELAUNCH_DATABASE_NAME }),
    /PRELAUNCH_MONGODB_URI is required/
  );
  assert.throws(
    () => resolvePrelaunchTarget({ PRELAUNCH_MONGODB_URI: validTarget.PRELAUNCH_MONGODB_URI }),
    /PRELAUNCH_DATABASE_NAME is required/
  );
});

test("prelaunch target rejects old names, remote hosts, and URI/name mismatches", () => {
  assert.throws(
    () => resolvePrelaunchTarget({
      PRELAUNCH_MONGODB_URI: "mongodb://127.0.0.1:27018/yemen_market",
      PRELAUNCH_DATABASE_NAME: "yemen_market"
    }),
    /not an approved/
  );
  assert.throws(
    () => resolvePrelaunchTarget({
      PRELAUNCH_MONGODB_URI: "mongodb://example.invalid:27018/souqak_prelaunch_test",
      PRELAUNCH_DATABASE_NAME: "souqak_prelaunch_test"
    }),
    /loopback/
  );
  assert.throws(
    () => resolvePrelaunchTarget({
      ...validTarget,
      PRELAUNCH_DATABASE_NAME: "souqak_prelaunch_other"
    }),
    /exactly match/
  );
  assert.throws(
    () => resolvePrelaunchTarget({
      ...validTarget,
      PRELAUNCH_MONGODB_URI: `${validTarget.PRELAUNCH_MONGODB_URI}?replicaSet=external`
    }),
    /single direct/
  );
});

test("reference-data seed requires explicit approval", () => {
  assert.throws(() => requireReferenceDataApproval({}), /PRELAUNCH_REFERENCE_DATA_APPROVED=YES/);
  assert.doesNotThrow(() => requireReferenceDataApproval({ PRELAUNCH_REFERENCE_DATA_APPROVED: "YES" }));
  for (const filename of ["seedCategories.js", "seedYemenLocations.js"]) {
    const source = fs.readFileSync(new URL(`../${filename}`, import.meta.url), "utf8");
    assert.match(source, /resolvePrelaunchTarget\(env\);\s*requireReferenceDataApproval\(env\);/);
    assert.match(source, /await connectPrelaunchDatabase\(env\);/);
  }
});

test("reference seed helpers reject calls without an explicit approved target", async () => {
  let modelCalls = 0;
  const model = {
    async findOne() {
      modelCalls += 1;
      return null;
    }
  };
  await assert.rejects(
    seedCategories({
      CategoryModel: model,
      CategoryAttributeModel: model,
      categoryData: []
    }),
    /PRELAUNCH_MONGODB_URI is required/
  );
  await assert.rejects(
    seedYemenLocations({
      GovernorateModel: model,
      CityModel: model,
      locationData: []
    }),
    /PRELAUNCH_MONGODB_URI is required/
  );
  assert.equal(modelCalls, 0);
});

test("missing prelaunch settings stop before mongoose connects", async () => {
  const originalConnect = mongoose.connect;
  let connectCalls = 0;
  mongoose.connect = async () => {
    connectCalls += 1;
  };
  try {
    await assert.rejects(connectPrelaunchDatabase({}), /PRELAUNCH_MONGODB_URI is required/);
    assert.equal(connectCalls, 0);
  } finally {
    mongoose.connect = originalConnect;
  }
});

test("safe error summaries do not expose messages or arbitrary error names", () => {
  const summary = JSON.stringify(safeErrorSummary({
    name: "secret-value",
    message: "mongodb://user:password@host/db"
  }));
  assert.doesNotMatch(summary, /secret-value|password|mongodb:/);
});

test("admin bootstrap refuses existing administrators without changing users", async () => {
  let createCalls = 0;
  const existingAdmin = { role: "admin" };
  const UserModel = {
    async findOne() {
      return existingAdmin;
    },
    async create() {
      createCalls += 1;
    }
  };
  await assert.rejects(
    createInitialAdmin({
      UserModel,
      env: {
        ...validTarget,
        PRELAUNCH_ADMIN_APPROVED: "YES",
        PRELAUNCH_ADMIN_NAME: "Owner",
        PRELAUNCH_ADMIN_EMAIL: "owner@example.invalid",
        PRELAUNCH_ADMIN_PASSWORD: "a-long-test-password"
      }
    }),
    /only when no administrator/
  );
  assert.equal(createCalls, 0);
});

test("admin bootstrap validates the target before reading or writing users", async () => {
  let queryCalls = 0;
  const UserModel = {
    async findOne() {
      queryCalls += 1;
      return null;
    }
  };
  await assert.rejects(
    createInitialAdmin({
      UserModel,
      env: {
        PRELAUNCH_ADMIN_APPROVED: "YES",
        PRELAUNCH_ADMIN_NAME: "Owner",
        PRELAUNCH_ADMIN_EMAIL: "owner@example.invalid",
        PRELAUNCH_ADMIN_PASSWORD: "a-long-test-password"
      }
    }),
    /PRELAUNCH_MONGODB_URI is required/
  );
  assert.equal(queryCalls, 0);
});

test("admin bootstrap hashes the supplied password and does not log credentials", async () => {
  let created;
  const password = "a-long-test-password";
  const UserModel = {
    async findOne() {
      return null;
    },
    async create(document) {
      created = document;
    }
  };
  const result = await createInitialAdmin({
    UserModel,
    passwordHasher: async (value, rounds) => {
      assert.equal(value, password);
      assert.equal(rounds, 12);
      return "hashed-password";
    },
    env: {
      ...validTarget,
      PRELAUNCH_ADMIN_NAME: "Owner",
      PRELAUNCH_ADMIN_EMAIL: "OWNER@example.invalid",
      PRELAUNCH_ADMIN_APPROVED: "YES",
      PRELAUNCH_ADMIN_PASSWORD: password
    }
  });
  assert.deepEqual(result, { created: true });
  assert.equal(created.email, "owner@example.invalid");
  assert.equal(created.password, "hashed-password");
  assert.equal(created.role, "admin");
  assert.equal(created.isInitialAdmin, true);
  assert.equal(JSON.stringify(result).includes(password), false);
});

test("unique initial-admin index prevents concurrent bootstrap inserts", async () => {
  const adminIndex = User.schema.indexes().find(([keys, options]) =>
    JSON.stringify(keys) === JSON.stringify({ isInitialAdmin: 1 }) && options.unique === true
  );
  assert.deepEqual(adminIndex?.[1].partialFilterExpression, { isInitialAdmin: true });

  let findCalls = 0;
  let releaseFinds;
  const bothFindsComplete = new Promise((resolve) => {
    releaseFinds = resolve;
  });
  let insertedAdmin = null;
  const UserModel = {
    async findOne() {
      findCalls += 1;
      if (findCalls === 2) releaseFinds();
      await bothFindsComplete;
      return null;
    },
    async create(document) {
      if (insertedAdmin) {
        const error = new Error("duplicate key");
        error.code = 11000;
        throw error;
      }
      insertedAdmin = document;
      return document;
    }
  };
  const env = {
    ...validTarget,
    PRELAUNCH_ADMIN_NAME: "Owner",
    PRELAUNCH_ADMIN_EMAIL: "owner@example.invalid",
    PRELAUNCH_ADMIN_APPROVED: "YES",
    PRELAUNCH_ADMIN_PASSWORD: "a-long-test-password"
  };

  const results = await Promise.allSettled([
    createInitialAdmin({ UserModel, passwordHasher: async () => "hash-a", env }),
    createInitialAdmin({ UserModel, passwordHasher: async () => "hash-b", env })
  ]);

  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(insertedAdmin.isInitialAdmin, true);
});

test("admin bootstrap requires explicit approval before model or connection operations", async () => {
  let modelCalls = 0;
  let connectionCalls = 0;
  let writeCalls = 0;
  const UserModel = {
    async createIndexes() {
      modelCalls += 1;
    },
    async findOne() {
      modelCalls += 1;
      return null;
    },
    async create() {
      writeCalls += 1;
    }
  };
  const env = {
    ...validTarget,
    PRELAUNCH_ADMIN_NAME: "Owner",
    PRELAUNCH_ADMIN_EMAIL: "owner@example.invalid",
    PRELAUNCH_ADMIN_PASSWORD: "a-long-test-password"
  };

  await assert.rejects(
    createInitialAdmin({ UserModel, env }),
    /PRELAUNCH_ADMIN_APPROVED=YES/
  );
  await assert.rejects(
    runAdminSeed(env, async () => {
      connectionCalls += 1;
    }),
    /PRELAUNCH_ADMIN_APPROVED=YES/
  );

  assert.equal(modelCalls, 0);
  assert.equal(connectionCalls, 0);
  assert.equal(writeCalls, 0);
});

test("admin seed import does not connect automatically", () => {
  assert.equal(mongoose.connection.readyState, 0);
});

test("category seed upserts defined attributes without deleting unspecified ones", async () => {
  const categories = [
    { _id: "main", slug: "vehicles", name: "Vehicles" },
    { _id: "cars", slug: "cars", name: "Cars", parentId: "main" }
  ];
  const attributes = [
    { _id: "legacy", categoryId: "cars", name: "legacy_attribute", label: "Legacy" }
  ];
  const CategoryModel = fakeUpsertModel(categories, (record) => record.slug);
  const CategoryAttributeModel = fakeUpsertModel(
    attributes,
    (record) => `${record.categoryId}:${record.name}`
  );

  const result = await seedCategories({
    CategoryModel,
    CategoryAttributeModel,
    categoryData: [{
      slug: "vehicles",
      name: "Vehicles",
      subcategories: [{
        slug: "cars",
        name: "Cars",
        attributes: [{ name: "make", label: "Make", type: "text" }]
      }]
    }],
    env: { ...validTarget, PRELAUNCH_REFERENCE_DATA_APPROVED: "YES" }
  });

  assert.equal(result.categoriesProcessed, 2);
  assert.equal(result.attributesProcessed, 1);
  assert.ok(attributes.some((attribute) => attribute.name === "legacy_attribute"));
  assert.ok(attributes.some((attribute) => attribute.name === "make"));

  await seedCategories({
    CategoryModel,
    CategoryAttributeModel,
    categoryData: [{
      slug: "vehicles",
      name: "Vehicles",
      subcategories: [{
        slug: "cars",
        name: "Cars",
        attributes: [{ name: "make", label: "Make", type: "text" }]
      }]
    }],
    env: { ...validTarget, PRELAUNCH_REFERENCE_DATA_APPROVED: "YES" }
  });
  assert.equal(categories.length, 2);
  assert.equal(attributes.length, 2);
});

test("category seed reuses the legacy vehicles root and preserves existing relationships", async () => {
  const categories = [
    { _id: "legacy-vehicles", slug: "المركبات", name: "المركبات", status: "hidden" },
    { _id: "legacy-cars", slug: "cars-for-sale", name: "سيارات للبيع", parentId: "legacy-vehicles", status: "hidden" },
    { _id: "electronics", slug: "electronics", name: "الإلكترونيات" },
    { _id: "computers", slug: "computers", name: "الحواسيب", parentId: "electronics" }
  ];
  const attributes = [
    {
      _id: "existing-computer-attribute",
      categoryId: "computers",
      name: "legacy_attribute",
      label: "Legacy",
      linkedValue: "preserve"
    }
  ];
  const CategoryModel = fakeUpsertModel(categories, (record) => record.slug);
  const CategoryAttributeModel = fakeUpsertModel(
    attributes,
    (record) => `${record.categoryId}:${record.name}`
  );
  const categoryData = [
    {
      slug: "cars",
      name: "السيارات",
      subcategories: [
        { slug: "cars-for-sale", name: "سيارات للبيع" },
        { slug: "cars-for-rent", name: "سيارات للإيجار" },
        { slug: "new-cars-category", name: "فئة جديدة" }
      ]
    },
    {
      slug: "electronics",
      name: "الإلكترونيات",
      subcategories: [{
        slug: "computers",
        name: "الحواسيب",
        attributes: [{ name: "make", label: "الشركة", type: "text" }]
      }]
    }
  ];
  const env = { ...validTarget, PRELAUNCH_REFERENCE_DATA_APPROVED: "YES" };

  await seedCategories({ CategoryModel, CategoryAttributeModel, categoryData, env });
  await seedCategories({ CategoryModel, CategoryAttributeModel, categoryData, env });

  assert.equal(categories.filter((category) => category.slug === "cars").length, 0);
  assert.equal(categories.find((category) => category._id === "legacy-vehicles").status, "hidden");
  assert.equal(categories.find((category) => category._id === "legacy-cars").parentId, "legacy-vehicles");
  assert.equal(categories.find((category) => category._id === "legacy-cars").status, "hidden");
  assert.equal(categories.find((category) => category.slug === "new-cars-category").parentId, "legacy-vehicles");
  assert.equal(categories.find((category) => category._id === "computers").parentId, "electronics");
  assert.equal(categories.filter((category) => category.slug === "new-cars-category").length, 1);
  assert.equal(categories.filter((category) => category.slug === "cars-for-rent").length, 1);
  assert.equal(attributes.filter((attribute) => attribute.name === "make").length, 1);
  assert.equal(attributes.find((attribute) => attribute._id === "existing-computer-attribute").linkedValue, "preserve");
  assert.equal(attributes.find((attribute) => attribute._id === "existing-computer-attribute").categoryId, "computers");
});

test("category seed rejects conflicting canonical and legacy vehicle roots", async () => {
  const categories = [
    { _id: "cars-root", slug: "cars", name: "Cars" },
    { _id: "legacy-root", slug: "المركبات", name: "المركبات" }
  ];
  const CategoryModel = fakeUpsertModel(categories, (record) => record.slug);
  const CategoryAttributeModel = fakeUpsertModel([], (record) => `${record.categoryId}:${record.name}`);

  await assert.rejects(
    seedCategories({
      CategoryModel,
      CategoryAttributeModel,
      categoryData: [
        { slug: "new-root", name: "فئة جديدة", subcategories: [] },
        { slug: "cars", name: "السيارات", subcategories: [] }
      ],
      env: { ...validTarget, PRELAUNCH_REFERENCE_DATA_APPROVED: "YES" }
    }),
    /Conflicting root categories/
  );
  assert.equal(categories.length, 2);
  assert.equal(categories.some((category) => category.slug === "new-root"), false);
});

test("location seed uses the supplied data and remains mockable without a database", async () => {
  const governorates = [];
  const cities = [];
  const GovernorateModel = {
    async findOne({ name }) {
      return governorates.find((item) => item.name === name) || null;
    },
    async create(document) {
      const record = { ...document, _id: "governorate-1" };
      governorates.push(record);
      return record;
    }
  };
  const CityModel = {
    async updateOne(filter, update) {
      const exists = cities.some(
        (city) => city.name === filter.name && city.governorateId === filter.governorateId
      );
      if (!exists) {
        cities.push({ ...update.$setOnInsert });
        return { upsertedCount: 1 };
      }
      return { upsertedCount: 0 };
    }
  };

  const result = await seedYemenLocations({
    GovernorateModel,
    CityModel,
    locationData: [{ governorate: "Test governorate", cities: ["Test city"] }],
    env: { ...validTarget, PRELAUNCH_REFERENCE_DATA_APPROVED: "YES" }
  });

  assert.deepEqual(result, { governorates: 1, cities: 1 });
  assert.equal(governorates[0].name, "Test governorate");
  assert.equal(cities[0].name, "Test city");

  const repeated = await seedYemenLocations({
    GovernorateModel,
    CityModel,
    locationData: [{ governorate: "Test governorate", cities: ["Test city"] }],
    env: { ...validTarget, PRELAUNCH_REFERENCE_DATA_APPROVED: "YES" }
  });
  assert.deepEqual(repeated, { governorates: 0, cities: 0 });
});

test("concurrent location seeds tolerate unique-index duplicate-key races", async () => {
  const governorates = [];
  const cities = [];
  let governorateReads = 0;
  let releaseGovernorateReads;
  const bothGovernorateReads = new Promise((resolve) => {
    releaseGovernorateReads = resolve;
  });
  let cityWrites = 0;
  let releaseCityWrites;
  const bothCityWrites = new Promise((resolve) => {
    releaseCityWrites = resolve;
  });
  const GovernorateModel = {
    async findOne({ name }) {
      governorateReads += 1;
      if (governorateReads <= 2) {
        if (governorateReads === 2) releaseGovernorateReads();
        await bothGovernorateReads;
        return null;
      }
      return governorates.find((item) => item.name === name) || null;
    },
    async create(document) {
      if (governorates.length) {
        const error = new Error("duplicate key");
        error.code = 11000;
        throw error;
      }
      const record = { ...document, _id: "shared-governorate" };
      governorates.push(record);
      return record;
    }
  };
  const CityModel = {
    async updateOne(filter, update) {
      cityWrites += 1;
      if (cityWrites <= 2) {
        if (cityWrites === 2) releaseCityWrites();
        await bothCityWrites;
        if (!cities.length) {
          cities.push({ ...update.$setOnInsert });
          return { upsertedCount: 1 };
        }
      }
      const error = new Error("duplicate key");
      error.code = 11000;
      throw error;
    },
    async findOne({ name, governorateId }) {
      return cities.find((city) => city.name === name && city.governorateId === governorateId) || null;
    }
  };
  const options = {
    GovernorateModel,
    CityModel,
    locationData: [{ governorate: "Concurrent governorate", cities: ["Concurrent city"] }],
    env: { ...validTarget, PRELAUNCH_REFERENCE_DATA_APPROVED: "YES" }
  };

  const results = await Promise.all([
    seedYemenLocations(options),
    seedYemenLocations(options)
  ]);
  assert.equal(governorates.length, 1);
  assert.equal(cities.length, 1);
  assert.equal(results.reduce((total, result) => total + result.governorates, 0), 1);
  assert.equal(results.reduce((total, result) => total + result.cities, 0), 1);
});

test("SystemSettings never creates implicit commercial defaults on read", async () => {
  const singletonIndexes = SystemSettings.schema.indexes().filter(([keys, options]) =>
    JSON.stringify(keys) === JSON.stringify({ singletonKey: 1 }) && options.unique === true
  );
  assert.equal(singletonIndexes.length, 1);
  assert.deepEqual(singletonIndexes[0][1].partialFilterExpression, {
    singletonKey: { $type: "string" }
  });

  let writeCalls = 0;
  const model = {
    async findOne() {
      return null;
    },
    async findOneAndUpdate() {
      writeCalls += 1;
    }
  };

  await assert.rejects(
    SystemSettings.schema.statics.getSettings.call(model),
    /have not been initialized/
  );
  assert.equal(writeCalls, 0);
});

test("approved settings require explicit owner decisions for commercial values", () => {
  const input = approvedSettingsFixture();
  const settings = validateApprovedSystemSettings(input);

  assert.equal(settings.singletonKey, "global");
  assert.equal(settings.brokerageEnabled, false);
  assert.equal(settings.referralProgram.programEnabled, false);
  assert.equal(settings.welcomePromotion.enabled, false);
  assert.equal(settings.welcomePromotion.usedCount, 0);
  assert.equal(settings.exchangeRates.YER_ADEN, input.exchangeRates.YER_ADEN);

  const missingExchangeRate = approvedSettingsFixture();
  delete missingExchangeRate.exchangeRates.YER_ADEN;
  assert.throws(() => validateApprovedSystemSettings(missingExchangeRate), /exchangeRates.YER_ADEN/);

  const missingReferralChoice = approvedSettingsFixture();
  delete missingReferralChoice.brokerageEnabled;
  assert.throws(() => validateApprovedSystemSettings(missingReferralChoice), /brokerageEnabled/);
});

test("system-settings initializer validates target and approval before database operations", async () => {
  let modelCalls = 0;
  const SettingsModel = {
    async findOne() {
      modelCalls += 1;
      return null;
    }
  };
  await assert.rejects(
    initializeApprovedSystemSettings({
      SettingsModel,
      approvedSettings: approvedSettingsFixture(),
      env: {}
    }),
    /PRELAUNCH_MONGODB_URI is required/
  );
  assert.equal(modelCalls, 0);
});

test("system-settings initializer refuses to alter an existing document", async () => {
  const existing = { singletonKey: "global", brokerageEnabled: true };
  let indexCalls = 0;
  let writeCalls = 0;
  const SettingsModel = {
    async findOne() {
      return existing;
    },
    async createIndexes() {
      indexCalls += 1;
    },
    async updateOne() {
      writeCalls += 1;
    }
  };

  await assert.rejects(
    initializeApprovedSystemSettings({
      SettingsModel,
      approvedSettings: approvedSettingsFixture(),
      env: { ...validTarget, PRELAUNCH_SYSTEM_SETTINGS_APPROVED: "YES" }
    }),
    /already exist/
  );
  assert.equal(indexCalls, 0);
  assert.equal(writeCalls, 0);
  assert.equal(existing.brokerageEnabled, true);
});

test("approved settings initializer creates one document and rejects a concurrent duplicate", async () => {
  const records = [];
  let indexCalls = 0;
  let findCalls = 0;
  let releaseFinds;
  const bothFindsComplete = new Promise((resolve) => {
    releaseFinds = resolve;
  });
  const SettingsModel = {
    async findOne() {
      findCalls += 1;
      if (findCalls <= 2) {
        if (findCalls === 2) releaseFinds();
        await bothFindsComplete;
        return null;
      }
      return records[0] || null;
    },
    async createIndexes() {
      indexCalls += 1;
    },
    async updateOne(filter, update) {
      if (records.length) return { matchedCount: 1, upsertedCount: 0 };
      const record = { ...update.$setOnInsert, ...filter };
      records.push(record);
      return { matchedCount: 0, upsertedCount: 1 };
    }
  };

  const results = await Promise.allSettled([
    initializeApprovedSystemSettings({
      SettingsModel,
      approvedSettings: approvedSettingsFixture(),
      env: { ...validTarget, PRELAUNCH_SYSTEM_SETTINGS_APPROVED: "YES" }
    }),
    initializeApprovedSystemSettings({
      SettingsModel,
      approvedSettings: approvedSettingsFixture(),
      env: { ...validTarget, PRELAUNCH_SYSTEM_SETTINGS_APPROVED: "YES" }
    })
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  assert.equal(records.length, 1);
  assert.equal(indexCalls, 2);
});

test("backend startup does not initialize brokerage defaults", () => {
  const startupSource = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(startupSource, /ConfigEngine\.initializeDefaults\s*\(/);
});

test("brokerage defaults use insert-only upserts and do not overwrite existing config", async () => {
  const records = new Map();
  let createIndexesCalls = 0;
  const ConfigModel = {
    async createIndexes() {
      createIndexesCalls += 1;
    },
    async findOneAndUpdate(filter, update) {
      if (!records.has(filter.key)) {
        records.set(filter.key, { key: filter.key, ...update.$setOnInsert });
      }
      return records.get(filter.key);
    }
  };

  await ConfigEngine.initializeDefaults(ConfigModel);
  const existing = records.values().next().value;
  existing.value = "owner-approved";
  await ConfigEngine.initializeDefaults(ConfigModel);

  assert.equal(createIndexesCalls, 2);
  assert.equal(existing.value, "owner-approved");
  assert.equal(Object.hasOwn(existing, "updatedBy"), false);
});
