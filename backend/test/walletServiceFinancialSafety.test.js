import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Order from "../src/models/Order.js";
import Wallet from "../src/models/Wallet.js";
import Transaction from "../src/models/Transaction.js";
import AdminEscrowLog from "../src/models/AdminEscrowLog.js";
import Ad from "../src/models/Ad.js";
import User from "../src/models/User.js";
import AdminNotification from "../src/models/AdminNotification.js";
import adminEscrowRouter from "../src/routes/adminEscrow.js";
import {
  addPendingBalance,
  releaseBalance,
  withFinancialTransaction
} from "../src/services/walletService.js";

const originalStartSession = mongoose.startSession;
const originalWalletFindOne = Wallet.findOne;
const originalWalletCreate = Wallet.create;
const originalTransactionFindOne = Transaction.findOne;
const originalTransactionCreate = Transaction.create;
const originalOrderFindOneAndUpdate = Order.findOneAndUpdate;
const originalEscrowLogCreate = AdminEscrowLog.create;
const originalAdFindByIdAndUpdate = Ad.findByIdAndUpdate;
const originalUserFindById = User.findById;
const originalUserFind = User.find;
const originalAdminNotificationCreate = AdminNotification.create;

const state = {
  wallets: new Map(),
  transactions: [],
  failDescription: null,
  failType: null,
  adminLogs: [],
  order: null,
  sequence: 0,
  transactionQueue: Promise.resolve()
};

function cloneWallets() {
  return new Map([...state.wallets].map(([key, wallet]) => [key, structuredClone(wallet)]));
}

function query(value) {
  return {
    session() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    }
  };
}

function walletDocument(data) {
  return {
    ...data,
    async save() {
      state.wallets.set(String(this.user), {
        _id: this._id,
        user: this.user,
        balances: structuredClone(this.balances)
      });
    }
  };
}

function installMocks() {
  Wallet.findOne = (filter) => {
    const wallet = state.wallets.get(String(filter.user));
    return query(wallet ? walletDocument(structuredClone(wallet)) : null);
  };
  Wallet.create = async (documents) => documents.map((data) => {
    const wallet = {
      _id: `wallet-${++state.sequence}`,
      user: data.user,
      balances: structuredClone(data.balances)
    };
    state.wallets.set(String(data.user), wallet);
    return walletDocument(structuredClone(wallet));
  });
  Transaction.findOne = (filter) => {
    if (filter.idempotencyKey) {
      return query(state.transactions.find((transaction) => (
        transaction.idempotencyKey === filter.idempotencyKey
      )) || null);
    }
    return query(state.transactions.find((transaction) => (
      transaction.user === filter.user
      && transaction.order === filter.order
      && transaction.type === filter.type
      && transaction.currency === filter.currency
      && !transaction.idempotencyKey
      && filter.description.$regex.test(transaction.description)
    )) || null);
  };
  Transaction.create = async (documents) => {
    const entries = documents.map((document) => ({ ...document }));
    if (
      (state.failDescription && entries.some((entry) => entry.description.includes(state.failDescription)))
      || (state.failType && entries.some((entry) => entry.type === state.failType))
    ) {
      throw new Error("simulated transaction-ledger write failure");
    }
    state.transactions.push(...entries);
    return entries;
  };
  mongoose.startSession = async () => ({
    async withTransaction(callback) {
      const previous = state.transactionQueue;
      let release;
      state.transactionQueue = new Promise((resolve) => { release = resolve; });
      await previous;
      const walletSnapshot = cloneWallets();
      const transactionSnapshot = structuredClone(state.transactions);
      const sequenceSnapshot = state.sequence;
      const orderSnapshot = state.order ? structuredClone(state.order) : null;
      const adminLogSnapshot = structuredClone(state.adminLogs);
      try {
        await callback(this);
      } catch (error) {
        state.wallets = walletSnapshot;
        state.transactions = transactionSnapshot;
        state.sequence = sequenceSnapshot;
        state.order = orderSnapshot;
        state.adminLogs = adminLogSnapshot;
        throw error;
      } finally {
        release();
      }
    },
    async endSession() {}
  });
  Order.findOneAndUpdate = async (filter, update) => {
    if (!state.order || String(filter._id) !== String(state.order._id)) return null;
    if (filter.status && state.order.status !== filter.status) return null;
    if (filter.orderType?.$ne === "store" && state.order.orderType === "store") return null;
    if (filter.storeProfileId === null && state.order.storeProfileId) return null;
    Object.assign(state.order, update.$set || update);
    return structuredClone(state.order);
  };
  AdminEscrowLog.create = async (documents) => {
    state.adminLogs.push(...documents.map((document) => ({ ...document })));
    return documents;
  };
  Ad.findByIdAndUpdate = async () => null;
  User.findById = () => ({
    select() { return this; },
    lean: async () => ({
      name: "test user",
      notificationPrefs: { order: { inApp: false, push: false } }
    })
  });
  User.find = () => ({
    select() { return this; },
    then(resolve, reject) { return Promise.resolve([]).then(resolve, reject); }
  });
  AdminNotification.create = async (document) => ({
    ...document,
    toObject() { return this; }
  });
}

function resetState() {
  state.wallets = new Map();
  state.transactions = [];
  state.failDescription = null;
  state.failType = null;
  state.adminLogs = [];
  state.order = null;
  state.sequence = 0;
  state.transactionQueue = Promise.resolve();
}

test.before(() => installMocks());
test.after(() => {
  mongoose.startSession = originalStartSession;
  Wallet.findOne = originalWalletFindOne;
  Wallet.create = originalWalletCreate;
  Transaction.findOne = originalTransactionFindOne;
  Transaction.create = originalTransactionCreate;
  Order.findOneAndUpdate = originalOrderFindOneAndUpdate;
  AdminEscrowLog.create = originalEscrowLogCreate;
  Ad.findByIdAndUpdate = originalAdFindByIdAndUpdate;
  User.findById = originalUserFindById;
  User.find = originalUserFind;
  AdminNotification.create = originalAdminNotificationCreate;
});

function routeHandler(routePath) {
  const layer = adminEscrowRouter.stack.find(
    (item) => item.route?.path === routePath && item.route.methods.patch
  );
  assert.ok(layer, `Expected PATCH ${routePath} to exist`);
  return layer.route.stack.at(-1).handle;
}

async function invokeAdminPaymentConfirmation() {
  const result = { statusCode: 200, body: null };
  await routeHandler("/orders/:id/confirm-payment")(
    { params: { id: state.order._id }, user: { id: "admin-1" }, ip: "127.0.0.1", app: null },
    {
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; }
    }
  );
  return result;
}

function preparePaymentOrder() {
  state.order = {
    _id: "order-confirm-1",
    orderType: "secure",
    storeProfileId: null,
    status: "AWAITING_PAYMENT_CONFIRMATION",
    seller: "seller-route",
    sellerAmount: 100,
    currency: "YER",
    shippingFee: 25,
    shippingPayer: "buyer",
    shippingCurrency: "YER",
    ad: "ad-1"
  };
}

test("adding pending funds in a new currency also writes the ledger entry", async () => {
  resetState();
  await addPendingBalance("seller-1", 125.5, "product pending", "SAR", "order-1", {
    operationKey: "PRODUCT"
  });

  assert.deepEqual(state.wallets.get("seller-1").balances, [{
    currency: "SAR",
    pendingBalance: 125.5,
    availableBalance: 0
  }]);
  assert.equal(state.transactions.length, 1);
  assert.equal(state.transactions[0].currency, "SAR");
  assert.equal(state.transactions[0].idempotencyKey, "order-payment:order-1:PRODUCT");
});

test("concurrent duplicate pending credits are applied once", async () => {
  resetState();
  await Promise.all([
    addPendingBalance("seller-1", 80, "product pending", "YER", "order-2", { operationKey: "PRODUCT" }),
    addPendingBalance("seller-1", 80, "product pending", "YER", "order-2", { operationKey: "PRODUCT" })
  ]);

  assert.equal(state.wallets.get("seller-1").balances[0].pendingBalance, 80);
  assert.equal(state.transactions.length, 1);
});

test("a shipping ledger failure rolls back the payment state, product credit, and all ledger entries", async () => {
  resetState();
  state.order = { status: "AWAITING_PAYMENT_CONFIRMATION" };
  state.failDescription = "shipping";

  await assert.rejects(
    withFinancialTransaction(async (session) => {
      state.order.status = "PAID_CONFIRMED";
      await addPendingBalance("seller-1", 100, "product", "YER", "order-3", {
        session,
        operationKey: "PRODUCT"
      });
      await addPendingBalance("seller-1", 20, "shipping", "YER", "order-3", {
        session,
        operationKey: "SHIPPING"
      });
    }),
    /simulated transaction-ledger write failure/
  );

  assert.equal(state.order.status, "AWAITING_PAYMENT_CONFIRMATION");
  assert.equal(state.wallets.size, 0);
  assert.equal(state.transactions.length, 0);
});

test("concurrent release retries transfer pending funds once", async () => {
  resetState();
  await addPendingBalance("seller-1", 90, "product", "YER", "order-4", {
    operationKey: "PRODUCT"
  });

  await Promise.all([
    releaseBalance("seller-1", 90, "order-4", "YER", "PRODUCT"),
    releaseBalance("seller-1", 90, "order-4", "YER", "PRODUCT")
  ]);

  const balance = state.wallets.get("seller-1").balances[0];
  assert.equal(balance.pendingBalance, 0);
  assert.equal(balance.availableBalance, 90);
  assert.equal(state.transactions.filter((transaction) => transaction.type === "RELEASE").length, 1);
});

test("release refuses an insufficient pending balance without changing wallet or ledger", async () => {
  resetState();
  await addPendingBalance("seller-1", 25, "product", "YER", "order-5", {
    operationKey: "PRODUCT"
  });
  const transactionsBefore = structuredClone(state.transactions);

  await assert.rejects(
    releaseBalance("seller-1", 26, "order-5", "YER", "PRODUCT"),
    /رصيد معلق غير كافٍ للتحرير/
  );

  assert.deepEqual(state.wallets.get("seller-1").balances[0], {
    currency: "YER",
    pendingBalance: 25,
    availableBalance: 0
  });
  assert.deepEqual(state.transactions, transactionsBefore);
});

test("a failed release ledger insert rolls back the pending-to-available move", async () => {
  resetState();
  await addPendingBalance("seller-1", 40, "product", "YER", "order-6", {
    operationKey: "PRODUCT"
  });
  state.failType = "RELEASE";

  await assert.rejects(
    releaseBalance("seller-1", 40, "order-6", "YER", "PRODUCT"),
    /simulated transaction-ledger write failure/
  );

  const balance = state.wallets.get("seller-1").balances[0];
  assert.equal(balance.pendingBalance, 40);
  assert.equal(balance.availableBalance, 0);
  assert.equal(state.transactions.filter((transaction) => transaction.type === "RELEASE").length, 0);
});

test("admin payment confirmation is single-winner under concurrent requests", async () => {
  resetState();
  preparePaymentOrder();

  const results = await Promise.all([
    invokeAdminPaymentConfirmation(),
    invokeAdminPaymentConfirmation()
  ]);

  assert.deepEqual(results.map((result) => result.statusCode).sort(), [200, 400]);
  assert.equal(state.order.status, "PAID_CONFIRMED");
  assert.equal(state.wallets.get("seller-route").balances[0].pendingBalance, 125);
  assert.equal(state.transactions.filter((transaction) => transaction.type === "ORDER_PAYMENT").length, 2);
  assert.equal(state.adminLogs.filter((entry) => entry.actionType === "CONFIRM_PAYMENT").length, 1);
});

test("admin confirmation failure on shipping credit rolls back the order and product credit", async () => {
  resetState();
  preparePaymentOrder();
  state.failDescription = "شحن";

  const result = await invokeAdminPaymentConfirmation();

  assert.equal(result.statusCode, 500);
  assert.equal(state.order.status, "AWAITING_PAYMENT_CONFIRMATION");
  assert.equal(state.wallets.size, 0);
  assert.equal(state.transactions.length, 0);
  assert.equal(state.adminLogs.length, 0);
});
