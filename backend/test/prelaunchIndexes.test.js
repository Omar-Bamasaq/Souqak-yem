import test from "node:test";
import assert from "node:assert/strict";
import {
  applyIndexPlan,
  assertDatabaseHasNoDocuments,
  buildIndexPlan,
  loadApplicationModels,
  summarizeIndexPlan
} from "../src/scripts/prelaunchIndexes.js";
import { verifyIndexPlan } from "../src/scripts/prelaunchIndexVerification.js";

test("prelaunch index plan covers all application models without incompatible definitions", async () => {
  const models = await loadApplicationModels();
  const plan = buildIndexPlan(models);
  const summary = summarizeIndexPlan(plan);

  assert.equal(summary.models, 85);
  assert.equal(summary.collections, 85);
  assert.ok(summary.indexes > 0);
  assert.ok(summary.uniqueIndexes > 0);
  assert.ok(summary.compoundIndexes > 0);
  assert.ok(summary.specializedIndexes > 0);

  const notificationPlan = plan.find((item) => item.modelName === "Notification");
  const orderNotifications = notificationPlan.indexes.filter(({ keys }) =>
    JSON.stringify(keys) === JSON.stringify({ type: 1, relatedOrderId: 1 })
  );
  assert.equal(orderNotifications.length, 2);
  assert.deepEqual(
    orderNotifications.map(({ name }) => name).sort(),
    ["store_order_new_per_order_unique", "store_order_per_order_unique"]
  );
});

test("new-database index plan retains intended uniqueness and special options", async () => {
  const plan = buildIndexPlan(await loadApplicationModels());
  const user = plan.find((item) => item.modelName === "User");
  const draftActions = plan.find((item) => item.modelName === "DraftAction");
  const walletDraftIndex = draftActions.indexes.find(({ name }) =>
    name === "one_incomplete_wallet_service_draft_per_service"
  );
  const nonWalletDraftIndex = draftActions.indexes.find(({ name }) =>
    name === "one_incomplete_non_wallet_draft_per_user_type"
  );
  const userName = user.indexes.find(({ keys }) => JSON.stringify(keys) === JSON.stringify({ name: 1 }));
  const initialAdmin = user.indexes.find(({ keys }) =>
    JSON.stringify(keys) === JSON.stringify({ isInitialAdmin: 1 })
  );
  const settings = plan.find((item) => item.modelName === "SystemSettings");
  const singleton = settings.indexes.find(({ keys }) =>
    JSON.stringify(keys) === JSON.stringify({ singletonKey: 1 })
  );

  assert.equal(userName.options.unique, true);
  assert.deepEqual(userName.options.collation, { locale: "en", strength: 2 });
  assert.equal(initialAdmin.options.unique, true);
  assert.deepEqual(initialAdmin.options.partialFilterExpression, { isInitialAdmin: true });
  assert.equal(singleton.options.unique, true);
  assert.deepEqual(singleton.options.partialFilterExpression, {
    singletonKey: { $type: "string" }
  });
  assert.deepEqual(walletDraftIndex.keys, { userId: 1, type: 1, serviceId: 1 });
  assert.deepEqual(walletDraftIndex.options.partialFilterExpression, {
    status: "incomplete",
    type: "wallet_service_catalog",
    serviceId: { $type: "objectId" }
  });
  assert.deepEqual(nonWalletDraftIndex.options.partialFilterExpression, {
    status: "incomplete",
    type: { $in: ["store_creation", "family_production_registration", "featured_ad_upgrade"] }
  });
});

test("index preflight refuses a collection with documents", async () => {
  await assert.rejects(
    assertDatabaseHasNoDocuments({
      listCollections() {
        return {
          async toArray() {
            return [{ name: "users" }];
          }
        };
      },
      collection() {
        return {
          async countDocuments() {
            return 1;
          }
        };
      }
    }),
    /is not empty/
  );
});

test("index application sends the exact planned specs that verification compares", async () => {
  const plan = [{
    modelName: "Record",
    collectionName: "records",
    indexes: [{
      keys: { email: 1 },
      name: "email_unique_partial",
      options: {
        unique: true,
        partialFilterExpression: { email: { $type: "string" } },
        collation: { locale: "en", strength: 2 }
      }
    }]
  }];
  let createdSpecifications;
  const db = {
    listCollections() {
      return { toArray: async () => [{ name: "records" }] };
    },
    collection() {
      return {
        async countDocuments() {
          return 0;
        },
        async createIndexes(specifications) {
          createdSpecifications = specifications;
        },
        listIndexes() {
          return {
            toArray: async () => createdSpecifications.map(({ key, ...options }) => ({
              ...options,
              key
            }))
          };
        }
      };
    }
  };

  await applyIndexPlan(plan, db);
  assert.deepEqual(createdSpecifications, [{
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
    collation: { locale: "en", strength: 2 },
    key: { email: 1 },
    name: "email_unique_partial"
  }]);

  const verification = await verifyIndexPlan(plan, db);
  assert.equal(verification.success, true);
});

test("index plan incorporates schema-level collation and rejects unsupported Mongoose transforms", () => {
  const [collatedPlan] = buildIndexPlan([{
    modelName: "CollatedRecord",
    collection: { name: "collated_records" },
    schema: {
      options: { collation: { locale: "en", strength: 2 }, writeConcern: undefined },
      indexes: () => [[{ name: 1 }, {}]]
    },
    createIndexes() {}
  }]);
  assert.deepEqual(collatedPlan.indexes[0].options.collation, { locale: "en", strength: 2 });

  assert.throws(
    () => buildIndexPlan([{
      modelName: "ConcernedRecord",
      collection: { name: "concerned_records" },
      schema: {
        options: { writeConcern: { w: "majority" } },
        indexes: () => [[{ name: 1 }, {}]]
      },
      createIndexes() {}
    }]),
    /writeConcern.*not supported/
  );
});
