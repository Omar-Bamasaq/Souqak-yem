import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import AuthSession from "../models/AuthSession.js";
import StorePwaHandoff from "../models/StorePwaHandoff.js";

export async function runAuthSessionIndexMigration({
  env = process.env,
  connect = (uri, options) => mongoose.connect(uri, options),
  disconnect = () => mongoose.disconnect(),
  getDatabaseName = () => mongoose.connection.name,
  models = [AuthSession, StorePwaHandoff]
} = {}) {
  if (env.AUTH_SESSION_INDEXES_APPROVED !== "YES") {
    throw new Error("AUTH_SESSION_INDEXES_APPROVED=YES is required to create auth session indexes.");
  }
  const uri = String(env.AUTH_SESSION_INDEXES_MONGODB_URI || "").trim();
  const databaseName = String(env.AUTH_SESSION_INDEXES_DATABASE || "").trim();
  if (!uri || !databaseName) {
    throw new Error("AUTH_SESSION_INDEXES_MONGODB_URI and AUTH_SESSION_INDEXES_DATABASE are required.");
  }

  let parsedUri;
  try {
    parsedUri = new URL(uri);
  } catch {
    throw new Error("AUTH_SESSION_INDEXES_MONGODB_URI is invalid.");
  }
  if (!["mongodb:", "mongodb+srv:"].includes(parsedUri.protocol)) {
    throw new Error("Auth session index migration requires a MongoDB URI.");
  }
  const uriDatabase = decodeURIComponent(parsedUri.pathname.replace(/^\/|\/$/g, ""));
  if (uriDatabase && uriDatabase !== databaseName) {
    throw new Error("AUTH_SESSION_INDEXES_DATABASE must match the database name in the URI.");
  }

  let connected = false;
  try {
    await connect(uri, { dbName: databaseName, autoIndex: false });
    connected = true;
    if (getDatabaseName() !== databaseName) {
      throw new Error("Connected database does not match AUTH_SESSION_INDEXES_DATABASE.");
    }
    for (const model of models) {
      await model.createIndexes();
    }
    return { databaseName, models: models.map((model) => model.modelName) };
  } finally {
    if (connected) await disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  runAuthSessionIndexMigration()
    .then(({ databaseName, models }) => {
      console.log(`Created auth session indexes for ${models.join(", ")} in ${databaseName}.`);
    })
    .catch((error) => {
      console.error("Auth session index migration failed:", error.message);
      process.exitCode = 1;
    });
}
