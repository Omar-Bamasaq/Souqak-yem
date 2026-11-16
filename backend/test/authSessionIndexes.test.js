import test from "node:test";
import assert from "node:assert/strict";
import { runAuthSessionIndexMigration } from "../src/scripts/authSessionIndexes.js";

test("auth session index migration requires explicit approval before connecting", async () => {
  let connectCalled = false;
  await assert.rejects(runAuthSessionIndexMigration({
    env: {},
    connect: async () => { connectCalled = true; }
  }), /AUTH_SESSION_INDEXES_APPROVED=YES/);
  assert.equal(connectCalled, false);
});

test("auth session index migration touches only the selected models and disconnects", async () => {
  const created = [];
  let disconnected = false;
  const result = await runAuthSessionIndexMigration({
    env: {
      AUTH_SESSION_INDEXES_APPROVED: "YES",
      AUTH_SESSION_INDEXES_MONGODB_URI: "mongodb://localhost:27017/souqak_test",
      AUTH_SESSION_INDEXES_DATABASE: "souqak_test"
    },
    connect: async (_uri, options) => {
      assert.equal(options.dbName, "souqak_test");
      assert.equal(options.autoIndex, false);
    },
    disconnect: async () => { disconnected = true; },
    getDatabaseName: () => "souqak_test",
    models: [
      { modelName: "AuthSession", async createIndexes() { created.push(this.modelName); } },
      { modelName: "StorePwaHandoff", async createIndexes() { created.push(this.modelName); } }
    ]
  });

  assert.deepEqual(result, {
    databaseName: "souqak_test",
    models: ["AuthSession", "StorePwaHandoff"]
  });
  assert.deepEqual(created, ["AuthSession", "StorePwaHandoff"]);
  assert.equal(disconnected, true);
});
