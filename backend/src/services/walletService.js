import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import mongoose from "mongoose";

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
    // Note: Since it's a push to a mongoose array, we need to return the actual object from the array
    return wallet.balances[wallet.balances.length - 1];
  }
  return balance;
};

/**
 * إضافة رصيد معلق للبائع عند تأكيد الدفع من الإدارة
 */
export const addPendingBalance = async (userId, amount, orderId, currency = "YER", type = "PAYMENT") => {
  try {
    const wallet = await getOrCreateWallet(userId);
    const numAmount = Number(amount) || 0;
    
    if (numAmount <= 0) return wallet;

    const balance = getCurrencyBalance(wallet, currency);
    balance.pendingBalance += numAmount;
    
    await wallet.save();

    const description = type === "SHIPPING" ? `رصيد شحن معلق للطلب #${orderId}` : `رصيد معلق للطلب #${orderId}`;

    await Transaction.create([{
      user: userId,
      order: orderId,
      type: "PAYMENT",
      amount: numAmount,
      currency,
      balanceType: "pending",
      description: description
    }]);

    return wallet;
  } catch (err) {
    console.error("[WALLET] addPendingBalance error:", err);
    throw err;
  }
};

/**
 * إزالة رصيد معلق (في حال إلغاء الطلب بعد تأكيد الدفع)
 */
export const removePendingBalance = async (userId, amount, orderId, currency = "YER", type = "CANCEL") => {
  try {
    const wallet = await getOrCreateWallet(userId);
    const numAmount = Number(amount) || 0;

    if (numAmount <= 0) return wallet;

    const balance = getCurrencyBalance(wallet, currency);

    if (balance.pendingBalance >= numAmount) {
      balance.pendingBalance -= numAmount;
    } else {
      console.warn(`[WALLET] removePendingBalance: pending balance (${balance.pendingBalance}) < amount (${numAmount}) for order ${orderId}. Setting pending to 0.`);
      balance.pendingBalance = 0;
    }
    
    await wallet.save();

    const description = type === "SHIPPING" ? `إزالة رصيد شحن معلق للطلب الملغي #${orderId}` : `إزالة رصيد معلق للطلب الملغي #${orderId}`;

    await Transaction.create([{
      user: userId,
      order: orderId,
      type: "CANCEL",
      amount: -numAmount,
      currency,
      balanceType: "pending",
      description: description
    }]);

    return wallet;
  } catch (err) {
    console.error("[WALLET] removePendingBalance error:", err);
    throw err;
  }
};

/**
 * تحويل الرصيد من معلق إلى متاح عند تأكيد الاستلام
 */
export const releaseBalance = async (userId, amount, orderId, currency = "YER", type = "RELEASE") => {
  try {
    const wallet = await getOrCreateWallet(userId);
    const numAmount = Number(amount) || 0;

    if (numAmount <= 0) return wallet;

    // التأكد من عدم تحرير الرصيد لهذا الطلب مسبقاً بنفس العملة والنوع (Idempotency)
    const existingRelease = await Transaction.findOne({
      user: userId,
      order: orderId,
      type: "RELEASE",
      currency: currency,
      description: { $regex: type === "SHIPPING" ? /شحن/ : /^(?!.*شحن).*$/ }
    });

    if (existingRelease) {
      console.log(`[WALLET] Balance for order ${orderId} (${type}) in ${currency} already released. Skipping.`);
      return wallet;
    }

    const balance = getCurrencyBalance(wallet, currency);

    // تحرير الرصيد من المعلق
    if (balance.pendingBalance >= numAmount) {
      balance.pendingBalance -= numAmount;
    } else {
      console.warn(`[WALLET] ReleaseBalance: pending balance (${balance.pendingBalance}) < amount (${numAmount}) for order ${orderId}. Setting pending to 0.`);
      balance.pendingBalance = 0;
    }
    
    balance.availableBalance += numAmount;
    
    await wallet.save();

    const description = type === "SHIPPING" ? `تحرير رصيد شحن الطلب #${orderId} إلى متاح` : `تحرير رصيد الطلب #${orderId} إلى متاح`;

    await Transaction.create([{
      user: userId,
      order: orderId,
      type: "RELEASE",
      amount: numAmount,
      currency,
      balanceType: "available",
      description: description
    }]);

    return wallet;
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
    const wallet = await getOrCreateWallet(userId);
    const numAmount = Number(amount) || 0;

    const balance = getCurrencyBalance(wallet, currency);

    if (balance.availableBalance < numAmount) {
        throw new Error(`رصيد غير كافٍ للسحب بالعملة ${currency}.`);
    }
    
    balance.availableBalance -= numAmount;
    await wallet.save();

    await Transaction.create([{
        user: userId,
        type: "WITHDRAWAL",
        amount: -numAmount,
        currency,
        balanceType: "available",
        description,
        status: "PENDING"
    }]);

    return wallet;
  } catch (err) {
    console.error("[WALLET] deductAvailableBalance error:", err);
    throw err;
  }
};

/**
 * إعادة الرصيد المتاح (في حال رفض طلب السحب أو استرداد ثمن طلب)
 */
export const refundAvailableBalance = async (userId, amount, description, currency = "YER", orderId = null) => {
  try {
    const wallet = await getOrCreateWallet(userId);
    const numAmount = Number(amount) || 0;

    const balance = getCurrencyBalance(wallet, currency);
    balance.availableBalance += numAmount;
    
    await wallet.save();

    await Transaction.create([{
        user: userId,
        order: orderId,
        type: "REFUND",
        amount: numAmount,
        currency,
        balanceType: "available",
        description
    }]);

    return wallet;
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
    const wallet = await getOrCreateWallet(userId);
    const numAmount = Number(amount) || 0;
    
    const balance = getCurrencyBalance(wallet, currency);
    
    if (balanceType === "pending") {
      balance.pendingBalance += numAmount;
    } else {
      balance.availableBalance += numAmount;
    }
    
    await wallet.save();

    await Transaction.create([{
        user: userId,
        type: "ADMIN_ADJUSTMENT",
        amount: numAmount,
        currency,
        balanceType,
        description: `تعديل إداري بواسطة #${adminId}. السبب: ${reason}`
    }]);

    return wallet;
  } catch (err) {
    console.error("[WALLET] adminAdjustBalance error:", err);
    throw err;
  }
};


