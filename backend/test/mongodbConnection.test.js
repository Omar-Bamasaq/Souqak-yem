import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/mongodb.js";

test("application MongoDB connection disables automatic index creation", async () => {
  const cache = globalThis.mongoose;
  const originalConnect = mongoose.connect;
  const previousUri = process.env.MONGODB_URI;
  let connectionOptions;

  cache.conn = null;
  cache.promise = null;
  process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/unit_test_only";
  mongoose.connect = async (_uri, options) => {
    connectionOptions = options;
    return { mocked: true };
  };

  try {
    await connectDB();
    assert.equal(connectionOptions.autoIndex, false);
  } finally {
    mongoose.connect = originalConnect;
    cache.conn = null;
    cache.promise = null;
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
  }
});
