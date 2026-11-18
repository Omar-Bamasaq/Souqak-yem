import test from "node:test";
import assert from "node:assert/strict";
import {
  getWalletServiceCompletedOrderCount
} from "../src/services/walletServiceCompletionStats.js";

function createStatsModels(orders, settings, { beforeHistoricalCount } = {}) {
  let baselineWrites = 0;
  return {
    SettingsModel: {
      getSettings: async () => settings,
      findOneAndUpdate: async (filter, update) => {
        if (Number.isSafeInteger(settings.walletServiceCompletionBaseline?.historicalCompletedCount)
          || String(filter._id) !== String(settings._id)) return null;
        baselineWrites += 1;
        settings.walletServiceCompletionBaseline = update.$set.walletServiceCompletionBaseline;
        return settings;
      },
      get baselineWrites() { return baselineWrites; }
    },
    OrderModel: {
      countDocuments: async (query) => {
        const matchesQuery = () => orders.filter((order) => {
          if (order.status !== query.status) return false;
          if (query.completionCounted?.$ne === true) return order.completionCounted !== true;
          if (query.completionCounted === true) return order.completionCounted === true;
          return true;
        }).length;
        const count = matchesQuery();
        if (query.completionCounted?.$ne === true) await beforeHistoricalCount?.();
        return count;
      }
    }
  };
}

function completedOrder(completionCounted = false) {
  return {
    status: "COMPLETED",
    completionCounted,
    completedAt: new Date("2026-01-01T00:00:00.000Z")
  };
}

test("historical completions are included once and new completions count even with equal timestamps", async () => {
  const orders = [
    completedOrder(),
    completedOrder(),
    completedOrder(),
    { status: "IN_PROGRESS", completionCounted: false },
    { status: "REJECTED", completionCounted: false },
    { status: "AWAITING_PAYMENT", completionCounted: false }
  ];
  const settings = { _id: "global-settings" };
  const models = createStatsModels(orders, settings);
  const getCount = () => getWalletServiceCompletedOrderCount({
    ...models,
    now: () => new Date("2026-01-01T00:00:00.000Z")
  });

  assert.equal(await getCount(), 3);
  assert.equal(await getCount(), 3);
  assert.equal(settings.walletServiceCompletionBaseline.historicalCompletedCount, 3);

  orders.push(completedOrder(true));
  assert.equal(await getCount(), 4);
  assert.equal(await getCount(), 4);
});

test("the approved three-order baseline remains and excludes pending, rejected, and in-progress orders", async () => {
  const orders = [
    { status: "PAYMENT_REVIEW", completionCounted: false },
    { status: "IN_PROGRESS", completionCounted: false },
    { status: "REJECTED", completionCounted: false }
  ];
  const settings = { _id: "global-settings" };
  const models = createStatsModels(orders, settings);
  const getCount = () => getWalletServiceCompletedOrderCount(models);

  assert.equal(await getCount(), 3);
  assert.equal(await getCount(), 3);
  assert.equal(settings.walletServiceCompletionBaseline.initialCount, 3);

  orders.push(completedOrder(true));
  assert.equal(await getCount(), 4);
});

test("simultaneous initial reads persist one baseline and return the same completed total", async () => {
  const orders = [completedOrder(), completedOrder(), completedOrder()];
  const settings = { _id: "global-settings" };
  const models = createStatsModels(orders, settings);
  const getCount = () => getWalletServiceCompletedOrderCount(models);

  assert.deepEqual(await Promise.all([getCount(), getCount(), getCount()]), [3, 3, 3]);
  assert.equal(models.SettingsModel.baselineWrites, 1);
});

test("a completion concurrent with baseline initialization is counted separately", async () => {
  const orders = [completedOrder(), completedOrder(), completedOrder()];
  const settings = { _id: "global-settings" };
  let releaseHistoricalCount;
  let historicalCountStarted;
  const waitingForCount = new Promise((resolve) => { historicalCountStarted = resolve; });
  const countGate = new Promise((resolve) => { releaseHistoricalCount = resolve; });
  const models = createStatsModels(orders, settings, {
    beforeHistoricalCount: async () => {
      historicalCountStarted();
      await countGate;
    }
  });
  const pendingCount = getWalletServiceCompletedOrderCount({
    ...models,
    now: () => new Date("2026-01-01T00:00:00.000Z")
  });

  await waitingForCount;
  orders.push(completedOrder(true));
  releaseHistoricalCount();

  assert.equal(await pendingCount, 4);
  assert.equal(await getWalletServiceCompletedOrderCount(models), 4);
});

test("a persisted baseline and per-order completion markers survive service reinitialization", async () => {
  const orders = [completedOrder(), completedOrder(), completedOrder(), completedOrder(true)];
  const settings = {
    _id: "global-settings",
    walletServiceCompletionBaseline: {
      initialCount: 3,
      historicalCompletedCount: 3,
      initializedAt: new Date("2026-01-01T00:00:00.000Z")
    }
  };
  const models = createStatsModels(orders, settings);

  assert.equal(await getWalletServiceCompletedOrderCount(models), 4);
  assert.equal(await getWalletServiceCompletedOrderCount(models), 4);
  assert.equal(models.SettingsModel.baselineWrites, 0);
});
