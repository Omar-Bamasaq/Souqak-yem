import { randomUUID } from "node:crypto";

const TEST_DATABASE_TEMPLATE = "souqak_referral_test";
const TEST_DATABASE_PATTERN = /^souqak_referral_test_[0-9]+_[a-f0-9]{32}$/;
const MARKER_COLLECTION = "_souqak_referral_test_runs";
const ALLOWED_LOOPBACKS = new Set(["127.0.0.1", "localhost", "::1"]);
const issuedTargets = new WeakSet();

function normalizedHostname(hostname) {
  return String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "");
}

function isAllowedLoopback(hostname) {
  return ALLOWED_LOOPBACKS.has(normalizedHostname(hostname));
}

function isLoopbackReplicaMember(member) {
  if (typeof member !== "string" || !member.trim()) return false;
  try {
    const url = new URL(`mongodb://${member}`);
    return isAllowedLoopback(url.hostname) &&
      !url.username &&
      !url.password &&
      (url.pathname === "" || url.pathname === "/") &&
      !url.search &&
      !url.hash;
  } catch {
    return false;
  }
}

export function createReferralTestTarget(
  env = process.env,
  { pid = process.pid, runId = randomUUID().replace(/-/g, "") } = {}
) {
  if (env.RUN_REFERRAL_MONGO_INTEGRATION !== "YES") return null;
  if (env.REFERRAL_TEST_ISOLATED_ENV !== "YES") {
    throw new Error(
      "Referral integration requires an explicitly isolated test environment without SSH tunnels or production routes."
    );
  }

  const rawUri = typeof env.REFERRAL_TEST_MONGO_URI === "string"
    ? env.REFERRAL_TEST_MONGO_URI.trim()
    : "";
  if (!rawUri) {
    throw new Error("REFERRAL_TEST_MONGO_URI is required when the integration test is enabled.");
  }
  if (/^mongodb\+srv:/i.test(rawUri)) {
    throw new Error("SRV MongoDB URIs are not allowed for Referral integration tests.");
  }
  if (!/^mongodb:\/\//i.test(rawUri)) {
    throw new Error("Referral integration requires a mongodb:// URI.");
  }

  const authority = rawUri.slice(rawUri.indexOf("://") + 3).split(/[/?#]/, 1)[0];
  const hostList = authority.slice(authority.lastIndexOf("@") + 1);
  if (hostList.includes(",")) {
    throw new Error("MongoDB host lists are not allowed for Referral integration tests.");
  }

  let uri;
  try {
    uri = new URL(rawUri);
  } catch {
    throw new Error("REFERRAL_TEST_MONGO_URI is invalid.");
  }
  if (!isAllowedLoopback(uri.hostname)) {
    throw new Error("Referral integration MongoDB host must be an explicitly allowed loopback address.");
  }
  if (uri.hash || decodeURIComponent(uri.pathname.slice(1)) !== TEST_DATABASE_TEMPLATE) {
    throw new Error(`Referral integration URI must target the ${TEST_DATABASE_TEMPLATE} test template.`);
  }

  const configuredReplicaSet = uri.searchParams.get("replicaSet");
  if (configuredReplicaSet && configuredReplicaSet !== "rs0") {
    throw new Error("Referral integration only accepts the isolated rs0 replica set.");
  }
  if (uri.searchParams.get("loadBalanced") === "true") {
    throw new Error("Load-balanced MongoDB URIs are not allowed for Referral integration tests.");
  }
  if (!Number.isSafeInteger(pid) || pid < 1 || !/^[a-f0-9]{32}$/.test(runId)) {
    throw new Error("Referral integration test identity is invalid.");
  }

  const databaseName = `${TEST_DATABASE_TEMPLATE}_${pid}_${runId}`;
  if (!TEST_DATABASE_PATTERN.test(databaseName)) {
    throw new Error("Generated Referral integration database name is invalid.");
  }
  uri.pathname = `/${databaseName}`;
  uri.searchParams.set("replicaSet", "rs0");
  uri.searchParams.set("directConnection", "true");
  uri.searchParams.set("readPreference", "primary");

  const target = Object.freeze({
    uri: uri.toString(),
    databaseName,
    runId
  });
  issuedTargets.add(target);
  return target;
}

function assertIssuedTarget(target) {
  if (!target || !issuedTargets.has(target) ||
    !TEST_DATABASE_PATTERN.test(target.databaseName) ||
    target.runId !== target.databaseName.split("_").slice(-1)[0]) {
    throw new Error("Referral integration target was not created by this test run.");
  }
}

export function assertReferralTestDatabaseIdentity(connection, target) {
  assertIssuedTarget(target);
  const actualNames = [
    connection?.name,
    connection?.db?.databaseName
  ];
  if (actualNames.some((name) => name !== target.databaseName)) {
    throw new Error("Connected MongoDB database does not match this Referral test run.");
  }
}

export async function assertLocalReferralReplicaSet(connection, target) {
  assertReferralTestDatabaseIdentity(connection, target);
  const hello = await connection.db.admin().command({ hello: 1 });
  const members = [
    hello.me,
    hello.primary,
    ...(Array.isArray(hello.hosts) ? hello.hosts : []),
    ...(Array.isArray(hello.passives) ? hello.passives : []),
    ...(Array.isArray(hello.arbiters) ? hello.arbiters : [])
  ].filter(Boolean);
  if (hello.setName !== "rs0" ||
    hello.isWritablePrimary !== true ||
    !members.length ||
    members.some((member) => !isLoopbackReplicaMember(member))) {
    throw new Error("Referral integration requires a writable, loopback-only rs0 replica set.");
  }
}

export async function markReferralTestDatabaseOwned(connection, target) {
  await assertLocalReferralReplicaSet(connection, target);
  const marker = {
    _id: target.runId,
    databaseName: target.databaseName
  };
  const result = await connection.db
    .collection(MARKER_COLLECTION)
    .insertOne(marker);
  if (result?.acknowledged !== true) {
    throw new Error("Could not establish ownership of the Referral test database.");
  }
}

export async function dropReferralTestDatabase(connection, target) {
  await assertLocalReferralReplicaSet(connection, target);
  const marker = await connection.db
    .collection(MARKER_COLLECTION)
    .findOne({ _id: target.runId });
  if (marker?._id !== target.runId ||
    marker?.databaseName !== target.databaseName) {
    throw new Error("Refusing to drop a MongoDB database not created by this Referral test run.");
  }
  await connection.dropDatabase();
}
