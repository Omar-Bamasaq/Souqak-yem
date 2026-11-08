import mongoose from "mongoose";

const DATABASE_NAME_PATTERN = /^souqak_prelaunch_[a-z0-9_]{1,46}$/;
const RESERVED_DATABASE_NAMES = new Set(["marketplace", "suqaq", "yemen_market", "yemen-market"]);
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function resolvePrelaunchTarget(env = process.env) {
  const uri = typeof env.PRELAUNCH_MONGODB_URI === "string"
    ? env.PRELAUNCH_MONGODB_URI.trim()
    : "";
  const databaseName = typeof env.PRELAUNCH_DATABASE_NAME === "string"
    ? env.PRELAUNCH_DATABASE_NAME.trim()
    : "";

  if (!uri) throw new Error("PRELAUNCH_MONGODB_URI is required.");
  if (!databaseName) throw new Error("PRELAUNCH_DATABASE_NAME is required.");
  if (!DATABASE_NAME_PATTERN.test(databaseName) || RESERVED_DATABASE_NAMES.has(databaseName)) {
    throw new Error("PRELAUNCH_DATABASE_NAME is not an approved prelaunch database name.");
  }

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error("PRELAUNCH_MONGODB_URI is invalid.");
  }

  if (parsed.protocol !== "mongodb:") {
    throw new Error("Prelaunch setup requires a direct local MongoDB URI.");
  }
  if (!LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("Prelaunch setup only permits a loopback MongoDB host.");
  }
  if (
    parsed.host.includes(",") ||
    parsed.searchParams.has("replicaSet") ||
    parsed.searchParams.get("directConnection") === "false" ||
    parsed.searchParams.has("loadBalanced")
  ) {
    throw new Error("Prelaunch setup requires a single direct MongoDB endpoint.");
  }
  if (!parsed.port || parsed.port === "27017") {
    throw new Error("Prelaunch setup requires an explicit non-default local MongoDB port.");
  }
  if (parsed.searchParams.has("dbName") || parsed.hash) {
    throw new Error("PRELAUNCH_MONGODB_URI contains unsupported target overrides.");
  }

  let uriDatabaseName;
  try {
    uriDatabaseName = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    throw new Error("PRELAUNCH_MONGODB_URI has an invalid database path.");
  }
  if (!uriDatabaseName || uriDatabaseName.includes("/") || uriDatabaseName !== databaseName) {
    throw new Error("MongoDB URI database path must exactly match PRELAUNCH_DATABASE_NAME.");
  }

  return { uri, databaseName };
}

export function requireReferenceDataApproval(env = process.env) {
  if (env.PRELAUNCH_REFERENCE_DATA_APPROVED !== "YES") {
    throw new Error("PRELAUNCH_REFERENCE_DATA_APPROVED=YES is required to seed reference data.");
  }
}

export function safeErrorSummary(error) {
  const knownNames = new Set([
    "Error",
    "TypeError",
    "ValidationError",
    "MongoServerSelectionError",
    "MongoNetworkError"
  ]);
  return {
    name: knownNames.has(error?.name) ? error.name : "Error",
    code: Number.isInteger(error?.code) ? error.code : undefined
  };
}

export async function connectPrelaunchDatabase(env = process.env) {
  const target = resolvePrelaunchTarget(env);
  await mongoose.connect(target.uri, {
    dbName: target.databaseName,
    directConnection: true,
    autoIndex: false,
    serverSelectionTimeoutMS: 5000,
    family: 4
  });
  return target;
}
