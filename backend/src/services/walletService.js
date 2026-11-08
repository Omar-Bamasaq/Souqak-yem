import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import mongoose from "mongoose";

export async function withFinancialTransaction(work) {
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

async function inFinancialTransaction(session, work) {
  return session ? work(session) : withFinancialTransaction(work);
}

async function getWalletInSession(userId, session) {
  let wallet = await Wallet.findOne({ user: userId }).session(session);
  if (!wallet) {
    [wallet] = await Wallet.create([{ user: userId, balances: [] }], { session });
  }
  return wallet;
}

async function findTransactionByKey(idempotencyKey, session) {
  if (!idempotencyKey) return null;
  return Transaction.findOne({ idempotencyKey }).session(session);
}

/**
 * جلب أو إنشاء محفظة للمستخدم
 */
export const getOrCreateWallet = async (userId) => {
  if (!userId) throw new Error("userId is required to get or create a wallet.");
  
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = new Wallet({ user: userId, balances: [] });
    await wallet.save();
  } else if (!wallet.balances) {
    // Migration for old wallets
    wallet.balances = [];
    await wallet.save();
  }
  return wallet;
};

/**
 * دالة مساعدة للحصول على الرصيد الخاص بعملة معينة داخل المحفظة
 */
const getCurrencyBalance = (wallet, currency) => {
  let balance = wallet.balances.find(b => b.currency === currency);
  if (!balance) {
    balance = { currency, pendingBalance: 0, availableBalance: 0 };
    wallet.balances.push(balance);
    return wallet.balances[wallet.balances.length - 1];
  }
  return balance;
};

/**
 * إضافة رصيد معلق للبائع عند تأكيد الدفع من الإدارة
 */
export const addPendingBalance = async (
  userId,
  amount,
  description,
  currency = "YER",
  orderId = null,
  { session: existingSession, operationKey = "default" } = {}
) => {
  try {
    const numAmount = Number(amount) || 0;
    if (!Number.isFinite(numAmount) || numAmount < 0) throw new Error("المبلغ غير صالح");
    if (numAmount === 0) return await getOrCreateWallet(userId);

    return await inFinancialTransaction(existingSession, async (session) => {
      const idempotencyKey = orderId ? `order-payment:${orderId}:${operationKey}` : null;
      const existingTransaction = await findTransactionByKey(idempotencyKey, session);
      if (existingTransaction) return getWalletInSession(userId, session);

      const wallet = await getWalletInSession(userId, session);
      const balance = getCurrencyBalance(wallet, currency);
      balance.pendingBalance += numAmount;
      await wallet.save({ session });

      await Transaction.create([{
        user: userId,
        order: orderId,
        type: "ORDER_PAYMENT",
        amount: numAmount,
        currency,
        balanceType: "pending",
        description,
        ...(idempotencyKey ? { idempotencyKey } : {})
      }], { session });

      return wallet;
    });
  } catch (err) {
    console.error("[WALLET] addPendingBalance error:", err);
    throw err;
  }
};

/**
 * خصم الرصيد المعلق (في حال إلغاء طلب)
 */
export const removePendingBalance = async (
  userId,
  amount,
  description,
  currency = "YER",
  orderId = null,
  { session: existingSession, operationKey = "default" } = {}
) => {
  try {
    const numAmount = Number(amount) || 0;
    if (!Number.isFinite(numAmount) || numAmount < 0) throw new Error("المبلغ غير صالح");
    if (numAmount === 0) return await getOrCreateWallet(userId);

    return await inFinancialTransaction(existingSession, async (session) => {
      const idempotencyKey = orderId ? `order-cancel:${orderId}:${operationKey}` : null;
      const existingTransaction = await findTransactionByKey(idempotencyKey, session);
      if (existingTransaction) return getWalletInSession(userId, session);

      const wallet = await getWalletInSession(userId, session);
      const balance = wallet.balances.find((item) => item.currency === currency);
      if (!balance || balance.pendingBalance < numAmount) {
        throw new Error(`رصيد معلق غير كافٍ بالعملة ${currency}`);
      }

      balance.pendingBalance -= numAmount;
      await wallet.save({ session });
      await Transaction.create([{
        user: userId,
        order: orderId,
        type: "ORDER_CANCEL",
        amount: -numAmount,
        currency,
        balanceType: "pending",
        description,
        ...(idempotencyKey ? { idempotencyKey } : {})
      }], { session });

      return wallet;
    });
  } catch (err) {
    console.error("[WALLET] removePendingBalance error:", err);
    throw err;
  }
};

/**
 * تحويل الرصيد من معلق إلى متاح عند تأكيد الاستلام
 */
export const releaseBalance = async (
  userId,
  amount,
  orderId,
  currency = "YER",
  type = "RELEASE",
  { session: existingSession } = {}
) => {
  try {
    const numAmount = Number(amount) || 0;
    if (!Number.isFinite(numAmount) || numAmount < 0) throw new Error("المبلغ غير صالح");
    if (numAmount === 0) return await getOrCreateWallet(userId);

    return await inFinancialTransaction(existingSession, async (session) => {
      const idempotencyKey = orderId ? `order-release:${orderId}:${type}:${currency}` : null;
      let existingRelease = await findTransactionByKey(idempotencyKey, session);
      if (!existingRelease && orderId) {
        existingRelease = await Transaction.findOne({
          user: userId,
          order: orderId,
          type: "RELEASE",
          currency,
          idempotencyKey: { $exists: false },
          description: { $regex: type === "SHIPPING" ? /شحن/ : /^(?!.*شحن).*$/ }
        }).session(session);
      }
      if (existingRelease) return getWalletInSession(userId, session);

      const wallet = await getWalletInSession(userId, session);
      const balance = wallet.balances.find((item) => item.currency === currency);
      if (!balance || balance.pendingBalance < numAmount) {
        throw new Error(`رصيد معلق غير كافٍ للتحرير بالعملة ${currency}`);
      }

      balance.pendingBalance -= numAmount;
      balance.availableBalance += numAmount;
      await wallet.save({ session });

      const description = type === "SHIPPING"
        ? `تحرير رصيد شحن الطلب #${orderId} إلى متاح`
        : `تحرير رصيد الطلب #${orderId} إلى متاح`;
      await Transaction.create([{
        user: userId,
        order: orderId,
        type: "RELEASE",
        amount: numAmount,
        currency,
        balanceType: "available",
        description,
        ...(idempotencyKey ? { idempotencyKey } : {})
      }], { session });

      return wallet;
    });
  } catch (err) {
    console.error("[WALLET] releaseBalance error:", err);
    throw err;
  }
};

/**
 * خصم رصيد متاح عند طلب السحب
 */
export const deductAvailableBalance = async (userId, amount, description, currency = "YER") => {
  try {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) throw new Error("المبلغ غير صالح");

    return await withFinancialTransaction(async (session) => {
      const wallet = await getWalletInSession(userId, session);
      const balance = wallet.balances.find((item) => item.currency === currency);
      if (!balance || balance.availableBalance < numAmount) {
        throw new Error(`رصيد غير كافٍ أو محفظة غير موجودة للعملة ${currency}.`);
      }

      balance.availableBalance -= numAmount;
      await wallet.save({ session });
      await Transaction.create([{
        user: userId,
        type: "WITHDRAWAL",
        amount: -numAmount,
        currency,
        balanceType: "available",
        description: description || "عملية سحب رصيد",
        status: "PENDING"
      }], { session });

      return wallet;
    });
  } catch (err) {
    console.error("[WALLET] deductAvailableBalance error:", err);
    throw err;
  }
};

/**
 * إعادة الرصيد المتاح (في حال رفض طلب السحب أو استرداد ثمن طلب)
 */
export const refundAvailableBalance = async (
  userId,
  amount,
  description,
  currency = "YER",
  orderId = null,
  { session: existingSession, operationKey = "default" } = {}
) => {
  try {
    const numAmount = Number(amount) || 0;
    if (!Number.isFinite(numAmount) || numAmount < 0) throw new Error("المبلغ غير صالح");
    if (numAmount === 0) return await getOrCreateWallet(userId);

    return await inFinancialTransaction(existingSession, async (session) => {
      const idempotencyKey = orderId ? `order-refund:${orderId}:${operationKey}` : null;
      const existingTransaction = await findTransactionByKey(idempotencyKey, session);
      if (existingTransaction) return getWalletInSession(userId, session);

      const wallet = await getWalletInSession(userId, session);
      const balance = getCurrencyBalance(wallet, currency);
      balance.availableBalance += numAmount;
      await wallet.save({ session });
      await Transaction.create([{
        user: userId,
        order: orderId,
        type: "REFUND",
        amount: numAmount,
        currency,
        balanceType: "available",
        description,
        ...(idempotencyKey ? { idempotencyKey } : {})
      }], { session });

      return wallet;
    });
  } catch (err) {
    console.error("[WALLET] refundAvailableBalance error:", err);
    throw err;
  }
};

/**
 * تعديل يدوي للرصيد من قبل الإدارة
 */
export const adminAdjustBalance = async (userId, amount, balanceType, adminId, reason, currency = "YER") => {
  try {
    const numAmount = Number(amount) || 0;
    if (!Number.isFinite(numAmount)) throw new Error("المبلغ غير صالح");

    return await withFinancialTransaction(async (session) => {
      const wallet = await getWalletInSession(userId, session);
      const balance = getCurrencyBalance(wallet, currency);
      if (balanceType === "pending") balance.pendingBalance += numAmount;
      else balance.availableBalance += numAmount;

      await wallet.save({ session });
      await Transaction.create([{
        user: userId,
        type: "ADMIN_ADJUSTMENT",
        amount: numAmount,
        currency,
        balanceType,
        description: `تعديل إداري بواسطة #${adminId}. السبب: ${reason}`
      }], { session });

      return wallet;
    });
  } catch (err) {
    console.error("[WALLET] adminAdjustBalance error:", err);
    throw err;
  }
};
