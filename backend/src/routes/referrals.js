import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import ReferralEngine from "../engines/ReferralEngine.js";
import ReferralProfile from "../models/ReferralProfile.js";
import ReferralRelationship from "../models/ReferralRelationship.js";
import Withdrawal from "../models/Withdrawal.js";
import SystemSettings from "../models/SystemSettings.js";
import { getOrCreateWallet } from "../services/walletService.js";
import { createReferralWithdrawalFinancials } from "../services/referralService.js";
import ReferralCommission from "../models/ReferralCommission.js";
import { createNotification } from "../services/notificationService.js";
import Joi from "joi";
import { validateBody } from "../middleware/validate.js";

const router = Router();
const referralCodeCookie = "souqak_referral";
const minimums = { YER: 1000, YER_ADEN: 1000, YER_SANAA: 1000, SAR: 2.5, USD: 1 };

const requireBearerHeader = (req, res, next) => {
  if (!req.headers.authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization header required" });
  }
  next();
};

router.get("/visit/:code", async (req, res) => {
  const profile = await ReferralProfile.findOne({ referralCode: req.params.code, status: "ACTIVE" }).select("_id").lean();
  if (!profile) return res.status(404).json({ error: "رابط الدعوة غير صالح" });
  res.cookie(referralCodeCookie, req.params.code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 60 * 60 * 1000, path: "/" });
  res.json({ ok: true });
});

router.get("/me", auth, async (req, res) => {
  try {
    const [profile, wallet, relationships, commissions] = await Promise.all([
      ReferralEngine.ensureProfile(req.user.id),
      getOrCreateWallet(req.user.id),
      ReferralRelationship.countDocuments({ referrerUserId: req.user.id, status: "ACTIVE" }),
      ReferralCommission.aggregate([
        { $match: { referrerUserId: req.user.id } },
        { $group: { _id: { status: "$status", currency: "$currency" }, total: { $sum: "$commissionAmount" } } }
      ])
    ]);
    const totalsByCurrency = {};
    commissions.forEach(item => {
      const currency = item._id.currency;
      if (!totalsByCurrency[currency]) totalsByCurrency[currency] = {};
      totalsByCurrency[currency][item._id.status] = item.total;
      totalsByCurrency[currency].TOTAL = (totalsByCurrency[currency].TOTAL || 0) + item.total;
    });
    res.json({
      profile,
      referralLink: `${process.env.FRONTEND_URL || "https://souqak-yem.com"}/r/${profile.referralCode}`,
      totalReferredUsers: relationships,
      totalsByCurrency,
      wallet
    });
  } catch (error) {
    res.status(500).json({ error: "تعذر تحميل بيانات سفراء سوقك" });
  }
});

router.get("/me/commissions", auth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const items = await ReferralCommission.find({ referrerUserId: req.user.id }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
  res.json({ items, page, limit });
});

router.get("/me/relationships", auth, async (req, res) => {
  const items = await ReferralRelationship.find({ referrerUserId: req.user.id }).populate("referredUserId", "name createdAt").sort({ createdAt: -1 }).lean();
  res.json(items.map(item => ({ ...item, referredUserId: item.referredUserId ? { id: item.referredUserId._id, name: item.referredUserId.name, createdAt: item.referredUserId.createdAt } : null })));
});

router.get("/me/withdrawals", auth, async (req, res) => {
  res.json(await Withdrawal.find({ user: req.user.id, isDeleted: { $ne: true } }).sort({ createdAt: -1 }).lean());
});

router.post("/withdrawals", requireBearerHeader, auth, requireRole(["seller", "buyer", "user"]), validateBody(Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().valid("YER", "YER_ADEN", "YER_SANAA", "SAR", "USD").required(),
  phoneNumber: Joi.string().required(),
  receiptType: Joi.string().valid("bank_account", "exchange_transfer").required(),
  bankName: Joi.string().required(),
  accountName: Joi.string().required(),
  accountNumber: Joi.string().allow(""),
  accountCurrency: Joi.string().allow(""),
  governorateId: Joi.string().length(24).hex().allow(null, ""),
  cityId: Joi.string().length(24).hex().allow(null, "")
})), async (req, res) => {
  try {
    const { amount, currency, phoneNumber, receiptType, bankName, accountName, accountNumber, accountCurrency, governorateId, cityId } = req.body;
    const settings = await SystemSettings.getSettings();
    if (settings.referralProgram?.programEnabled === false) return res.status(403).json({ error: "برنامج سفراء سوقك متوقف حالياً" });
    const minimum = settings.referralProgram?.minimumWithdrawal?.[currency] ?? minimums[currency];
    if (amount < minimum) return res.status(422).json({ error: `الحد الأدنى للسحب هو ${minimum} ${currency}` });
    const amountInUsd = amount / (settings.exchangeRates[currency] || 1);
    if (amountInUsd >= settings.withdrawalIdentityThresholdUsd) return res.status(422).json({ error: "يرجى استخدام مسار المحفظة وإرفاق مستند الهوية لهذا المبلغ." });
    const existing = await Withdrawal.findOne({ user: req.user.id, status: { $in: ["PENDING", "PROCESSING"] } });
    if (existing) return res.status(409).json({ error: "لديك طلب سحب قيد المراجعة" });
    const { withdrawal } = await createReferralWithdrawalFinancials({
      userId: req.user.id,
      amount,
      currency,
      phoneNumber,
      bankDetails: { receiptType, bankName, accountName, accountNumber, accountCurrency, governorateId: governorateId || undefined, cityId: cityId || undefined }
    });
    await createNotification(req.app, { userId: req.user.id, type: "wallet", title: "تم استلام طلب السحب", body: `تم استلام طلب سحب ${amount} ${currency} للمراجعة.`, data: { withdrawalId: withdrawal._id } });
    res.status(201).json(withdrawal);
  } catch (error) {
    const clientError = /رصيد غير كافٍ|الحد الأدنى|قيد المراجعة|هوية/i.test(error.message || "");
    res.status(clientError ? 422 : 500).json({ error: error.message || "تعذر إنشاء طلب السحب" });
  }
});

router.post("/attribution/claim", auth, async (req, res) => {
  return res.status(410).json({ error: "يتم تثبيت الإحالة تلقائياً أثناء إنشاء الحساب." });
});

export { referralCodeCookie };
export default router;