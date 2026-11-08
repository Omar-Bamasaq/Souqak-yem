import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import DraftAction from "../models/DraftAction.js";
import { safeErrorSummary } from "../lib/prelaunchDatabase.js";

const DATABASE_NAME = "suqaq";
const COLLECTION_NAME = DraftAction.collection.collectionName;
const OLD_INDEX_KEYS = { userId: 1, type: 1 };
const OLD_INDEX_PARTIAL_FILTER = { status: "incomplete" };
const WALLET_SERVICE_TYPES = ["wallet_service_catalog"];
const NON_WALLET_TYPES = [
  "store_creation",
  "family_production_registration",
  "featured_ad_upgrade"
];
const IGNORED_INDEX_METADATA = new Set(["ns", "v", "buildUUID", "background"]);

class DraftIndexMigrationError extends Error {}

function migrationError(message) {
  return new DraftIndexMigrationError(message);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function equal(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function equalKeyPattern(left, right) {
  return JSON.stringify(Object.entries(left || {})) === JSON.stringify(Object.entries(right || {}));
}

function desiredIndexes() {
  return DraftAction.schema.indexes()
    .filter(([, options = {}]) => [
      "one_incomplete_non_wallet_draft_per_user_type",
      "one_incomplete_wallet_service_draft_per_service"
    ].includes(options.name))
    .map(([key, options]) => ({ key, options }));
}

function isLegacyIndexCandidate(index) {
  return equalKeyPattern(index.key, OLD_INDEX_KEYS)
    && index.unique === true
    && equal(index.partialFilterExpression, OLD_INDEX_PARTIAL_FILTER);
}

function normalizeIndex(index, { includeName = true } = {}) {
  const normalized = {};
  if (includeName && index.name !== undefined) normalized.name = index.name;
  if (index.key !== undefined) normalized.key = Object.entries(index.key);
  for (const [option, value] of Object.entries(index)) {
    if (["name", "key", ...IGNORED_INDEX_METADATA].includes(option)) continue;
    if (value === undefined || (value === false && ["unique", "sparse", "hidden"].includes(option))) continue;
    normalized[option] = stable(value);
  }
  return stable(normalized);
}

function describeIndex(index) {
  return Object.fromEntries(
    Object.entries(index).filter(([key]) => !["ns", "v", "buildUUID"].includes(key))
  );
}

function expectedIndex(specification) {
  return normalizeIndex({
    name: specification.options.name,
    key: specification.key,
    ...specification.options
  });
}

function expectedLegacyIndex() {
  return normalizeIndex({
    key: OLD_INDEX_KEYS,
    unique: true,
    partialFilterExpression: OLD_INDEX_PARTIAL_FILTER
  }, { includeName: false });
}

function isLegacyIndex(index) {
  return isLegacyIndexCandidate(index)
    && equal(normalizeIndex(index, { includeName: false }), expectedLegacyIndex());
}

async function findDuplicateGroups(collection, filter, groupFields) {
  const _id = Object.fromEntries(groupFields.map((field) => [field, `$${field}`]));
  const duplicates = await collection.aggregate([
    { $match: filter },
    { $group: { _id, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "duplicateGroups" }
  ]).toArray();
  return duplicates[0]?.duplicateGroups || 0;
}

async function findWalletServiceIdAnomalies(collection) {
  const types = await collection.aggregate([
    {
      $match: {
        status: "incomplete",
        type: "wallet_service_catalog",
        $expr: { $ne: [{ $type: "$serviceId" }, "objectId"] }
      }
    },
    {
      $group: {
        _id: { $type: "$serviceId" },
        count: { $sum: 1 }
      }
    }
  ]).toArray();
  return types.reduce((counts, entry) => {
    if (entry._id === "missing") {
      counts.missing += entry.count;
    } else {
      counts.nonObjectId += entry.count;
    }
    return counts;
  }, { missing: 0, nonObjectId: 0 });
}

export async function inspectDraftIndexes(db) {
  const collection = db.collection(COLLECTION_NAME);
  const indexes = await collection.listIndexes().toArray();
  const desired = desiredIndexes();
  const legacyCandidates = indexes.filter(isLegacyIndexCandidate);
  const legacy = legacyCandidates.filter(isLegacyIndex);
  const desiredStates = desired.map((specification) => {
    const current = indexes.find((index) => index.name === specification.options.name) || null;
    return {
      expected: expectedIndex(specification),
      current: current ? normalizeIndex(current) : null,
      matches: Boolean(current && equal(normalizeIndex(current), expectedIndex(specification)))
    };
  });
  const duplicateGroups = {
    nonWalletDrafts: await findDuplicateGroups(
      collection,
      { status: "incomplete", type: { $in: NON_WALLET_TYPES } },
      ["userId", "type"]
    ),
    walletServiceDrafts: await findDuplicateGroups(
      collection,
      {
        status: "incomplete",
        type: { $in: WALLET_SERVICE_TYPES },
        $expr: { $eq: [{ $type: "$serviceId" }, "objectId"] }
      },
      ["userId", "type", "serviceId"]
    ),
    legacyUserTypeRule: await findDuplicateGroups(
      collection,
      { status: "incomplete" },
      ["userId", "type"]
    )
  };
  const walletServiceIdAnomalies = await findWalletServiceIdAnomalies(collection);
  const relevantKeyPatterns = [OLD_INDEX_KEYS, ...desired.map(({ key }) => key)];
  const conflictingIndexes = indexes.filter((index) =>
    relevantKeyPatterns.some((key) => equalKeyPattern(index.key, key))
    && !isLegacyIndex(index)
    && !desired.some((specification) =>
      index.name === specification.options.name
      && equal(normalizeIndex(index), expectedIndex(specification))
    )
  );
  const legacyIndexSpecConflicts = legacyCandidates.filter((index) => !isLegacyIndex(index));
  return {
    collectionName: COLLECTION_NAME,
    indexes: indexes.map(describeIndex),
    desiredIndexes: desiredStates,
    legacyIndexes: legacy.map(normalizeIndex),
    legacyIndexCandidates: legacyCandidates.map(describeIndex),
    legacyIndexSpecConflicts: legacyIndexSpecConflicts.map(describeIndex),
    conflictingIndexes: conflictingIndexes.map(describeIndex),
    duplicateGroups,
    walletServiceIdAnomalies,
    ready: duplicateGroups.nonWalletDrafts === 0
      && duplicateGroups.walletServiceDrafts === 0
      && walletServiceIdAnomalies.missing === 0
      && walletServiceIdAnomalies.nonObjectId === 0
      && desiredStates.every(({ current, matches }) => !current || matches)
      && conflictingIndexes.length === 0
      && legacyIndexSpecConflicts.length === 0
      && legacy.length <= 1
  };
}

function assertSafePreflight(report) {
  if (report.duplicateGroups.nonWalletDrafts > 0
    || report.duplicateGroups.walletServiceDrafts > 0) {
    throw migrationError("Duplicate incomplete drafts violate a required unique index; no index was changed.");
  }
  if (report.walletServiceIdAnomalies.missing > 0
    || report.walletServiceIdAnomalies.nonObjectId > 0) {
    throw migrationError("Incomplete wallet-service drafts have missing or non-ObjectId serviceId values; no index was changed.");
  }
  if (report.conflictingIndexes.length > 0) {
    throw migrationError("An index with a relevant key pattern has an unexpected specification; refusing to alter indexes.");
  }
  if (report.legacyIndexes.length > 1) {
    throw migrationError("Multiple legacy index candidates were found; refusing to choose one.");
  }
  if (report.legacyIndexSpecConflicts.length > 0) {
    throw migrationError("A legacy index candidate has additional or different options; refusing to alter indexes.");
  }
  if (report.desiredIndexes.some(({ current, matches }) => current && !matches)) {
    throw migrationError("A desired index name exists with a different specification; no index was changed.");
  }
}

async function verifyDesiredIndexes(collection, specifications) {
  const actual = await collection.listIndexes().toArray();
  for (const specification of specifications) {
    const found = actual.find((index) => index.name === specification.options.name);
    if (!found || !equal(normalizeIndex(found), expectedIndex(specification))) {
      throw migrationError(`Required index verification failed: ${specification.options.name}.`);
    }
  }
}

export async function applyDraftIndexMigration(db) {
  const report = await inspectDraftIndexes(db);
  assertSafePreflight(report);
  const collection = db.collection(COLLECTION_NAME);
  const specifications = desiredIndexes();

  for (const specification of specifications) {
    const current = report.desiredIndexes.find(({ expected }) =>
      expected.name === specification.options.name
    );
    if (!current?.matches) {
      await collection.createIndex(specification.key, specification.options);
    }
  }

  await verifyDesiredIndexes(collection, specifications);

  const refreshedIndexes = await collection.listIndexes().toArray();
  const legacyIndexes = refreshedIndexes.filter(isLegacyIndex);
  if (legacyIndexes.length > 1) {
    throw migrationError("Multiple legacy index candidates appeared during migration; none were dropped.");
  }
  if (legacyIndexes.length === 1) {
    await collection.dropIndex(legacyIndexes[0].name);
  }
  await verifyDesiredIndexes(collection, specifications);

  return {
    createdOrConfirmedIndexes: specifications.map(({ options }) => options.name),
    removedLegacyIndexes: legacyIndexes.map(({ name }) => name)
  };
}

export async function rollbackDraftIndexMigration(db) {
  const report = await inspectDraftIndexes(db);
  if (report.duplicateGroups.legacyUserTypeRule > 0) {
    throw migrationError("Current drafts conflict with the legacy unique rule; rollback cannot restore it safely.");
  }
  if (report.conflictingIndexes.length > 0 || report.legacyIndexes.length > 1) {
    throw migrationError("Unexpected index state; refusing to modify indexes during rollback.");
  }

  const collection = db.collection(COLLECTION_NAME);
  const legacySpecification = {
    ...OLD_INDEX_KEYS
  };
  const legacyOptions = {
    name: "userId_1_type_1",
    unique: true,
    partialFilterExpression: OLD_INDEX_PARTIAL_FILTER
  };
  const existingLegacy = report.legacyIndexes[0];
  if (!existingLegacy) await collection.createIndex(legacySpecification, legacyOptions);

  const afterCreate = await collection.listIndexes().toArray();
  const verifiedLegacy = afterCreate.find(isLegacyIndex);
  if (!verifiedLegacy) {
    throw new Error("Legacy index verification failed; newer indexes were retained.");
  }

  const desired = desiredIndexes();
  for (const specification of desired) {
    const current = afterCreate.find((index) =>
      index.name === specification.options.name
      && equal(normalizeIndex(index), expectedIndex(specification))
    );
    if (current) await collection.dropIndex(current.name);
  }
  return {
    restoredLegacyIndex: verifiedLegacy.name,
    removedNewIndexes: desired.map(({ options }) => options.name)
  };
}

function parseArguments(argv) {
  const actions = argv.filter((argument) => ["--apply", "--rollback"].includes(argument));
  if (actions.length > 1) throw migrationError("Choose either --apply or --rollback.");
  const unsupported = argv.filter((argument) =>
    !["--dry-run", "--apply", "--rollback", "--confirm-writes-paused"].includes(argument)
  );
  if (unsupported.length) throw migrationError("Unsupported command-line option.");
  return {
    mode: actions[0] === "--apply" ? "apply" : actions[0] === "--rollback" ? "rollback" : "dry-run",
    writesPaused: argv.includes("--confirm-writes-paused")
  };
}

function validateTarget(env, mode, writesPaused) {
  if (!env.DRAFT_INDEX_MIGRATION_URI) {
    throw migrationError("DRAFT_INDEX_MIGRATION_URI is required.");
  }
  if (env.DRAFT_INDEX_MIGRATION_DATABASE !== DATABASE_NAME) {
    throw migrationError("DRAFT_INDEX_MIGRATION_DATABASE must explicitly equal suqaq.");
  }
  if (mode !== "dry-run") {
    if (env.DRAFT_INDEX_MIGRATION_APPROVED !== "YES") {
      throw migrationError("DRAFT_INDEX_MIGRATION_APPROVED=YES is required for index changes.");
    }
    if (!writesPaused || env.DRAFT_ACTIONS_WRITES_PAUSED !== "YES") {
      throw migrationError("Pause draft writes and provide both write-pause confirmations.");
    }
  }
}

export async function run({ argv = process.argv.slice(2), env = process.env } = {}) {
  const { mode, writesPaused } = parseArguments(argv);
  validateTarget(env, mode, writesPaused);
  await mongoose.connect(env.DRAFT_INDEX_MIGRATION_URI, {
    autoIndex: false,
    serverSelectionTimeoutMS: 10000
  });
  try {
    const db = mongoose.connection.db;
    if (db.databaseName !== DATABASE_NAME) {
      throw migrationError("Connected database does not match the explicitly approved target.");
    }
    const hello = await db.admin().command({ hello: 1 });
    if (hello.setName !== "rs0") {
      throw migrationError("Target MongoDB must be the rs0 replica set.");
    }

    if (mode === "dry-run") {
      const report = await inspectDraftIndexes(db);
      console.log(JSON.stringify({ mode, ...report }, null, 2));
      return report;
    }
    const result = mode === "apply"
      ? await applyDraftIndexMigration(db)
      : await rollbackDraftIndexMigration(db);
    console.log(JSON.stringify({ mode, ...result }, null, 2));
    return result;
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  run().catch((error) => {
    console.error("Draft index migration failed.", error instanceof DraftIndexMigrationError
      ? error.message
      : safeErrorSummary(error));
    process.exitCode = 1;
  });
}
