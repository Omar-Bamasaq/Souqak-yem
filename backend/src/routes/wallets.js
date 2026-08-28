import { Router } from "express";
import path from "path";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { getOrCreateWallet, deductAvailableBalance } from "../services/walletService.js";
import Transaction from "../models/Transaction.js";
import Withdrawal from "../models/Withdrawal.js";
import SystemSettings from "../models/SystemSettings.js";
import Joi from "joi";
import { validateBody } from "../middleware/validate.js";
import { createNotification } from "../services/notificationService.js";
import { uploadIdDoc, processImage } from "../middleware/upload.js";
import AdminNotification from "../models/AdminNotification.js";
import User from "../models/User.js";
import { sendAdminEmail } from "../utils/sendEmail.js";

const router = Router();

const MINIMUM_WITHDRAWAL_BY_CURRENCY = {
  YER: 1000,
  YER_ADEN: 1000,
  YER_SANAA: 1000,
  SAR: 2.5,
  USD: 0.75
};

// عرض المحفظة (الرصيد)
router.get("/me", auth, async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.user.id);
    res.json(wallet);
  } catch {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

// عرض تاريخ العمليات
router.get("/transactions", auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(transactions);
  } catch {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

// طلب سحب رصيد (Seller)
router.post(
  "/withdraw",
  auth,
  requireRole(["seller", "user"]),
  uploadIdDoc.single("identityImage"),
  async (req, res) => {
    try {
      const { amount, currency, receiptType, bankName, accountName, accountNumber, accountCurrency, governorateId, cityId, phoneNumber } = req.body;
      
      // Manual validation because multer body parsing happens in the middleware
      if (!amount || !currency || !receiptType || !bankName || !accountName || !phoneNumber) {
        return res.status(400).json({ error: "يرجى إكمال كافة البيانات المطلوبة بما في ذلك رقم الهاتف." });
      }

      const settings = await SystemSettings.getSettings();
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: "المبلغ المطلوب غير صالح." });
      }

      const minimumWithdrawal = MINIMUM_WITHDRAWAL_BY_CURRENCY[currency];
      if (minimumWithdrawal === undefined) {
        return res.status(400).json({ error: "عملة السحب غير مدعومة." });
      }
      if (numAmount < minimumWithdrawal) {
        return res.status(400).json({
          error: `الحد الأدنى للسحب هو ${minimumWithdrawal.toLocaleString()} ${currency}.`
        });
      }
      
      // Calculate USD equivalent
      const rate = settings.exchangeRates[currency] || 1;
      const amountInUsd = numAmount / rate;
      
      // Identity check
      if (amountInUsd >= settings.withdrawalIdentityThresholdUsd && !req.file) {
        return res.status(400).json({ error: `بسبب قيمة المبلغ (${numAmount} ${currency})، نحتاج التحقق من هويتك لإتمام عملية السحب. يرجى إرفاق صورة الهوية.` });
      }

      const wallet = await getOrCreateWallet(req.user.id);
      
      const balanceObj = wallet.balances.find(b => b.currency === currency);
      if (!balanceObj || balanceObj.availableBalance < numAmount) {
          return res.status(400).json({ error: "رصيدك المتاح لهذه العملة غير كافٍ." });
      }

      // التحقق من تكرار الطلب في وقت قصير (منع التلاعب أو الخطأ)
      const existingWithdrawal = await Withdrawal.findOne({
        user: req.user.id,
        amount: numAmount,
        currency,
        status: "PENDING",
        createdAt: { $gt: new Date(Date.now() - 60000) } // خلال آخر دقيقة
      });
      if (existingWithdrawal) {
        return res.status(400).json({ error: "يوجد طلب سحب مماثل قيد المراجعة حالياً، يرجى الانتظار دقيقة قبل المحاولة مرة أخرى." });
      }

      // خصم الرصيد وتسجيل العملية كمعلقة (عن طريق خدمة المحفظة)
      await deductAvailableBalance(req.user.id, numAmount, `طلب سحب (${receiptType === 'bank_account' ? 'حساب' : 'حوالة'}) إلى ${bankName}`, currency);

      let identityImagePath = undefined;
      if (req.file) {
        const processed = await processImage(req.file.path, "ids");
        identityImagePath = `ids/${path.basename(processed)}`;
      }

      const withdrawal = await Withdrawal.create({
        user: req.user.id,
        amount: numAmount,
        currency,
        phoneNumber,
        feeAmount: 0,
        finalAmount: numAmount,
        bankDetails: { 
          receiptType, 
          bankName, 
          accountName, 
          accountNumber, 
          accountCurrency, 
          governorateId: (governorateId && governorateId !== "null" && governorateId !== "") ? governorateId : undefined, 
          cityId: (cityId && cityId !== "null" && cityId !== "") ? cityId : undefined,
          identityImage: identityImagePath
        }
      });

      // إشعار للمستخدم
      await createNotification(req.app, {
        userId: req.user.id,
        title: "طلب سحب رصيد",
        body: `تم استلام طلب السحب الخاص بك بمبلغ ${numAmount.toLocaleString()} ${currency}. سيتم التحقق منه خلال 24 ساعة.`,
        type: "wallet",
        data: { withdrawalId: withdrawal._id }
      });

      // إشعار لحظي للأدمن
      try {
        const user = await User.findById(req.user.id).select("name").lean();
        const adminNotif = await AdminNotification.create({
          type: "withdrawal",
          title: "طلب سحب جديد",
          message: `قام المستخدم ${user?.name || "غير معروف"} بطلب سحب مبلغ ${amount} ${currency}`,
          link: "/admin/escrow",
          data: { withdrawalId: withdrawal._id, amount, currency }
        });

        const io = req.app.get("io");
        if (io) io.emit("admin_notification:new", adminNotif);
      } catch (notifErr) {
        console.error("Admin withdrawal notification failed:", notifErr);
      }

      // إرسال إيميل للأدمن
      try {
        const user = await User.findById(req.user.id).select("name email phone").lean();
        const formattedAmount = `${numAmount.toLocaleString()} ${currency}`;
        
        await sendAdminEmail({
          subject: `💳 طلب سحب جديد - ${user?.name}`,
          html: `
            <div dir="rtl" style="font-family: 'Tajawal', sans-serif; padding: 20px; background-color: #f8fafc; color: #1e293b;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; padding: 30px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 25px;">
                  <span style="background-color: #fee2e2; color: #ef4444; padding: 8px 20px; border-radius: 12px; font-weight: 900; font-size: 12px; letter-spacing: 1px;">إشعار سحب جديد</span>
                  <h2 style="margin-top: 15px; color: #0f172a; font-size: 24px; font-weight: 900;">وصل طلب سحب جديد للمراجعة</h2>
                </div>

                <div style="background-color: #f1f5f9; border-radius: 20px; padding: 20px; margin-bottom: 25px;">
                  <div style="margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <span style="color: #64748b; font-size: 12px; font-weight: bold;">المستخدم:</span>
                    <span style="float: left; color: #0f172a; font-weight: 900;">${user?.name}</span>
                  </div>
                  <div style="margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <span style="color: #64748b; font-size: 12px; font-weight: bold;">هاتف التواصل:</span>
                    <span style="float: left; color: #2563eb; font-weight: 900;">${phoneNumber}</span>
                  </div>
                  <div style="margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <span style="color: #64748b; font-size: 12px; font-weight: bold;">طريقة الاستلام:</span>
                    <span style="float: left; color: #0f172a; font-weight: 900;">${receiptType === 'bank_account' ? 'حساب بنكي' : 'حوالة صرافة'}</span>
                  </div>
                  <div style="margin-bottom: 5px;">
                    <span style="color: #64748b; font-size: 12px; font-weight: bold;">المبلغ المطلوب:</span>
                    <span style="float: left; color: #ef4444; font-weight: 900; font-size: 18px;">${formattedAmount}</span>
                  </div>
                </div>

                <div style="text-align: center;">
                  <a href="${process.env.FRONTEND_URL}/admin/escrow" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 30px; border-radius: 16px; text-decoration: none; font-weight: 900; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">فتح لوحة التحكم</a>
                </div>
              </div>
            </div>
          `
        });
      } catch (emailErr) {
        console.error("Admin withdrawal email failed:", emailErr);
      }

      res.status(201).json({
        ...withdrawal.toObject(),
        requestedAmount: amount,
        fee: withdrawal.feeAmount,
        finalAmount: withdrawal.finalAmount
      });
    } catch (err) {
      console.error("Withdraw error:", err);
      res.status(500).json({ error: err.message || "حدث خطأ في الخادم." });
    }
  }
);

// عرض قائمة السحوبات الخاصة بالمستخدم
router.get("/withdrawals", auth, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ user: req.user.id, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean();
    res.json(withdrawals);
  } catch {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

export default router;
