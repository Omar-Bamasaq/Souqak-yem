import test from "node:test";
import assert from "node:assert/strict";
import AdView from "../src/models/AdView.js";
import StoreProfile from "../src/models/StoreProfile.js";
import User from "../src/models/User.js";
import CategoryAttribute from "../src/models/CategoryAttribute.js";
import City from "../src/models/City.js";
import Governorate from "../src/models/Governorate.js";
import DraftAction from "../src/models/DraftAction.js";

function indexOptions(schema, expectedKeys) {
  const expectedEntries = JSON.stringify(expectedKeys);
  const matches = schema.indexes().filter(([keys]) =>
    JSON.stringify(Object.entries(keys)) === expectedEntries
  );

  assert.equal(
    matches.length,
    1,
    `Expected exactly one index with keys ${expectedEntries}`
  );
  return matches[0][1];
}

test("StoreProfile schema retains its expected index definitions", () => {
  const schema = StoreProfile.schema;

  for (const keys of [
    [["userId", 1]],
    [["storeType", 1]],
    [["status", 1]],
    [["userId", 1], ["status", 1]],
    [["slug", 1], ["status", 1]]
  ]) {
    assert.notEqual(indexOptions(schema, keys).unique, true);
  }

  assert.equal(indexOptions(schema, [["slug", 1]]).unique, true);

  const storeTypeIndex = indexOptions(schema, [["userId", 1], ["storeType", 1]]);
  assert.equal(storeTypeIndex.unique, true);
  assert.deepEqual(storeTypeIndex.partialFilterExpression, {
    storeType: { $exists: true }
  });

  const draftActionIndex = indexOptions(schema, [["draftActionId", 1]]);
  assert.equal(draftActionIndex.unique, true);
  assert.deepEqual(draftActionIndex.partialFilterExpression, {
    draftActionId: { $type: "objectId" }
  });

  assert.equal(indexOptions(schema, [["userId", 1]]).unique, undefined);
});

test("AdView schema retains its expected index definitions", () => {
  const schema = AdView.schema;

  for (const field of ["adId", "userId", "ip"]) {
    assert.notEqual(indexOptions(schema, [[field, 1]]).unique, true);
  }

  const userViewIndex = indexOptions(schema, [["adId", 1], ["userId", 1]]);
  assert.equal(userViewIndex.unique, true);
  assert.deepEqual(userViewIndex.partialFilterExpression, {
    userId: { $exists: true }
  });

  const ipViewIndex = indexOptions(schema, [["adId", 1], ["ip", 1]]);
  assert.equal(ipViewIndex.unique, true);
  assert.deepEqual(ipViewIndex.partialFilterExpression, {
    ip: { $exists: true }
  });
});

test("User email and display-name uniqueness each have one intended definition", () => {
  const indexes = User.schema.indexes();
  const emailIndexes = indexes.filter(([keys]) => JSON.stringify(keys) === JSON.stringify({ email: 1 }));
  const nameIndexes = indexes.filter(([keys]) => JSON.stringify(keys) === JSON.stringify({ name: 1 }));

  assert.equal(emailIndexes.length, 1);
  assert.equal(emailIndexes[0][1].unique, true);
  assert.equal(nameIndexes.length, 1);
  assert.equal(nameIndexes[0][1].unique, true);
  assert.deepEqual(nameIndexes[0][1].collation, { locale: "en", strength: 2 });

  const initialAdmin = indexOptions(User.schema, [["isInitialAdmin", 1]]);
  assert.equal(initialAdmin.unique, true);
  assert.deepEqual(initialAdmin.partialFilterExpression, { isInitialAdmin: true });
});

test("reference-data models declare their seed idempotency indexes", () => {
  assert.equal(
    indexOptions(CategoryAttribute.schema, [["categoryId", 1], ["name", 1]]).unique,
    true
  );
  assert.equal(
    indexOptions(City.schema, [["governorateId", 1], ["name", 1]]).unique,
    true
  );
  assert.equal(indexOptions(Governorate.schema, [["name", 1]]).unique, true);
});

test("incomplete wallet-service drafts are unique per user and service", () => {
  const serviceDraft = indexOptions(DraftAction.schema, [
    ["userId", 1],
    ["type", 1],
    ["serviceId", 1]
  ]);
  assert.equal(serviceDraft.unique, true);
  assert.deepEqual(serviceDraft.partialFilterExpression, {
    status: "incomplete",
    type: "wallet_service_catalog",
    serviceId: { $type: "objectId" }
  });

  const otherDraft = indexOptions(DraftAction.schema, [["userId", 1], ["type", 1]]);
  assert.equal(otherDraft.unique, true);
  assert.deepEqual(otherDraft.partialFilterExpression, {
    status: "incomplete",
    type: { $in: ["store_creation", "family_production_registration", "featured_ad_upgrade"] }
  });
});

test("DraftAction disables automatic index creation without changing other models", async () => {
  const otherModelAutoIndex = User.schema.options.autoIndex;
  const createIndexCalls = [];
  const originalCreateIndex = DraftAction.collection.createIndex;
  const originalAddQueue = DraftAction.collection.addQueue;

  DraftAction.collection.createIndex = async (...args) => {
    createIndexCalls.push(args);
  };
  DraftAction.collection.addQueue = function runQueuedCallback(callback, args) {
    callback.apply(this, args);
  };

  try {
    assert.equal(DraftAction.schema.options.autoIndex, false);
    assert.equal(User.schema.options.autoIndex, otherModelAutoIndex);
    await DraftAction.ensureIndexes({ _automatic: true });
    assert.deepEqual(createIndexCalls, []);
  } finally {
    DraftAction.collection.createIndex = originalCreateIndex;
    DraftAction.collection.addQueue = originalAddQueue;
  }
});
