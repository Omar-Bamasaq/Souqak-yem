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
export const addPendingBalance = async (userId, amount, description, currency = "YER", orderId = null) => {
  try {
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0) return await getOrCreateWallet(userId);

    // تحديث ذري لضمان عدم حدوث تضارب
    const wallet = await Wallet.findOneAndUpdate(
      { user: userId, "balances.currency": currency },
      { $inc: { "balances.$.pendingBalance": numAmount } },
      { new: true }
    );

    if (!wallet) {
      // إذا لم تكن العملة موجودة في المحفظة، نحتاج لإضافتها
      const existingWallet = await getOrCreateWallet(userId);
      const balance = getCurrencyBalance(existingWallet, currency);
      balance.pendingBalance += numAmount;
      await existingWallet.save();
      return existingWallet;
    }

    await Transaction.create([{
      user: userId,
      order: orderId,
      type: "ORDER_PAYMENT",
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
 * خصم الرصيد المعلق (في حال إلغاء طلب)
 */
export const removePendingBalance = async (userId, amount, description, currency = "YER", orderId = null) => {
  try {
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0) return await getOrCreateWallet(userId);

    const wallet = await Wallet.findOneAndUpdate(
      { 
        user: userId, 
        "balances.currency": currency,
        "balances.pendingBalance": { $gte: numAmount }
      },
      { $inc: { "balances.$.pendingBalance": -numAmount } },
      { new: true }
    );

    if (!wallet) {
      throw new Error(`رصيد معلق غير كافٍ بالعملة ${currency}`);
    }

    await Transaction.create([{
      user: userId,
      order: orderId,
      type: "ORDER_CANCEL",
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
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0) return await getOrCreateWallet(userId);

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
      return await getOrCreateWallet(userId);
    }

    // تحديث ذري: تحويل من معلق إلى متاح
    const wallet = await Wallet.findOneAndUpdate(
      { 
        user: userId, 
        "balances.currency": currency,
        "balances.pendingBalance": { $gte: numAmount }
      },
      { 
        $inc: { 
          "balances.$.pendingBalance": -numAmount,
          "balances.$.availableBalance": numAmount
        } 
      },
      { new: true }
    );

    if (!wallet) {
       // إذا كان الرصيد المعلق أقل، نقوم بتحويل المتاح فقط لتجنب تعليق العملية، 
       // ولكن من الأفضل في الأنظمة المالية الصارمة رمي خطأ.
       // سنقوم هنا بتحويل ما هو متاح في المعلق كحد أقصى.
       const currentWallet = await getOrCreateWallet(userId);
       const balance = getCurrencyBalance(currentWallet, currency);
       const actualToRelease = Math.min(balance.pendingBalance, numAmount);
       
       balance.pendingBalance -= actualToRelease;
       balance.availableBalance += actualToRelease;
       await currentWallet.save();
       
       const description = type === "SHIPPING" ? `تحرير رصيد شحن الطلب #${orderId} (تعديل تلقائي)` : `تحرير رصيد الطلب #${orderId} (تعديل تلقائي)`;
       await Transaction.create([{
         user: userId, order: orderId, type: "RELEASE", amount: actualToRelease, currency, balanceType: "available", description
       }]);
       return currentWallet;
    }

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
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) throw new Error("المبلغ غير صالح");

    // استخدام تحديث ذري (Atomic Update) لمنع Race Conditions
    const wallet = await Wallet.findOneAndUpdate(
      { 
        user: userId,
        "balances.currency": currency,
        "balances.availableBalance": { $gte: numAmount } 
      },
      { 
        $inc: { "balances.$.availableBalance": -numAmount } 
      },
      { new: true }
    );

    if (!wallet) {
      throw new Error(`رصيد غير كافٍ أو محفظة غير موجودة للعملة ${currency}.`);
    }

    await Transaction.create([{
      user: userId,
      type: "WITHDRAWAL",
      amount: -numAmount,
      currency,
      balanceType: "available",
      description: description || "عملية سحب رصيد",
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
    const numAmount = Number(amount) || 0;
    if (numAmount <= 0) return await getOrCreateWallet(userId);

    const wallet = await Wallet.findOneAndUpdate(
      { user: userId, "balances.currency": currency },
      { $inc: { "balances.$.availableBalance": numAmount } },
      { new: true }
    );

    if (!wallet) {
      const existingWallet = await getOrCreateWallet(userId);
      const balance = getCurrencyBalance(existingWallet, currency);
      balance.availableBalance += numAmount;
      await existingWallet.save();
      return existingWallet;
    }

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


