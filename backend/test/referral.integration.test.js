import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import Wallet from "../src/models/Wallet.js";
import Transaction from "../src/models/Transaction.js";
import Withdrawal from "../src/models/Withdrawal.js";
import ReferralProfile from "../src/models/ReferralProfile.js";
import ReferralRelationship from "../src/models/ReferralRelationship.js";
import ReferralCommission from "../src/models/ReferralCommission.js";
import ReferralEngine from "../src/engines/ReferralEngine.js";
import { creditReferralReward, reserveReferralCommissions, reverseReferralCommission, createReferralWithdrawalFinancials } from "../src/services/referralService.js";
import { signAccessToken } from "../src/config/jwt.js";

const uri = process.env.REFERRAL_TEST_MONGO_URI;
const port = 5518;
const baseUrl = `http://127.0.0.1:${port}`;
const backendEntry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/index.js");

async function waitForServer(child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health/liveness`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  child.kill();
  throw new Error("Referral integration server did not start");
}

function authToken(user) {
  return signAccessToken({ id: String(user._id), role: user.role });
}

async function createUser(name, role = "user") {
  const user = await User.create({ name, email: `${name}@integration.test`, password: "hashed", role, isEmailVerified: true });
  await ReferralEngine.ensureProfile(user._id);
  return user;
}

async function visit(code) {
  const response = await fetch(`${baseUrl}/api/referrals/visit/${code}`);
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

async function claim(user, cookie, body = {}) {
  return fetch(`${baseUrl}/api/referrals/attribution/claim`, {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken(user)}`, Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function registerWithReferral(name, cookie) {
  return fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ name, email: `${name}@http-integration.test`, password: "ValidPassword123" })
  });
}

async function withdraw(user, amount) {
  return fetch(`${baseUrl}/api/referrals/withdrawals`, {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken(user)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount, currency: "YER", phoneNumber: "711234567", receiptType: "exchange_transfer", bankName: "Test Bank", accountName: "Test User" })
  });
}

async function financialSnapshot(user) {
  const wallet = await Wallet.findOne({ user }).lean();
  return {
    wallet: wallet?.balances || [],
    withdrawals: await Withdrawal.countDocuments({ user }),
    transactions: await Transaction.countDocuments({ user }),
    commissions: await ReferralCommission.countDocuments({ referrerUserId: user, status: "WITHDRAWAL_RESERVED" })
  };
}

test("Referral Engine integration on isolated Mongo Replica Set", { skip: !uri, timeout: 120000 }, async (t) => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  const child = spawn(process.execPath, [backendEntry], {
    cwd: os.tmpdir(),
    windowsHide: true,
    env: { ...process.env, MONGODB_URI: uri, PORT: String(port), FRONTEND_URL: "http://127.0.0.1:5173", NODE_ENV: "test" },
    stdio: "inherit"
  });
  try {
    await waitForServer(child);
    const ambassadorA = await createUser("integration-a");
    const ambassadorB = await createUser("integration-b");
    const referred = await createUser("integration-referred");
    const profileA = await ReferralProfile.findOne({ userId: ambassadorA._id });
    const profileB = await ReferralProfile.findOne({ userId: ambassadorB._id });

    const cookieA = await visit(profileA.referralCode);
    const cookieB = await visit(profileB.referralCode);
    const registeredResponse = await registerWithReferral("integration-http-registered", cookieB);
    assert.equal(registeredResponse.status, 201);
    const registeredBody = await registeredResponse.json();
    const registeredRelationship = await ReferralRelationship.findOne({ referredUserId: registeredBody.id });
    assert.equal(String(registeredRelationship.referrerUserId), String(ambassadorB._id));
    assert.equal(await ReferralProfile.countDocuments({ userId: registeredBody.id }), 1);
    const [claimOne, claimTwo] = await Promise.all([claim(referred, cookieB, { referrerUserId: String(ambassadorA._id) }), claim(referred, cookieB)]);
    assert.equal(claimOne.status, 410);
    assert.equal(claimTwo.status, 410);
    await ReferralEngine.claimAttribution(referred._id, profileB.referralCode);
    const relationship = await ReferralRelationship.findOne({ referredUserId: referred._id });
    assert.equal(String(relationship.referrerUserId), String(ambassadorB._id));
    assert.equal(await ReferralRelationship.countDocuments({ referredUserId: referred._id }), 1);
    assert.equal(await ReferralProfile.countDocuments({ userId: ambassadorA._id }), 1);
    assert.equal(await ReferralProfile.countDocuments({ userId: ambassadorB._id }), 1);

    const selfClaim = await claim(ambassadorA, cookieA, { referrerUserId: String(ambassadorB._id) });
    assert.equal(selfClaim.status, 410);
    assert.equal(await ReferralRelationship.countDocuments({ referredUserId: ambassadorA._id }), 0);

    const saleId = new mongoose.Types.ObjectId();
    const sale = await ReferralEngine.createCommission({ sourceType: "SALE", sourceId: saleId, referredUserId: referred._id, rewardType: "SALE", platformRevenueAmount: 1000, platformRevenueType: "SALE_COMMISSION", currency: "YER", rate: 10 });
    sale.pendingUntil = new Date(Date.now() - 1000);
    await sale.save();
    await creditReferralReward(sale);
    assert.equal((await ReferralCommission.find({ sourceId: saleId })).length, 1);
    assert.equal((await Transaction.find({ referralCommissionId: sale._id, type: "REFERRAL_REWARD" })).length, 1);
    assert.equal((await Wallet.findOne({ user: ambassadorB._id })).balances.find(item => item.currency === "YER").availableBalance, 100);
    await creditReferralReward(sale);
    assert.equal((await Transaction.find({ referralCommissionId: sale._id, type: "REFERRAL_REWARD" })).length, 1);

    const safeId = new mongoose.Types.ObjectId();
    const safe = await ReferralEngine.createCommission({ sourceType: "SAFE_PURCHASE", sourceId: safeId, referredUserId: referred._id, rewardType: "BUYER_PROTECTION", platformRevenueAmount: 3000, platformRevenueType: "BUYER_PROTECTION_FEE", currency: "YER", rate: 10 });
    assert.equal(safe.platformRevenueAmount, 3000);
    assert.equal(safe.commissionAmount, 300);
    assert.notEqual(safe.commissionAmount, 400);

    const promotionId = new mongoose.Types.ObjectId();
    const promotion = await ReferralEngine.createCommission({ sourceType: "PROMOTION", sourceId: promotionId, referredUserId: referred._id, rewardType: "PROMOTION", platformRevenueAmount: 10000, platformRevenueType: "FEATURED_PROMOTION", currency: "YER", rate: 10 });
    assert.equal(promotion.commissionAmount, 1000);

    const pendingId = new mongoose.Types.ObjectId();
    const pending = await ReferralEngine.createCommission({ sourceType: "SALE", sourceId: pendingId, referredUserId: referred._id, rewardType: "PENDING", platformRevenueAmount: 500, platformRevenueType: "SALE_COMMISSION", currency: "YER", rate: 10 });
    await reverseReferralCommission(pending._id, "test pending reversal");
    assert.equal((await ReferralCommission.findById(pending._id)).status, "CANCELLED");

    const availableId = new mongoose.Types.ObjectId();
    const available = await ReferralEngine.createCommission({ sourceType: "SALE", sourceId: availableId, referredUserId: referred._id, rewardType: "AVAILABLE", platformRevenueAmount: 500, platformRevenueType: "SALE_COMMISSION", currency: "YER", rate: 10 });
    available.pendingUntil = new Date(Date.now() - 1000);
    await available.save();
    await creditReferralReward(available);
    await reverseReferralCommission(available._id, "test available reversal");
    assert.equal((await ReferralCommission.findById(available._id)).status, "REVERSED");
    await reverseReferralCommission(sale._id, "isolate reserved withdrawal test");

    const reservedId = new mongoose.Types.ObjectId();
    const reserved = await ReferralEngine.createCommission({ sourceType: "SALE", sourceId: reservedId, referredUserId: referred._id, rewardType: "RESERVED", platformRevenueAmount: 500, platformRevenueType: "SALE_COMMISSION", currency: "YER", rate: 10 });
    reserved.pendingUntil = new Date(Date.now() - 1000);
    await reserved.save();
    await creditReferralReward(reserved);
    const reservedWallet = await Wallet.findOne({ user: ambassadorB._id });
    const reservedBalance = reservedWallet.balances.find(item => item.currency === "YER");
    reservedBalance.availableBalance -= reserved.commissionAmount;
    await reservedWallet.save();
    const withdrawal = await Withdrawal.create({ user: ambassadorB._id, amount: reserved.commissionAmount, currency: "YER", phoneNumber: "711234567", bankDetails: { bankName: "Test Bank", accountName: "Test User" } });
    await Transaction.create({ user: ambassadorB._id, type: "WITHDRAWAL", amount: -reserved.commissionAmount, currency: "YER", balanceType: "available", status: "PENDING", withdrawalId: withdrawal._id });
    await reserveReferralCommissions(ambassadorB._id, reserved.commissionAmount, "YER", withdrawal._id);
    await reverseReferralCommission(reserved._id, "test reserved reversal");
    assert.equal((await ReferralCommission.findById(reserved._id)).status, "REVERSED");
    assert.equal((await Withdrawal.findById(withdrawal._id)).status, "REJECTED");

    const paidId = new mongoose.Types.ObjectId();
    const paid = await ReferralEngine.createCommission({ sourceType: "SALE", sourceId: paidId, referredUserId: referred._id, rewardType: "PAID", platformRevenueAmount: 500, platformRevenueType: "SALE_COMMISSION", currency: "YER", rate: 10 });
    paid.status = "PAID";
    paid.transactionId = new mongoose.Types.ObjectId();
    await paid.save();
    await reverseReferralCommission(paid._id, "test paid reversal");
    const paidProfile = await ReferralProfile.findOne({ userId: ambassadorB._id });
    assert.ok(paidProfile.recoveryBalances.find(item => item.currency === "YER").amount >= 50);

    const failureId = new mongoose.Types.ObjectId();
    const failure = await ReferralEngine.createCommission({ sourceType: "SALE", sourceId: failureId, referredUserId: referred._id, rewardType: "FAILURE", platformRevenueAmount: 700, platformRevenueType: "SALE_COMMISSION", currency: "YER", rate: 10 });
    failure.pendingUntil = new Date(Date.now() - 1000);
    await failure.save();
    const originalCreate = Transaction.create;
    Transaction.create = async () => { throw new Error("injected transaction failure"); };
    await assert.rejects(() => creditReferralReward(failure));
    Transaction.create = originalCreate;
    assert.equal((await ReferralCommission.findById(failure._id)).status, "PENDING");

    const raceUser = await createUser("integration-race");
    const raceWallet = await Wallet.create({ user: raceUser._id, balances: [{ currency: "YER", availableBalance: 1500, pendingBalance: 0 }] });
    const raceToken = authToken(raceUser);
    const cookieOnlyWithdrawal = await fetch(`${baseUrl}/api/referrals/withdrawals`, {
      method: "POST",
      headers: { Cookie: `accessToken=${encodeURIComponent(raceToken)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 1000, currency: "YER", phoneNumber: "711234567", receiptType: "exchange_transfer", bankName: "Test Bank", accountName: "Test User" })
    });
    assert.equal(cookieOnlyWithdrawal.status, 401);
    const invalidBearerWithdrawal = await fetch(`${baseUrl}/api/referrals/withdrawals`, {
      method: "POST",
      headers: { Authorization: "Bearer invalid", "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 1000, currency: "YER", phoneNumber: "711234567", receiptType: "exchange_transfer", bankName: "Test Bank", accountName: "Test User" })
    });
    assert.equal(invalidBearerWithdrawal.status, 401);
    const [withdrawOne, withdrawTwo] = await Promise.all([withdraw(raceUser, 1000), withdraw(raceUser, 1000)]);
    assert.equal([withdrawOne.status, withdrawTwo.status].filter(status => status === 201).length, 1);
    const finalRaceWallet = await Wallet.findOne({ user: raceUser._id });
    assert.equal(finalRaceWallet.balances.find(item => item.currency === "YER").availableBalance, 500);
    assert.equal(await Withdrawal.countDocuments({ user: raceUser._id, status: "PENDING" }), 1);

    const failurePoints = ["wallet", "withdrawal", "commission", "transaction"];
    for (const point of failurePoints) {
      const failureUser = await createUser(`integration-failure-${point}`);
      await Wallet.create({ user: failureUser._id, balances: [{ currency: "YER", availableBalance: 1500, pendingBalance: 0 }] });
      const failureCommission = await ReferralCommission.create({
        referrerUserId: failureUser._id,
        referredUserId: referred._id,
        relationshipId: relationship._id,
        sourceType: "SALE",
        sourceId: new mongoose.Types.ObjectId(),
        sourceEventId: `failure:${point}`,
        rewardType: "FAILURE_TEST",
        status: "AVAILABLE",
        platformRevenueAmount: 1000,
        platformRevenueType: "SALE_COMMISSION",
        referralRate: 10,
        commissionAmount: 100,
        currency: "YER",
        pendingUntil: new Date()
      });
      const before = await financialSnapshot(failureUser._id);
      const originalWalletUpdate = Wallet.findOneAndUpdate;
      const originalWithdrawalCreate = Withdrawal.create;
      const originalCommissionUpdate = ReferralCommission.findOneAndUpdate;
      const originalTransactionCreate = Transaction.create;
      try {
        if (point === "wallet") Wallet.findOneAndUpdate = async () => { throw new Error("injected wallet failure"); };
        if (point === "withdrawal") Withdrawal.create = async () => { throw new Error("injected withdrawal failure"); };
        if (point === "commission") ReferralCommission.findOneAndUpdate = async () => { throw new Error("injected commission failure"); };
        if (point === "transaction") Transaction.create = async () => { throw new Error("injected transaction failure"); };
        await assert.rejects(() => createReferralWithdrawalFinancials({
          userId: failureUser._id,
          amount: 1000,
          currency: "YER",
          phoneNumber: "711234567",
          bankDetails: { bankName: "Test Bank", accountName: "Test User" }
        }));
      } finally {
        Wallet.findOneAndUpdate = originalWalletUpdate;
        Withdrawal.create = originalWithdrawalCreate;
        ReferralCommission.findOneAndUpdate = originalCommissionUpdate;
        Transaction.create = originalTransactionCreate;
      }
      const after = await financialSnapshot(failureUser._id);
      assert.deepEqual(after, before, `rollback failed at ${point}`);
      assert.equal((await ReferralCommission.findById(failureCommission._id)).status, "AVAILABLE");
    }

    const reversalRaceUser = await createUser("integration-withdrawal-reversal-race");
    await Wallet.create({ user: reversalRaceUser._id, balances: [{ currency: "YER", availableBalance: 1500, pendingBalance: 0 }] });
    const reversalRaceCommission = await ReferralCommission.create({
      referrerUserId: reversalRaceUser._id,
      referredUserId: referred._id,
      relationshipId: relationship._id,
      sourceType: "SALE",
      sourceId: new mongoose.Types.ObjectId(),
      sourceEventId: "withdrawal-reversal-race",
      rewardType: "RACE_TEST",
      status: "AVAILABLE",
      platformRevenueAmount: 1000,
      platformRevenueType: "SALE_COMMISSION",
      referralRate: 10,
      commissionAmount: 100,
      currency: "YER",
      pendingUntil: new Date()
    });
    await Promise.allSettled([
      createReferralWithdrawalFinancials({ userId: reversalRaceUser._id, amount: 1000, currency: "YER", phoneNumber: "711234567", bankDetails: { bankName: "Test Bank", accountName: "Test User" } }),
      reverseReferralCommission(reversalRaceCommission._id, "withdrawal reversal race")
    ]);
    const raceResultWallet = await Wallet.findOne({ user: reversalRaceUser._id }).lean();
    const raceResultCommission = await ReferralCommission.findById(reversalRaceCommission._id).lean();
    assert.ok(raceResultWallet.balances.find(item => item.currency === "YER").availableBalance >= 0);
    assert.ok(["REVERSED", "WITHDRAWAL_RESERVED"].includes(raceResultCommission.status));
    assert.ok((await Withdrawal.countDocuments({ user: reversalRaceUser._id, status: { $in: ["PENDING", "REJECTED"] } })) <= 1);

    const regularResponse = await fetch(`${baseUrl}/api/admin/referrals/overview`, { headers: { Authorization: `Bearer ${authToken(referred)}` } });
    assert.equal(regularResponse.status, 403);
    const admin = await createUser("integration-admin", "admin");
    const adminCookieOnly = await fetch(`${baseUrl}/api/admin/referrals/overview`, { headers: { Cookie: `accessToken=${encodeURIComponent(authToken(admin))}` } });
    assert.equal(adminCookieOnly.status, 401);
    const adminInvalidBearer = await fetch(`${baseUrl}/api/admin/referrals/overview`, { headers: { Authorization: "Bearer invalid" } });
    assert.equal(adminInvalidBearer.status, 401);
    const adminResponse = await fetch(`${baseUrl}/api/admin/referrals/overview`, { headers: { Authorization: `Bearer ${authToken(admin)}` } });
    assert.equal(adminResponse.status, 200);
    const adminCommission = await ReferralEngine.createCommission({ sourceType: "SALE", sourceId: new mongoose.Types.ObjectId(), referredUserId: referred._id, rewardType: "ADMIN_TEST", platformRevenueAmount: 1000, platformRevenueType: "SALE_COMMISSION", currency: "YER", rate: 10 });
    adminCommission.status = "AVAILABLE";
    await adminCommission.save();
    const freezeCookieOnly = await fetch(`${baseUrl}/api/admin/referrals/commissions/${adminCommission._id}/freeze`, { method: "PATCH", headers: { Cookie: `accessToken=${encodeURIComponent(authToken(admin))}`, "Content-Type": "application/json" }, body: JSON.stringify({ reason: "test" }) });
    assert.equal(freezeCookieOnly.status, 401);
    const freezeAdmin = await fetch(`${baseUrl}/api/admin/referrals/commissions/${adminCommission._id}/freeze`, { method: "PATCH", headers: { Authorization: `Bearer ${authToken(admin)}`, "Content-Type": "application/json" }, body: JSON.stringify({ reason: "test" }) });
    assert.equal(freezeAdmin.status, 200);

    const indexes = {
      profile: await ReferralProfile.collection.listIndexes().toArray(),
      relationship: await ReferralRelationship.collection.listIndexes().toArray(),
      commission: await ReferralCommission.collection.listIndexes().toArray(),
      transaction: await Transaction.collection.listIndexes().toArray()
    };
    assert.ok(indexes.profile.some(index => index.unique && index.key.userId === 1));
    assert.ok(indexes.profile.some(index => index.unique && index.key.referralCode === 1));
    assert.ok(indexes.relationship.some(index => index.unique && index.key.referredUserId === 1));
    assert.ok(indexes.commission.some(index => index.unique && index.key.sourceType === 1 && index.key.sourceId === 1));
    assert.ok(indexes.transaction.some(index => index.unique && index.sparse && index.key.idempotencyKey === 1));

    await t.diagnostic("Integration scenarios passed on isolated Mongo Replica Set");
  } finally {
    child.kill();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
