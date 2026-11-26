import test from "node:test";
import assert from "node:assert/strict";
import {
  assertLocalReferralReplicaSet,
  assertReferralTestDatabaseIdentity,
  createReferralTestTarget,
  dropReferralTestDatabase,
  markReferralTestDatabaseOwned
} from "./helpers/referralMongoSafety.js";

const VALID_ENV = {
  RUN_REFERRAL_MONGO_INTEGRATION: "YES",
  REFERRAL_TEST_ISOLATED_ENV: "YES",
  REFERRAL_TEST_MONGO_URI: "mongodb://127.0.0.1:27017/souqak_referral_test"
};
const TEST_OPTIONS = { pid: 1234, runId: "a".repeat(32) };

function makeConnection(target, {
  databaseName = target.databaseName,
  marker = null,
  hello = {
    setName: "rs0",
    isWritablePrimary: true,
    me: "127.0.0.1:27017",
    primary: "localhost:27017",
    hosts: ["127.0.0.1:27017", "localhost:27017"]
  }
} = {}) {
  let insertedMarker = null;
  let dropCount = 0;
  const dropDatabase = async () => {
    dropCount += 1;
  };
  const connection = {
    name: databaseName,
    db: {
      databaseName,
      admin: () => ({ command: async () => hello }),
      collection: () => ({
        insertOne: async (value) => {
          insertedMarker = value;
          return { acknowledged: true };
        },
        findOne: async () => marker || insertedMarker
      })
    },
    dropDatabase
  };
  return {
    connection,
    get dropCount() { return dropCount; },
    get insertedMarker() { return insertedMarker; }
  };
}

test("Referral integration does not run without explicit opt-in", () => {
  assert.equal(createReferralTestTarget({
    REFERRAL_TEST_MONGO_URI: "not-a-uri"
  }), null);
});

test("Referral integration opt-in requires the isolated test environment and URI", () => {
  assert.throws(
    () => createReferralTestTarget({
      RUN_REFERRAL_MONGO_INTEGRATION: "YES",
      REFERRAL_TEST_MONGO_URI: VALID_ENV.REFERRAL_TEST_MONGO_URI
    }),
    /explicitly isolated test environment/
  );
  assert.throws(
    () => createReferralTestTarget({
      RUN_REFERRAL_MONGO_INTEGRATION: "YES",
      REFERRAL_TEST_ISOLATED_ENV: "YES"
    }),
    /REFERRAL_TEST_MONGO_URI is required/
  );
});

test("Referral target rejects invalid, external, SRV, mixed-host, and non-test URIs", () => {
  for (const [uri, expectedError] of [
    ["not-a-uri", /requires a mongodb:\/\//],
    ["mongodb://mongo.example.test:27017/souqak_referral_test", /loopback address/],
    ["mongodb+srv://cluster.example.test/souqak_referral_test", /SRV MongoDB URIs/],
    ["mongodb://127.0.0.1:27017,mongo.example.test:27017/souqak_referral_test", /host lists/],
    ["mongodb://127.0.0.1:27017/admin", /test template/]
  ]) {
    assert.throws(
      () => createReferralTestTarget({
        ...VALID_ENV,
        REFERRAL_TEST_MONGO_URI: uri
      }),
      expectedError
    );
  }
});

test("Referral target uses a generated unique database and a direct local replica connection", () => {
  const first = createReferralTestTarget(VALID_ENV, TEST_OPTIONS);
  const second = createReferralTestTarget(VALID_ENV, {
    ...TEST_OPTIONS,
    runId: "b".repeat(32)
  });
  const uri = new URL(first.uri);

  assert.match(first.databaseName, /^souqak_referral_test_1234_[a-f0-9]{32}$/);
  assert.notEqual(first.databaseName, "souqak_referral_test");
  assert.notEqual(first.databaseName, second.databaseName);
  assert.equal(uri.pathname, `/${first.databaseName}`);
  assert.equal(uri.hostname, "127.0.0.1");
  assert.equal(uri.searchParams.get("replicaSet"), "rs0");
  assert.equal(uri.searchParams.get("directConnection"), "true");
});

test("database identity and replica topology must be local before test writes", async () => {
  const target = createReferralTestTarget(VALID_ENV, TEST_OPTIONS);
  const mismatched = makeConnection(target, {
    databaseName: "souqak_referral_test_9999_" + "c".repeat(32)
  });
  assert.throws(
    () => assertReferralTestDatabaseIdentity(mismatched.connection, target),
    /does not match/
  );

  const externalTopology = makeConnection(target, {
    hello: {
      setName: "rs0",
      isWritablePrimary: true,
      me: "127.0.0.1:27017",
      hosts: ["127.0.0.1:27017", "prod-db.example.test:27017"]
    }
  });
  await assert.rejects(
    assertLocalReferralReplicaSet(externalTopology.connection, target),
    /loopback-only/
  );
});

test("database deletion requires this run's ownership marker and exact database identity", async () => {
  const target = createReferralTestTarget(VALID_ENV, TEST_OPTIONS);
  const notOwned = makeConnection(target);
  await assert.rejects(
    dropReferralTestDatabase(notOwned.connection, target),
    /not created by this Referral test run/
  );
  assert.equal(notOwned.dropCount, 0);

  const wrongDatabase = makeConnection(target, {
    databaseName: "souqak_referral_test_9999_" + "c".repeat(32),
    marker: { _id: target.runId, databaseName: target.databaseName }
  });
  await assert.rejects(
    dropReferralTestDatabase(wrongDatabase.connection, target),
    /does not match/
  );
  assert.equal(wrongDatabase.dropCount, 0);

  const owned = makeConnection(target);
  await markReferralTestDatabaseOwned(owned.connection, target);
  await dropReferralTestDatabase(owned.connection, target);
  assert.equal(owned.insertedMarker.databaseName, target.databaseName);
  assert.equal(owned.dropCount, 1);
});
