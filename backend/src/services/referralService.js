import mongoose from "mongoose";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import ReferralCommission from "../models/ReferralCommission.js";
import ReferralProfile from "../models/ReferralProfile.js";
import Withdrawal from "../models/Withdrawal.js";

const getBalance = (wallet, currency) => {
  let balance = wallet.balances.find(item => item.currency === currency);
  if (!balance) {
    wallet.balances.push({ currency, pendingBalance: 0, availableBalance: 0 });
    balance = wallet.balances[wallet.balances.length - 1];
  }
  return balance;
};

const addRecoveryBalance = async (userId, currency, amount) => {
  const profile = await ReferralProfile.findOne({ userId }) || await ReferralProfile.create({ userId, referralCode: `recovery-${userId}` });
  let recovery = profile.recoveryBalances.find(item => item.currency === currency);
  if (!recovery) {
    profile.recoveryBalances.push({ currency, amount });
  } else {
    recovery.amount += amount;
  }
  await profile.save();
};

async function withFinancialTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function getWalletInSession(userId, session) {
  return Wallet.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, balances: [] } },
    { new: true, upsert: true, session }
  );
}

function getBalanceInDocument(wallet, currency) {
  let balance = wallet.balances.find(item => item.currency === currency);
  if (!balance) {
    wallet.balances.push({ currency, pendingBalance: 0, availableBalance: 0 });
    balance = wallet.balances[wallet.balances.length - 1];
  }
  return balance;
}

export async function creditReferralReward(commission) {
  if (!commission || commission.status !== "PENDING" || commission.pendingUntil > new Date()) return commission;
  return withFinancialTransaction(async (session) => {
    const promoted = await ReferralCommission.findOneAndUpdate(
      { _id: commission._id, status: "PENDING", pendingUntil: { $lte: new Date() } },
      { $set: { status: "AVAILABLE", availableAt: new Date() } },
      { new: true, session }
    );
    if (!promoted) return ReferralCommission.findById(commission._id).session(session).lean();
    const wallet = await getWalletInSession(promoted.referrerUserId, session);
    const balance = getBalanceInDocument(wallet, promoted.currency);
    balance.availableBalance += promoted.commissionAmount;
    await wallet.save({ session });
    const transaction = await Transaction.create([{
      user: promoted.referrerUserId,
      type: "REFERRAL_REWARD",
      amount: promoted.commissionAmount,
      currency: promoted.currency,
      balanceType: "available",
      description: `مكافأة سفراء سوقك عن ${promoted.sourceType}`,
      status: "COMPLETED",
      referralCommissionId: promoted._id,
      sourceType: promoted.sourceType,
      sourceId: promoted.sourceId,
      idempotencyKey: `referral:${promoted._id}:credit`
    }], { session });
    return ReferralCommission.findOneAndUpdate(
      { _id: promoted._id, transactionId: null },
      { transactionId: transaction[0]._id },
      { new: true, session }
    );
  });
}

export async function reverseReferralCommission(commissionId, reason) {
  return withFinancialTransaction(async (session) => {
    const commission = await ReferralCommission.findById(commissionId).session(session);
    if (!commission || ["REVERSED", "CANCELLED"].includes(commission.status)) return commission;
    const reversalFields = { reversedAt: new Date(), reversalReason: reason };
    if (commission.status === "PENDING") {
      return ReferralCommission.findOneAndUpdate({ _id: commission._id, status: "PENDING" }, { $set: { status: "CANCELLED", ...reversalFields } }, { new: true, session });
    }
    if (commission.status === "PAID") {
      const updated = await ReferralCommission.findOneAndUpdate({ _id: commission._id, status: "PAID" }, { $set: { status: "REVERSED", ...reversalFields } }, { new: true, session });
      const profile = await ReferralProfile.findOneAndUpdate(
        { userId: commission.referrerUserId, "recoveryBalances.currency": commission.currency },
        { $inc: { "recoveryBalances.$.amount": commission.commissionAmount } },
        { new: true, session }
      );
      if (!profile) await ReferralProfile.findOneAndUpdate({ userId: commission.referrerUserId }, { $push: { recoveryBalances: { currency: commission.currency, amount: commission.commissionAmount } } }, { new: true, session });
      await Transaction.create([{
        user: commission.referrerUserId, type: "REFERRAL_REVERSAL", amount: -commission.commissionAmount, currency: commission.currency,
        balanceType: "available", description: `استرداد مستحق من مكافأة مسحوبة: ${reason}`, status: "COMPLETED", referralCommissionId: commission._id,
        sourceType: commission.sourceType, sourceId: commission.sourceId, reversalOf: commission.transactionId, idempotencyKey: `referral:${commission._id}:reverse`
      }], { session });
      return updated;
    }
    if (commission.status === "WITHDRAWAL_RESERVED") {
      const withdrawal = await Withdrawal.findOne({ _id: commission.withdrawalId, status: { $in: ["PENDING", "PROCESSING"] } }).session(session);
      if (!withdrawal) throw new Error("طلب السحب المرتبط غير قابل للإلغاء");
      await Withdrawal.updateOne({ _id: withdrawal._id, status: { $in: ["PENDING", "PROCESSING"] } }, { $set: { status: "REJECTED", processedAt: new Date(), adminNotes: reason } }, { session });
      const wallet = await getWalletInSession(commission.referrerUserId, session);
      const balance = getBalanceInDocument(wallet, withdrawal.currency);
      balance.availableBalance += withdrawal.amount;
      await wallet.save({ session });
      await Transaction.create([{
        user: withdrawal.user, type: "REFUND", amount: withdrawal.amount, currency: withdrawal.currency, balanceType: "available",
        description: `إعادة حجز سحب ملغى بسبب عكس مكافأة: ${reason}`, status: "COMPLETED", withdrawalId: withdrawal._id,
        idempotencyKey: `withdrawal:${withdrawal._id}:referral-reversal`
      }], { session });
      await ReferralCommission.updateMany({ withdrawalId: withdrawal._id, status: "WITHDRAWAL_RESERVED" }, { $set: { status: "AVAILABLE", withdrawalId: null } }, { session });
      const updated = await ReferralCommission.findOneAndUpdate({ _id: commission._id, status: "AVAILABLE" }, { $set: { status: "REVERSED", ...reversalFields, withdrawalId: null } }, { new: true, session });
      const updatedBalance = getBalanceInDocument(wallet, commission.currency);
      if (updatedBalance.availableBalance < commission.commissionAmount) throw new Error("الرصيد غير كافٍ لعكس العمولة المحجوزة");
      updatedBalance.availableBalance -= commission.commissionAmount;
      await wallet.save({ session });
      await Transaction.create([{
        user: commission.referrerUserId, type: "REFERRAL_REVERSAL", amount: -commission.commissionAmount, currency: commission.currency,
        balanceType: "available", description: `عكس مكافأة محجوزة للسحب: ${reason}`, status: "COMPLETED", referralCommissionId: commission._id,
        sourceType: commission.sourceType, sourceId: commission.sourceId, reversalOf: commission.transactionId, idempotencyKey: `referral:${commission._id}:reverse`
      }], { session });
      return updated;
    }
    const wallet = await getWalletInSession(commission.referrerUserId, session);
    const balance = getBalanceInDocument(wallet, commission.currency);
    if (balance.availableBalance < commission.commissionAmount) throw new Error("الرصيد غير كافٍ لعكس العمولة");
    balance.availableBalance -= commission.commissionAmount;
    await wallet.save({ session });
    const updated = await ReferralCommission.findOneAndUpdate({ _id: commission._id, status: commission.status }, { $set: { status: "REVERSED", ...reversalFields } }, { new: true, session });
    await Transaction.create([{
      user: commission.referrerUserId, type: "REFERRAL_REVERSAL", amount: -commission.commissionAmount, currency: commission.currency,
      balanceType: "available", description: `عكس مكافأة سفراء سوقك: ${reason}`, status: "COMPLETED", referralCommissionId: commission._id,
      sourceType: commission.sourceType, sourceId: commission.sourceId, reversalOf: commission.transactionId, idempotencyKey: `referral:${commission._id}:reverse`
    }], { session });
    return updated;
  });
}

export async function reserveReferralCommissions(userId, amount, currency, withdrawalId) {
  return withFinancialTransaction(async (session) => {
    const items = await ReferralCommission.find({ referrerUserId: userId, currency, status: "AVAILABLE" }).sort({ createdAt: 1 }).session(session);
    let remaining = Number(amount);
    const reserved = [];
    for (const item of items) {
      if (remaining <= 0) break;
      const updated = await ReferralCommission.findOneAndUpdate(
        { _id: item._id, status: "AVAILABLE" },
        { $set: { status: "WITHDRAWAL_RESERVED", withdrawalId } },
        { new: true, session }
      );
      if (updated) {
        reserved.push(updated);
        remaining -= updated.commissionAmount;
      }
    }
    await Transaction.updateMany(
      { user: userId, type: "WITHDRAWAL", status: "PENDING", amount: -Number(amount), withdrawalId: { $exists: false } },
      { $set: { withdrawalId } },
      { session }
    );
    return reserved;
  });
}

export async function settleReferralWithdrawal(withdrawalId, completed) {
  return withFinancialTransaction(async (session) => {
    const status = completed ? "PAID" : "AVAILABLE";
    await ReferralCommission.updateMany({ withdrawalId, status: "WITHDRAWAL_RESERVED" }, { $set: { status, ...(completed ? {} : { withdrawalId: null }) } }, { session });
    return status;
  });
}

export async function finalizeWithdrawalFinancials(withdrawalId, completed, details = {}) {
  return withFinancialTransaction(async (session) => {
    const withdrawal = await Withdrawal.findOne({
      _id: withdrawalId,
      status: completed ? "PROCESSING" : { $in: ["PENDING", "PROCESSING"] }
    }).session(session);
    if (!withdrawal) throw new Error("طلب السحب غير موجود أو تمت معالجته مسبقًا");

    if (completed) {
      withdrawal.status = "COMPLETED";
      withdrawal.transactionProof = details.transactionProof || withdrawal.transactionProof;
      withdrawal.adminNotes = details.adminNotes || withdrawal.adminNotes;
      withdrawal.processedAt = new Date();
      await withdrawal.save({ session });

      await Transaction.findOneAndUpdate(
        {
          user: withdrawal.user,
          type: "WITHDRAWAL",
          status: "PENDING",
          amount: -withdrawal.amount,
          $or: [{ withdrawalId: withdrawal._id }, { withdrawalId: { $exists: false } }]
        },
        { status: "FAILED", description: `تم استبدالها بمعاملة مكتملة لطلب #${withdrawal._id}` },
        { session }
      );
      await Transaction.create([{
        user: withdrawal.user,
        type: "WITHDRAWAL",
        amount: -withdrawal.finalAmount,
        currency: withdrawal.currency || "YER",
        balanceType: "available",
        description: `سحب رصيد مكتمل - طلب #${withdrawal._id}`,
        status: "COMPLETED",
        withdrawalId: withdrawal._id,
        idempotencyKey: `withdrawal:${withdrawal._id}:completed`
      }], { session });
      await ReferralCommission.updateMany({ withdrawalId: withdrawal._id, status: "WITHDRAWAL_RESERVED" }, { $set: { status: "PAID" } }, { session });
    } else {
      withdrawal.status = "REJECTED";
      withdrawal.adminNotes = details.adminNotes || withdrawal.adminNotes;
      withdrawal.processedAt = new Date();
      await withdrawal.save({ session });
      const wallet = await getWalletInSession(withdrawal.user, session);
      const balance = getBalanceInDocument(wallet, withdrawal.currency);
      balance.availableBalance += withdrawal.amount;
      await wallet.save({ session });
      await Transaction.create([{
        user: withdrawal.user,
        type: "REFUND",
        amount: withdrawal.amount,
        currency: withdrawal.currency || "YER",
        balanceType: "available",
        description: `إعادة رصيد لرفض طلب السحب #${withdrawal._id}`,
        status: "COMPLETED",
        withdrawalId: withdrawal._id,
        idempotencyKey: `withdrawal:${withdrawal._id}:rejected`
      }], { session });
      await Transaction.findOneAndUpdate(
        {
          user: withdrawal.user,
          type: "WITHDRAWAL",
          status: "PENDING",
          amount: -withdrawal.amount,
          $or: [{ withdrawalId: withdrawal._id }, { withdrawalId: { $exists: false } }]
        },
        { status: "FAILED", description: `تم رفض السحب: ${details.adminNotes || "بدون سبب"}` },
        { session }
      );
      await ReferralCommission.updateMany({ withdrawalId: withdrawal._id, status: "WITHDRAWAL_RESERVED" }, { $set: { status: "AVAILABLE", withdrawalId: null } }, { session });
    }
    return withdrawal;
  });
}

export async function createReferralWithdrawalFinancials({
  userId,
  amount,
  currency,
  phoneNumber,
  bankDetails
}) {
  return withFinancialTransaction(async (session) => {
    const profile = await ReferralProfile.findOne({ userId }).session(session);
    const recoveryAmount = profile?.recoveryBalances?.find(item => item.currency === currency)?.amount || 0;
    const frozen = await ReferralCommission.aggregate([
      { $match: { referrerUserId: userId, currency, status: "FROZEN" } },
      { $group: { _id: null, total: { $sum: "$commissionAmount" } } }
    ]).session(session);
    const frozenAmount = frozen[0]?.total || 0;

    const withdrawalId = new mongoose.Types.ObjectId();
    const wallet = await Wallet.findOneAndUpdate(
      {
        user: userId,
        "balances.currency": currency,
        "balances.availableBalance": { $gte: Number(amount) + frozenAmount + recoveryAmount }
      },
      { $inc: { "balances.$.availableBalance": -Number(amount) } },
      { new: true, session }
    );
    if (!wallet) throw new Error(`رصيد غير كافٍ أو محفظة غير موجودة للعملة ${currency}.`);

    const availableCommissions = await ReferralCommission.find({
      referrerUserId: userId,
      currency,
      status: "AVAILABLE"
    }).sort({ createdAt: 1 }).session(session);
    let commissionRemaining = Number(amount);
    const reservedCommissionIds = [];
    for (const commission of availableCommissions) {
      if (commissionRemaining <= 0) break;
      const reserved = await ReferralCommission.findOneAndUpdate(
        { _id: commission._id, status: "AVAILABLE" },
        { $set: { status: "WITHDRAWAL_RESERVED", withdrawalId } },
        { new: true, session }
      );
      if (reserved) {
        reservedCommissionIds.push(reserved._id);
        commissionRemaining -= reserved.commissionAmount;
      }
    }

    const withdrawal = await Withdrawal.create([{
      _id: withdrawalId,
      user: userId,
      amount: Number(amount),
      currency,
      phoneNumber,
      feeAmount: 0,
      finalAmount: Number(amount),
      bankDetails
    }], { session });
    const transaction = await Transaction.create([{
      user: userId,
      type: "WITHDRAWAL",
      amount: -Number(amount),
      currency,
      balanceType: "available",
      description: "طلب سحب من مكافآت سفراء سوقك",
      status: "PENDING",
      withdrawalId,
      idempotencyKey: `withdrawal:${withdrawalId}:requested`
    }], { session });

    return {
      withdrawal: withdrawal[0],
      transaction: transaction[0],
      reservedCommissionIds
    };
  });
}