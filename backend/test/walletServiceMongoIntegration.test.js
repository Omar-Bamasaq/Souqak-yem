import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Order from "../src/models/Order.js";
import Wallet from "../src/models/Wallet.js";
import Transaction from "../src/models/Transaction.js";
import AdminEscrowLog from "../src/models/AdminEscrowLog.js";
import Dispute from "../src/models/Dispute.js";
import User from "../src/models/User.js";
import adminEscrowRouter from "../src/routes/adminEscrow.js";
import { addPendingBalance, releaseBalance } from "../src/services/walletService.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendDirectory = path.resolve(testDirectory, "..");
const envPath = path.join(backendDirectory, ".env.local");
const testSuffix = `${process.pid}_${Date.now()}`;
let databaseName = null;
let isolatedUri = null;
let connectionError = "backend/.env.local has no local MongoDB URI.";

if (fs.existsSync(envPath)) {
  const config = dotenv.parse(fs.readFileSync(envPath, "utf8"));
  try {
    const uri = new URL(config.MONGODB_URI);
    if (!["127.0.0.1", "localhost", "::1"].includes(uri.hostname)) {
      connectionError = "Refusing financial integration tests against a non-local database.";
    } else {
      databaseName = `souqak_financial_safety_test_${testSuffix}`;
      if (uri.username && !uri.searchParams.has("authSource")) {
        uri.searchParams.set("authSource", decodeURIComponent(uri.pathname.slice(1)));
      }
      uri.pathname = `/${databaseName}`;
      uri.searchParams.delete("directConnection");
      uri.searchParams.set("replicaSet", "rs0");
      isolatedUri = uri.toString();
    }
  } catch {
    connectionError = "The local MongoDB URI is invalid.";
  }
}

function routeHandler(routePath) {
  const layer = adminEscrowRouter.stack.find(
    (item) => item.route?.path === routePath && item.route.methods.patch
  );
  assert.ok(layer, `Expected PATCH ${routePath} to exist`);
  return layer.route.stack.at(-1).handle;
}

async function invokeRoute(handler, params, body = {}) {
  const result = { statusCode: 200, body: null };
  await handler(
    { params, body, user: { id: String(testUsers.admin._id) }, ip: "127.0.0.1", app: null },
    {
      status(code) { result.statusCode = code; return this; },
      json(value) { result.body = value; return this; }
    }
  );
  return result;
}

async function createOrder({
  status = "AWAITING_PAYMENT_CONFIRMATION",
  sellerAmount = 100,
  currency = "YER",
  shippingFee = 25,
  shippingCurrency = currency,
  shippedAt = null
} = {}) {
  return Order.create({
    buyer: testUsers.buyer._id,
    seller: testUsers.seller._id,
    orderType: "secure",
    status,
    amount: sellerAmount,
    totalAmount: sellerAmount + shippingFee,
    sellerAmount,
    currency,
    shippingFee,
    shippingCurrency,
    shippingPayer: "buyer",
    ...(shippedAt ? { shippingDetails: { shippedAt } } : {})
  });
}

let testUsers;

const integrationTest = test(
  "financial settlement flows use real MongoDB transactions in an isolated local replica-set database",
  { skip: isolatedUri ? false : connectionError },
  async (t) => {
    mongoose.set("autoIndex", false);
    try {
      await mongoose.connect(isolatedUri, { serverSelectionTimeoutMS: 5_000 });
      const adminDb = mongoose.connection.db.admin();
      const [hello, buildInfo] = await Promise.all([
        adminDb.command({ hello: 1 }),
        adminDb.command({ buildInfo: 1 })
      ]);
      assert.equal(hello.setName, "rs0", "local MongoDB must be a replica set");
      assert.equal(hello.isWritablePrimary, true, "local replica set must have a primary");
      assert.ok(
        (hello.hosts || []).every((host) => host.startsWith("127.0.0.1:") || host.startsWith("localhost:")),
        "all advertised replica-set members must be loopback addresses"
      );
      t.diagnostic(`Connected to isolated local MongoDB ${buildInfo.version} replica set ${hello.setName}.`);

      await Promise.all([
        User.init(),
        Order.init(),
        Wallet.init(),
        Transaction.init(),
        AdminEscrowLog.init(),
        Dispute.init()
      ]);
      await Transaction.createIndexes();

      const prefs = { order: { inApp: false, push: false } };
      const users = await User.create([
        {
          name: `Financial Test Admin ${testSuffix}`,
          email: `financial-admin-${testSuffix}@local.test`,
          password: "local-test-password",
          role: "admin",
          notificationPrefs: prefs
        },
        {
          name: `Financial Test Buyer ${testSuffix}`,
          email: `financial-buyer-${testSuffix}@local.test`,
          password: "local-test-password",
          notificationPrefs: prefs
        },
        {
          name: `Financial Test Seller ${testSuffix}`,
          email: `financial-seller-${testSuffix}@local.test`,
          password: "local-test-password",
          notificationPrefs: prefs
        }
      ]);
      [testUsers.admin, testUsers.buyer, testUsers.seller] = users;

      await t.test("concurrent payment confirmation commits product, shipping, and ledger once", async () => {
        const order = await createOrder();
        const handler = routeHandler("/orders/:id/confirm-payment");
        const results = await Promise.all([
          invokeRoute(handler, { id: String(order._id) }),
          invokeRoute(handler, { id: String(order._id) })
        ]);

        assert.deepEqual(results.map((result) => result.statusCode).sort(), [200, 400]);
        const persistedOrder = await Order.findById(order._id).lean();
        assert.equal(persistedOrder.status, "PAID_CONFIRMED");
        const wallet = await Wallet.findOne({ user: testUsers.seller._id }).lean();
        assert.deepEqual(wallet.balances.find((balance) => balance.currency === "YER").pendingBalance, 125);
        const entries = await Transaction.find({ order: order._id }).lean();
        assert.equal(entries.length, 2);
        assert.deepEqual(
          entries.map((entry) => entry.idempotencyKey).sort(),
          [`order-payment:${order._id}:PRODUCT`, `order-payment:${order._id}:SHIPPING`].sort()
        );
        assert.equal(await AdminEscrowLog.countDocuments({
          targetId: order._id,
          actionType: "CONFIRM_PAYMENT"
        }), 1);
      });

      await t.test("shipping ledger duplicate aborts the whole payment transaction", async () => {
        const order = await createOrder();
        const walletBefore = await Wallet.findOne({ user: testUsers.seller._id }).lean();
        await mongoose.connection.db.command({
          collMod: Transaction.collection.collectionName,
          validator: {
            idempotencyKey: {
              $not: new RegExp(`^order-payment:${order._id}:SHIPPING$`)
            }
          },
          validationLevel: "strict",
          validationAction: "error"
        });
        let result;
        try {
          result = await invokeRoute(routeHandler("/orders/:id/confirm-payment"), {
            id: String(order._id)
          });
        } finally {
          await mongoose.connection.db.command({
            collMod: Transaction.collection.collectionName,
            validator: {},
            validationLevel: "strict",
            validationAction: "error"
          });
        }
        assert.equal(result.statusCode, 500);
        assert.equal((await Order.findById(order._id).lean()).status, "AWAITING_PAYMENT_CONFIRMATION");
        assert.deepEqual(
          (await Wallet.findOne({ user: testUsers.seller._id }).lean()).balances,
          walletBefore.balances
        );
        assert.equal(await Transaction.countDocuments({ order: order._id }), 0);
        assert.equal(await AdminEscrowLog.countDocuments({ targetId: order._id }), 0);
      });

      await t.test("new currency credit persists a matching ledger entry", async () => {
        const order = await createOrder({ sellerAmount: 37, currency: "SAR", shippingFee: 0 });
        await addPendingBalance(
          testUsers.seller._id,
          37,
          "isolated integration credit",
          "SAR",
          order._id,
          { operationKey: "PRODUCT" }
        );

        const wallet = await Wallet.findOne({ user: testUsers.seller._id }).lean();
        assert.equal(wallet.balances.find((balance) => balance.currency === "SAR").pendingBalance, 37);
        assert.equal(await Transaction.countDocuments({
          order: order._id,
          currency: "SAR",
          amount: 37,
          balanceType: "pending"
        }), 1);
      });

      await t.test("concurrent release transfers funds once and insufficient pending funds do not mutate balances", async () => {
        const concurrentOrder = await createOrder({ sellerAmount: 50, shippingFee: 0 });
        await addPendingBalance(
          testUsers.seller._id,
          50,
          "isolated release seed",
          "YER",
          concurrentOrder._id,
          { operationKey: "PRODUCT" }
        );
        await Promise.all([
          releaseBalance(testUsers.seller._id, 50, concurrentOrder._id, "YER", "PRODUCT"),
          releaseBalance(testUsers.seller._id, 50, concurrentOrder._id, "YER", "PRODUCT")
        ]);

        const releasedWallet = await Wallet.findOne({ user: testUsers.seller._id }).lean();
        const yerBalance = releasedWallet.balances.find((balance) => balance.currency === "YER");
        assert.equal(yerBalance.pendingBalance, 125);
        assert.equal(yerBalance.availableBalance, 50);
        assert.equal(await Transaction.countDocuments({
          order: concurrentOrder._id,
          type: "RELEASE"
        }), 1);

        const insufficientOrder = await createOrder({ sellerAmount: 10, shippingFee: 0 });
        await addPendingBalance(
          testUsers.seller._id,
          5,
          "isolated insufficient seed",
          "USD",
          insufficientOrder._id,
          { operationKey: "PRODUCT" }
        );
        await assert.rejects(
          releaseBalance(testUsers.seller._id, 6, insufficientOrder._id, "USD", "PRODUCT"),
          /رصيد معلق غير كافٍ/
        );
        const usdWallet = await Wallet.findOne({ user: testUsers.seller._id }).lean();
        assert.equal(usdWallet.balances.find((balance) => balance.currency === "USD").pendingBalance, 5);
        assert.equal(await Transaction.countDocuments({
          order: insufficientOrder._id,
          type: "RELEASE"
        }), 0);
      });

      await t.test("failed dispute settlement keeps dispute, order, and wallet recoverable", async () => {
        const order = await createOrder({
          status: "DISPUTED",
          sellerAmount: 100,
          shippingFee: 25,
          currency: "USD",
          shippingCurrency: "USD"
        });
        const dispute = await Dispute.create({
          order: order._id,
          openedBy: testUsers.buyer._id,
          reason: "isolated transaction rollback test",
          status: "OPEN"
        });
        await addPendingBalance(
          testUsers.seller._id,
          100,
          "isolated dispute settlement seed",
          "USD",
          order._id,
          { operationKey: "PRODUCT" }
        );

        const result = await invokeRoute(
          routeHandler("/disputes/:id/resolve"),
          { id: String(dispute._id) },
          { resolution: "RELEASE_TO_SELLER", notes: "integration rollback test" }
        );
        assert.equal(result.statusCode, 500);
        assert.equal((await Dispute.findById(dispute._id).lean()).status, "OPEN");
        assert.equal((await Order.findById(order._id).lean()).status, "DISPUTED");
        const wallet = await Wallet.findOne({ user: testUsers.seller._id }).lean();
        assert.equal(wallet.balances.find((balance) => balance.currency === "USD").pendingBalance, 105);
        assert.equal(await Transaction.countDocuments({ order: order._id, type: "RELEASE" }), 0);
        assert.equal(await AdminEscrowLog.countDocuments({
          targetId: dispute._id,
          actionType: "RESOLVE_DISPUTE"
        }), 0);
      });

      await t.test("seven-day job releases eligible orders once and skips open disputes", async () => {
        const shippedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
        const eligibleOrder = await createOrder({
          status: "SHIPPED",
          sellerAmount: 80,
          shippingFee: 20,
          shippedAt
        });
        await addPendingBalance(
          testUsers.seller._id,
          80,
          "isolated automatic release product",
          "YER",
          eligibleOrder._id,
          { operationKey: "PRODUCT" }
        );
        await addPendingBalance(
          testUsers.seller._id,
          20,
          "isolated automatic release shipping",
          "YER",
          eligibleOrder._id,
          { operationKey: "SHIPPING" }
        );

        const disputedOrder = await createOrder({
          status: "SHIPPED",
          sellerAmount: 60,
          shippingFee: 0,
          shippedAt
        });
        await Dispute.create({
          order: disputedOrder._id,
          openedBy: testUsers.buyer._id,
          reason: "open dispute blocks automatic release",
          status: "OPEN"
        });
        await addPendingBalance(
          testUsers.seller._id,
          60,
          "isolated disputed automatic release seed",
          "YER",
          disputedOrder._id,
          { operationKey: "PRODUCT" }
        );

        const recentOrder = await createOrder({
          status: "SHIPPED",
          sellerAmount: 30,
          shippingFee: 0,
          shippedAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        });
        await addPendingBalance(
          testUsers.seller._id,
          30,
          "isolated recent shipment seed",
          "YER",
          recentOrder._id,
          { operationKey: "PRODUCT" }
        );

        const scriptPath = path.join(backendDirectory, "src", "scripts", "autoConfirmOrders.js");
        const runJob = () => spawnSync(process.execPath, [scriptPath], {
          cwd: backendDirectory,
          env: { ...process.env, MONGODB_URI: isolatedUri, NODE_ENV: "test" },
          encoding: "utf8",
          timeout: 30_000
        });
        const firstRun = runJob();
        assert.equal(firstRun.error, undefined, firstRun.error?.message);
        assert.equal(firstRun.status, 0, firstRun.stderr || firstRun.stdout);
        const secondRun = runJob();
        assert.equal(secondRun.error, undefined, secondRun.error?.message);
        assert.equal(secondRun.status, 0, secondRun.stderr || secondRun.stdout);

        assert.equal((await Order.findById(eligibleOrder._id).lean()).status, "DELIVERED");
        assert.equal((await Order.findById(disputedOrder._id).lean()).status, "SHIPPED");
        assert.equal((await Order.findById(recentOrder._id).lean()).status, "SHIPPED");
        assert.equal(await Transaction.countDocuments({
          order: eligibleOrder._id,
          type: "RELEASE"
        }), 2);
        assert.equal(await Transaction.countDocuments({
          order: disputedOrder._id,
          type: "RELEASE"
        }), 0);
        assert.equal(await Transaction.countDocuments({
          order: recentOrder._id,
          type: "RELEASE"
        }), 0);
      });
    } finally {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.db.dropDatabase();
        await mongoose.disconnect();
      }
    }
  }
);

test.before(() => {
  testUsers = {};
});

void integrationTest;
