import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { Long } from "bson";
import { verifyIndexPlan } from "../src/scripts/prelaunchIndexVerification.js";
import { runVerification } from "../src/scripts/prelaunchIndexesVerify.js";

const initialConnectionState = mongoose.connection.readyState;

function index(name, keys, options = {}) {
  return { name, keys, options };
}

function database(actualCollections) {
  return {
    listCollections() {
      return { toArray: async () => Object.keys(actualCollections).map((name) => ({ name })) };
    },
    collection(name) {
      return {
        listIndexes() {
          return { toArray: async () => actualCollections[name] };
        }
      };
    }
  };
}

function actualIndex(expected, overrides = {}) {
  return {
    name: expected.name,
    key: expected.keys,
    ...expected.options,
    ...overrides
  };
}

const basicExpected = index("name_1", { name: 1 }, { unique: true });
const basicPlan = [{ modelName: "Record", collectionName: "records", indexes: [basicExpected] }];
const implicitIdIndex = { name: "_id_", key: { _id: 1 }, unique: true };

test("verification module import does not connect to MongoDB", () => {
  assert.equal(mongoose.connection.readyState, initialConnectionState);
});

test("verification requires explicit approval before invoking the connection", async () => {
  let connectCalled = false;
  await assert.rejects(
    runVerification({
      env: {},
      connect: async () => {
        connectCalled = true;
      }
    }),
    /PRELAUNCH_INDEXES_VERIFY_APPROVED=YES/
  );
  assert.equal(connectCalled, false);
});

test("matching index plan succeeds and ignores MongoDB's implicit _id index", async () => {
  const result = await verifyIndexPlan(basicPlan, database({
    records: [implicitIdIndex, actualIndex(basicExpected)]
  }));

  assert.equal(result.success, true);
  assert.equal(result.status, "success");
  assert.deepEqual(result.missingIndexes, []);
  assert.deepEqual(result.unexpectedIndexes, []);
});

test("reports missing indexes and collections", async () => {
  const result = await verifyIndexPlan(basicPlan, database({}));

  assert.equal(result.success, false);
  assert.deepEqual(result.missingCollections, ["records"]);
  assert.deepEqual(result.missingIndexes, [{ collectionName: "records", indexName: "name_1" }]);
});

test("reports unexpected collections and indexes", async () => {
  const result = await verifyIndexPlan(basicPlan, database({
    records: [implicitIdIndex, actualIndex(basicExpected)],
    scratch: [implicitIdIndex, { name: "email_1", key: { email: 1 } }]
  }));

  assert.deepEqual(result.unexpectedCollections, ["scratch"]);
  assert.deepEqual(result.unexpectedIndexes, [{
    collectionName: "scratch",
    indexName: "email_1",
    keys: { email: { $numberInt: "1" } }
  }]);
});

test("index key order is significant", async () => {
  const expected = index("compound", { first: 1, second: -1 });
  const result = await verifyIndexPlan(
    [{ modelName: "Record", collectionName: "records", indexes: [expected] }],
    database({ records: [implicitIdIndex, { name: "compound", key: { second: -1, first: 1 } }] })
  );

  assert.deepEqual(result.mismatchedIndexes[0].mismatches.map(({ field }) => field), ["keys"]);
});

test("reports a unique option mismatch", async () => {
  const result = await verifyIndexPlan(basicPlan, database({
    records: [implicitIdIndex, { name: "name_1", key: { name: 1 } }]
  }));

  assert.deepEqual(result.mismatchedIndexes[0].mismatches.map(({ field }) => field), ["options"]);
});

test("compares partial filters with BSON types preserved", async () => {
  const expected = index("active_count", { count: 1 }, {
    partialFilterExpression: { count: Long.fromNumber(3) }
  });
  const result = await verifyIndexPlan(
    [{ modelName: "Record", collectionName: "records", indexes: [expected] }],
    database({
      records: [implicitIdIndex, {
        name: "active_count",
        key: { count: 1 },
        partialFilterExpression: { count: 3 }
      }]
    })
  );

  assert.deepEqual(result.mismatchedIndexes[0].mismatches.map(({ field }) => field), ["options"]);
});

test("compares TTL expiration values", async () => {
  const expected = index("expireAt_1", { expireAt: 1 }, { expireAfterSeconds: 3600 });
  const result = await verifyIndexPlan(
    [{ modelName: "Record", collectionName: "records", indexes: [expected] }],
    database({ records: [implicitIdIndex, actualIndex(expected, { expireAfterSeconds: 60 })] })
  );

  assert.deepEqual(result.mismatchedIndexes[0].mismatches.map(({ field }) => field), ["options"]);
});

test("compares text index weights and language settings", async () => {
  const expected = index("search_text", { title: "text", body: "text" }, {
    weights: { title: 10, body: 1 },
    default_language: "english",
    language_override: "language"
  });
  const result = await verifyIndexPlan(
    [{ modelName: "Record", collectionName: "records", indexes: [expected] }],
    database({
      records: [implicitIdIndex, actualIndex(expected, {
        weights: { title: 1, body: 10 },
        textIndexVersion: 3
      })]
    })
  );

  assert.deepEqual(result.mismatchedIndexes[0].mismatches.map(({ field }) => field), ["options"]);
});

test("matches MongoDB's internal text-index key representation and defaults", async () => {
  const expected = index("title_text_body_text", { title: "text", body: "text" });
  const result = await verifyIndexPlan(
    [{ modelName: "Record", collectionName: "records", indexes: [expected] }],
    database({
      records: [implicitIdIndex, {
        name: "title_text_body_text",
        key: { _fts: "text", _ftsx: 1 },
        weights: { title: 1, body: 1 },
        default_language: "english",
        language_override: "language",
        textIndexVersion: 3
      }]
    })
  );

  assert.equal(result.success, true);
});

test("normalizes documented collation defaults but detects collation differences", async () => {
  const expected = index("name_collated", { name: 1 }, {
    collation: { locale: "en", strength: 2 }
  });
  const plan = [{ modelName: "Record", collectionName: "records", indexes: [expected] }];
  const equivalentResult = await verifyIndexPlan(plan, database({
    records: [implicitIdIndex, actualIndex(expected, {
      collation: {
        locale: "en",
        strength: 2,
        caseLevel: false,
        caseFirst: "off",
        numericOrdering: false,
        alternate: "non-ignorable",
        maxVariable: "punct",
        normalization: false,
        backwards: false
      }
    })]
  }));
  const mismatchResult = await verifyIndexPlan(plan, database({
    records: [implicitIdIndex, actualIndex(expected, {
      collation: { locale: "en", strength: 1 }
    })]
  }));

  assert.equal(equivalentResult.success, true);
  assert.deepEqual(
    mismatchResult.mismatchedIndexes[0].mismatches.map(({ field }) => field),
    ["options"]
  );
});
