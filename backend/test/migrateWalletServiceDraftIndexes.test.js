import test from "node:test";
import assert from "node:assert/strict";
import DraftAction from "../src/models/DraftAction.js";
import {
  applyDraftIndexMigration,
  inspectDraftIndexes,
  rollbackDraftIndexMigration
} from "../src/scripts/migrateWalletServiceDraftIndexes.js";

const expectedIndexes = DraftAction.schema.indexes()
  .filter(([, options = {}]) => [
    "one_incomplete_non_wallet_draft_per_user_type",
    "one_incomplete_wallet_service_draft_per_service"
  ].includes(options.name))
  .map(([key, options]) => ({ key, options }));

function legacyIndex() {
  return {
    name: "userId_1_type_1",
    key: { userId: 1, type: 1 },
    unique: true,
    partialFilterExpression: { status: "incomplete" }
  };
}

function createDatabase({
  indexes = [legacyIndex()],
  duplicates = {},
  serviceIdTypes = [],
  failCreate = false
} = {}) {
  const events = [];
  const pipelines = [];
  const documents = [
    { _id: "incomplete-draft", status: "incomplete", type: "wallet_service_catalog" },
    { _id: "completed-draft", status: "completed", type: "wallet_service_catalog" },
    { _id: "awaiting-payment-order", status: "AWAITING_PAYMENT" },
    { _id: "payment-review-order", status: "PAYMENT_REVIEW" }
  ];
  const collection = {
    listIndexes() {
      return {
        toArray: async () => {
          events.push({ action: "verify" });
          return indexes.map((index) => structuredClone(index));
        }
      };
    },
    aggregate(pipeline) {
      pipelines.push(structuredClone(pipeline));
      const filter = pipeline[0].$match;
      if (pipeline[1].$group._id?.$type === "$serviceId") {
        const groupedTypes = serviceIdTypes
          .filter(({ type }) => type !== "objectId")
          .map(({ type, count }) => ({ _id: type, count }));
        return { toArray: async () => groupedTypes };
      }
      const grouping = Object.keys(pipeline[1].$group._id).join(",");
      const key = filter.type?.$in
        ? (grouping === "userId,type" ? "nonWalletDrafts" : "walletServiceDrafts")
        : grouping === "userId,type" ? "legacyUserTypeRule" : "";
      const count = duplicates[key] || 0;
      return { toArray: async () => count ? [{ duplicateGroups: count }] : [] };
    },
    async createIndex(key, options) {
      events.push({ action: "create", name: options.name });
      if (failCreate) throw new Error("simulated index creation failure");
      if (!indexes.some((index) => index.name === options.name)) {
        indexes.push({ ...structuredClone(options), name: options.name, key: structuredClone(key) });
      }
    },
    async dropIndex(name) {
      events.push({ action: "drop", name });
      const index = indexes.findIndex((item) => item.name === name);
      if (index < 0) throw new Error("index not found");
      indexes.splice(index, 1);
    }
  };
  return {
    db: { collection: () => collection },
    indexes,
    documents,
    events,
    pipelines
  };
}

test("preflight reports actual indexes and new-index duplicate groups without writes", async () => {
  const fixture = createDatabase({
    duplicates: { nonWalletDrafts: 2, walletServiceDrafts: 1, legacyUserTypeRule: 3 }
  });
  const report = await inspectDraftIndexes(fixture.db);

  assert.deepEqual(report.legacyIndexes.map(({ name }) => name), ["userId_1_type_1"]);
  assert.deepEqual(report.desiredIndexes.map(({ expected }) => expected.name), [
    "one_incomplete_non_wallet_draft_per_user_type",
    "one_incomplete_wallet_service_draft_per_service"
  ]);
  assert.deepEqual(report.duplicateGroups, {
    nonWalletDrafts: 2,
    walletServiceDrafts: 1,
    legacyUserTypeRule: 3
  });
  assert.deepEqual(report.walletServiceIdAnomalies, { missing: 0, nonObjectId: 0 });
  const serviceDuplicateMatch = fixture.pipelines.find((pipeline) =>
    Object.keys(pipeline[1].$group._id).join(",") === "userId,type,serviceId"
  )[0].$match;
  assert.deepEqual(serviceDuplicateMatch.$expr, {
    $eq: [{ $type: "$serviceId" }, "objectId"]
  });
  assert.equal(serviceDuplicateMatch.payload, undefined);
  assert.equal(fixture.events.some(({ action }) => ["create", "drop"].includes(action)), false);
});

test("preflight detects missing and non-ObjectId root serviceId values and blocks apply", async () => {
  const fixture = createDatabase({
    serviceIdTypes: [
      { type: "missing", count: 2 },
      { type: "string", count: 1 },
      { type: "null", count: 1 },
      { type: "objectId", count: 20 }
    ]
  });
  const report = await inspectDraftIndexes(fixture.db);

  assert.deepEqual(report.walletServiceIdAnomalies, { missing: 2, nonObjectId: 2 });
  assert.equal(report.ready, false);
  assert.equal(fixture.events.some(({ action }) => ["create", "drop"].includes(action)), false);
  await assert.rejects(applyDraftIndexMigration(fixture.db), /serviceId values/);
  assert.equal(fixture.events.some(({ action }) => action === "drop"), false);
});

test("all effective index options must match the requested specification", async () => {
  const [specification] = expectedIndexes;
  for (const extraOption of [
    { collation: { locale: "en", strength: 2 } },
    { sparse: true },
    { expireAfterSeconds: 60 },
    { hidden: true }
  ]) {
    const conflictingIndex = {
      name: specification.options.name,
      key: structuredClone(specification.key),
      ...structuredClone(specification.options),
      ...extraOption
    };
    const fixture = createDatabase({ indexes: [legacyIndex(), conflictingIndex] });
    const report = await inspectDraftIndexes(fixture.db);
    const desired = report.desiredIndexes.find(({ expected }) =>
      expected.name === specification.options.name
    );

    assert.equal(desired.matches, false);
    assert.equal(report.ready, false);
    await assert.rejects(applyDraftIndexMigration(fixture.db), /unexpected specification/);
    assert.equal(fixture.events.some(({ action }) => action === "drop"), false);
  }
});

test("compound index key order is significant", async () => {
  const [specification] = expectedIndexes;
  const reversedIndex = {
    name: specification.options.name,
    key: { type: 1, userId: 1, serviceId: 1 },
    ...structuredClone(specification.options)
  };
  const fixture = createDatabase({ indexes: [legacyIndex(), reversedIndex] });
  const report = await inspectDraftIndexes(fixture.db);

  assert.equal(report.desiredIndexes[0].matches, false);
  assert.equal(report.ready, false);
});

test("migration creates and verifies new indexes before removing the detected legacy index", async () => {
  const fixture = createDatabase();
  const result = await applyDraftIndexMigration(fixture.db);

  const legacyDropPosition = fixture.events.findIndex(({ action }) => action === "drop");
  assert.equal(fixture.events[legacyDropPosition].name, "userId_1_type_1");
  assert.equal(fixture.events[legacyDropPosition - 1].action, "verify");
  assert.ok(fixture.events.slice(0, legacyDropPosition).some(({ action }) => action === "create"));
  assert.deepEqual(result.removedLegacyIndexes, ["userId_1_type_1"]);
  assert.equal(fixture.documents.length, 4);
  assert.equal(fixture.documents.find(({ _id }) => _id === "completed-draft").status, "completed");
  assert.equal(fixture.documents.find(({ _id }) => _id === "awaiting-payment-order").status, "AWAITING_PAYMENT");
  assert.equal(fixture.documents.find(({ _id }) => _id === "payment-review-order").status, "PAYMENT_REVIEW");
});

test("failed index creation preserves the legacy index", async () => {
  const fixture = createDatabase({ failCreate: true });

  await assert.rejects(applyDraftIndexMigration(fixture.db), /simulated index creation failure/);
  assert.ok(fixture.indexes.some(({ name }) => name === "userId_1_type_1"));
  assert.equal(fixture.events.some(({ action }) => action === "drop"), false);
});

test("rerunning a completed migration makes no index changes", async () => {
  const fixture = createDatabase();
  await applyDraftIndexMigration(fixture.db);
  fixture.events.length = 0;

  const result = await applyDraftIndexMigration(fixture.db);

  assert.deepEqual(result.removedLegacyIndexes, []);
  assert.equal(fixture.events.some(({ action }) => ["create", "drop"].includes(action)), false);
});

test("rollback refuses legacy duplicates and otherwise restores the old index first", async () => {
  const indexFixtures = expectedIndexes.map(({ key, options }) => ({
      name: options.name,
      key,
      unique: options.unique,
      partialFilterExpression: options.partialFilterExpression
    }));
  const conflict = createDatabase({
    indexes: indexFixtures.map((index) => structuredClone(index)),
    duplicates: { legacyUserTypeRule: 1 }
  });
  await assert.rejects(rollbackDraftIndexMigration(conflict.db), /conflict with the legacy unique rule/);
  assert.equal(conflict.events.some(({ action }) => ["create", "drop"].includes(action)), false);

  const fixture = createDatabase({
    indexes: indexFixtures.map((index) => structuredClone(index))
  });
  const result = await rollbackDraftIndexMigration(fixture.db);

  const firstWrite = fixture.events.findIndex(({ action }) => action === "create");
  assert.equal(fixture.events[firstWrite].name, "userId_1_type_1");
  const firstDrop = fixture.events.findIndex(({ action }) => action === "drop");
  assert.equal(fixture.events[firstDrop - 1].action, "verify");
  assert.ok(fixture.events.slice(firstDrop).every(({ action }) => ["drop", "verify"].includes(action)));
  assert.equal(result.restoredLegacyIndex, "userId_1_type_1");
});
