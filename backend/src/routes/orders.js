import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import Order from "../models/Order.js";
import Dispute from "../models/Dispute.js";
import Ad from "../models/Ad.js";
import ResellAd from "../models/ResellAd.js";
import Joi from "joi";
import { validateBody, validateParams } from "../middleware/validate.js";
import { uploadReceipt } from "../middleware/upload.js";
import { releaseBalance } from "../services/walletService.js";
import { createNotification } from "../services/notificationService.js";
import AdminNotification from "../models/AdminNotification.js";
import User from "../models/User.js";
import { sendAdminEmail } from "../utils/sendEmail.js";
import { sendSafePurchaseNotification } from "../utils/emailSender.js";

const router = Router();

// 1. إنشاء طلب شراء آمن (Buyer)
router.post(
  "/",
  auth,
  requireRole(["buyer", "user"]),
  validateBody(Joi.object({
    adId: Joi.string().length(24).hex().required(),
    finalPrice: Joi.number().min(0).optional(), // تجاهل هذه القيمة واستخدام سعر قاعدة البيانات
    shippingFee: Joi.number().min(0).default(0),
    shippingCurrency: Joi.string().valid("YER", "YER_ADEN", "YER_SANAA", "SAR", "USD").default("YER"),
    shippingPayer: Joi.string().valid("buyer", "seller", "none").default("buyer"),
    notes: Joi.string().allow(""),
    currency: Joi.string().valid("YER", "YER_ADEN", "YER_SANAA", "SAR", "USD").default("YER"),
    agreedTerms: Joi.boolean().valid(true).required()
  })),
  async (req, res) => {
    try {
      const { adId, shippingFee, shippingCurrency, shippingPayer, notes, agreedTerms, currency } = req.body;
      
      // جلب بيانات الإعلان من قاعدة البيانات حصراً
      let ad = await Ad.findById(adId).lean();
      let price = 0;
      let sellerId = null;
      let isResell = false;

      if (!ad) {
        // التحقق مما إذا كان إعلان إعادة بيع
        const resellAd = await ResellAd.findById(adId).populate("originalAdId").lean();
        if (resellAd && resellAd.originalAdId) {
          ad = resellAd.originalAdId;
          price = resellAd.newPrice;
          sellerId = resellAd.resellerId;
          isResell = true;
        }
      } else {
        price = ad.price;
        sellerId = ad.userId;
      }

      if (!ad || ad.status !== "approved") {
        return res.status(400).json({ error: "الإعلان غير صالح أو غير متوفر حالياً." });
      }
      
      if (!sellerId) {
          return res.status(400).json({ error: "هذا الإعلان غير مرتبط بمستخدم، لا يمكن إتمام عملية الشراء." });
      }

      if (sellerId.toString() === req.user.id) {
          return res.status(400).json({ error: "لا يمكنك شراء منتجك الخاص." });
      }

      const sFee = Number(shippingFee) || 0;
      
      // حساب العمولات (3% على المشتري، 1% على البائع)
      // يتم الحساب بناءً على السعر المجلوب من قاعدة البيانات فقط
      const buyerServiceFee = Math.round(price * 0.03); 
      const sellerCommission = Math.round(price * 0.01);
      
      // الحسابات المالية (بالعملة الأساسية للمنتج)
      let totalAmount = price + buyerServiceFee;
      let sellerAmount = price - sellerCommission; 

      if (shippingPayer === "buyer" && shippingCurrency === currency) {
        totalAmount += sFee;
      }
      
      const platformFee = buyerServiceFee + sellerCommission;

      const order = await Order.create({
        buyer: req.user.id,
        seller: sellerId,
        ad: ad._id,
        resellAd: isResell ? adId : undefined,
        status: "PENDING_SELLER_APPROVAL",
        amount: price,
        shippingFee: sFee,
        shippingCurrency: shippingCurrency || currency,
        shippingPayer,
        totalAmount,
        currency,
        buyerServiceFee,
        sellerCommission,
        platformFee,
        sellerAmount,
        agreedTerms,
        notes
      });

      // إشعار للبائع
      try {
        const deliveryText = 
          shippingPayer === "buyer" ? "على المشتري" : 
          shippingPayer === "seller" ? "على البائع" : "لا يوجد / استلام مباشر";

        const details = `
السعر المتفق عليه: ${price} ${currency}
التوصيل: ${deliveryText}
رسوم التوصيل: ${sFee} ${shippingCurrency || currency}
ملاحظات: ${notes || "لا يوجد"}
        `.trim();

        await createNotification(req.app, {
          userId: ad.userId,
          title: "طلب شراء جديد",
          body: `لديك طلب شراء آمن جديد للإعلان: ${ad.title}.\n${details}`,
          type: "order",
          data: { orderId: order._id },
          email: false // نمنع إرسال الإيميل التلقائي هنا لأننا نرسل إيميل مخصص أدناه
        });

        // إرسال بريد إلكتروني إذا كان البائع مسجلاً بالبريد الإلكتروني
        const seller = await User.findById(ad.userId).lean();
        if (seller && seller.email) {
          await sendSafePurchaseNotification(
            seller.email,
            seller.name,
            ad.title,
            order._id,
            price,
            currency,
            sFee,
            shippingCurrency || currency,
            deliveryText
          );
        }
      } catch (notifErr) {
        console.error("Failed to send order notification to seller:", notifErr);
        // لا نريد تعطيل الطلب إذا فشل الإشعار فقط
      }

      res.status(201).json(order);
    } catch (err) {
      console.error("Create order error details:", {
        message: err.message,
        stack: err.stack,
        body: req.body,
        user: req.user.id
      });
      res.status(500).json({ error: "حدث خطأ في الخادم أثناء إنشاء الطلب." });
    }
  }
);

// 2. موافقة البائع على الطلب (Seller)
router.patch(
  "/:id/approve",
  auth,
  requireRole(["seller", "user"]),
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "الطلب غير موجود." });
      if (order.seller.toString() !== req.user.id) return res.status(403).json({ error: "غير مسموح لك بهذا الإجراء." });
      if (order.status !== "PENDING_SELLER_APPROVAL") return res.status(400).json({ error: "حالة الطلب لا تسمح بالموافقة." });

      order.status = "AWAITING_PAYMENT";
      await order.save();

      // إشعار للمشتري
      await createNotification(req.app, {
        userId: order.buyer,
        title: "تمت الموافقة على طلبك",
        body: `وافق البائع على طلب الشراء الخاص بك. يرجى إتمام عملية الدفع خلال 6 ساعات.`,
        type: "order",
        data: { orderId: order._id }
      });

      res.json(order);
    } catch (err) {
      res.status(500).json({ error: "حدث خطأ في الخادم." });
    }
  }
);

// 2.1 رفض البائع للطلب (Seller)
router.patch(
  "/:id/reject",
  auth,
  requireRole(["seller", "user"]),
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  validateBody(Joi.object({ reason: Joi.string().allow("") })),
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "الطلب غير موجود." });
      if (order.seller.toString() !== req.user.id) return res.status(403).json({ error: "غير مسموح لك بهذا الإجراء." });
      if (order.status !== "PENDING_SELLER_APPROVAL") return res.status(400).json({ error: "حالة الطلب لا تسمح بالرفض." });

      order.status = "CANCELLED";
      order.notes = (order.notes || "") + `\nسبب الرفض: ${req.body.reason || "لم يذكر"}`;
      await order.save();

      // إشعار للمشتري
      await createNotification(req.app, {
        userId: order.buyer,
        title: "تم رفض طلب الشراء",
        body: `نعتذر منك، قام البائع برفض طلب الشراء الخاص بك للطلب #${order._id.toString().slice(-6)}. السبب: ${req.body.reason || "غير محدد"}.`,
        type: "order",
        data: { orderId: order._id }
      });

      res.json(order);
    } catch (err) {
      console.error("Reject order error:", err);
      res.status(500).json({ error: "حدث خطأ في الخادم." });
    }
  }
);

// 3. المشتري يرسل بيانات الدفع (Buyer)
router.patch(
  "/:id/pay",
  auth,
  requireRole(["buyer", "user"]),
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  uploadReceipt,
  async (req, res) => {
    try {
      console.log("Order Pay Request - ID:", req.params.id);
      const { bankName, transactionNumber } = req.body;
      const receiptFiles = req.files || [];

      console.log("Pay Request Body:", { bankName, transactionNumber });
      console.log("Pay Request Files count:", receiptFiles.length);

      if (!bankName || !transactionNumber) {
        return res.status(400).json({ error: "يرجى إدخال اسم البنك ورقم الحوالة." });
      }

      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "الطلب غير موجود." });
      
      if (order.buyer.toString() !== req.user.id) {
        return res.status(403).json({ error: "غير مسموح لك بهذا الإجراء." });
      }

      // تحويل أرقام العمليات لضمان التعامل معها كمصفوفة دائماً
      const tNumbers = Array.isArray(transactionNumber) ? transactionNumber : [transactionNumber];
      
      // دمج السندات مع أرقام العمليات المقابلة لها بدقة
      const newPayments = receiptFiles.map((file, idx) => {
        const tNum = String(tNumbers[idx] || tNumbers[0] || "").trim();
        console.log(`Processing file ${idx}:`, file.filename, "with transaction number:", tNum);
        return {
          transactionNumber: tNum, 
          receiptImage: `receipts/${file.filename}`
        };
      }).filter(p => p.transactionNumber !== ""); // استبعاد أي إدخالات فارغة

      if (newPayments.length === 0) {
        console.log("Error: No valid payments found in request");
        return res.status(400).json({ error: "يجب رفع سند دفع واحد على الأقل مع رقم العملية." });
      }

      console.log("New Payments to add:", newPayments);

      // تحديث الحالة
      order.status = "AWAITING_PAYMENT_CONFIRMATION";
      
      // استخدام الطريقة الأكثر أماناً لتحديث الحقول المتداخلة في Mongoose
      const existingPayments = (order.paymentDetails && Array.isArray(order.paymentDetails.payments)) 
        ? order.paymentDetails.payments 
        : [];

      // إعادة بناء كائن paymentDetails بالكامل لتجنب أي تعارض مع الهيكل القديم
      const updatedPaymentDetails = {
        bankName: String(bankName).trim(),
        payments: [...existingPayments, ...newPayments].slice(0, 5), // Allow more than 2 if needed
        submittedAt: new Date()
      };

      console.log("Updating order with paymentDetails:", JSON.stringify(updatedPaymentDetails, null, 2));
      order.set('paymentDetails', updatedPaymentDetails);
      order.markModified('paymentDetails');

      await order.save();
      console.log("Order saved successfully");

      // إنشاء إشعار لحظي للأدمن
      try {
        const buyer = await User.findById(req.user.id).select("name").lean();
        console.log("Creating admin notification for buyer:", buyer?.name);
        const adminNotif = await AdminNotification.create({
          type: "order_payment",
          title: "بيانات دفع جديدة",
          message: `قام المشتري ${buyer?.name || "غير معروف"} برفع بيانات الدفع للطلب #${order._id.toString().slice(-6).toUpperCase()}`,
          link: "/admin/escrow",
          data: { orderId: order._id, amount: order.totalAmount, currency: order.currency }
        });

        const io = req.app.get("io");
        if (io) io.emit("admin_notification:new", adminNotif);
        console.log("Admin notification emitted");
      } catch (notifErr) {
        console.error("Admin notification failed (non-critical):", notifErr);
      }

      // إرسال إيميل للأدمن
      try {
        const buyer = await User.findById(req.user.id).select("name email phone").lean();
        const formattedAmount = `${(order.totalAmount || 0).toLocaleString()} ${order.currency || ''}`;
        
        console.log("Sending admin email...");
        await sendAdminEmail({
          subject: `📦 طلب دفع جديد - #${order._id.toString().slice(-6).toUpperCase()}`,
          html: `
            <div dir="rtl" style="font-family: 'Tajawal', sans-serif; padding: 20px; background-color: #f8fafc; color: #1e293b;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; padding: 30px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 25px;">
                  <span style="background-color: #dbeafe; color: #2563eb; padding: 8px 20px; border-radius: 12px; font-weight: 900; font-size: 12px; letter-spacing: 1px;">إشعار دفع جديد</span>
                  <h2 style="margin-top: 15px; color: #0f172a; font-size: 24px; font-weight: 900;">وصلت بيانات دفع جديدة للمراجعة</h2>
                </div>

                <div style="background-color: #f1f5f9; border-radius: 20px; padding: 20px; margin-bottom: 25px;">
                  <div style="margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <span style="color: #64748b; font-size: 12px; font-weight: bold;">رقم الطلب:</span>
                    <span style="float: left; color: #0f172a; font-weight: 900;">#${order._id.toString().toUpperCase()}</span>
                  </div>
                  <div style="margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <span style="color: #64748b; font-size: 12px; font-weight: bold;">المشتري:</span>
                    <span style="float: left; color: #0f172a; font-weight: 900;">${buyer?.name}</span>
                  </div>
                  <div style="margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <span style="color: #64748b; font-size: 12px; font-weight: bold;">هاتف المشتري:</span>
                    <span style="float: left; color: #0f172a; font-weight: 900;">${buyer?.phone || "غير متوفر"}</span>
                  </div>
                  <div style="margin-bottom: 5px;">
                    <span style="color: #64748b; font-size: 12px; font-weight: bold;">المبلغ الإجمالي:</span>
                    <span style="float: left; color: #2563eb; font-weight: 900; font-size: 18px;">${formattedAmount}</span>
                  </div>
                </div>

                <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 20px; padding: 20px; margin-bottom: 25px;">
                  <h4 style="margin: 0 0 15px 0; color: #92400e; font-size: 14px; font-weight: 900;">تفاصيل الحوالة المستلمة:</h4>
                  <p style="margin: 5px 0; font-size: 13px;"><strong>البنك:</strong> ${order.paymentDetails.bankName}</p>
                  <p style="margin: 10px 0; font-size: 13px; font-weight: bold; color: #b45309;">السندات المرفوعة: ${order.paymentDetails.payments.length} سند</p>
                  <div style="display: flex; gap: 10px; margin-top: 10px;">
                    ${order.paymentDetails.payments.map((p, i) => `
                      <div style="font-size: 11px; color: #d97706;">رقم العملية ${i+1}: ${p.transactionNumber}</div>
                    `).join('')}
                  </div>
                </div>

                <div style="text-align: center;">
                  <a href="http://localhost:5173/admin/escrow" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 16px 40px; border-radius: 16px; text-decoration: none; font-weight: 900; font-size: 16px; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.3);">مراجعة الطلب الآن</a>
                  <p style="margin-top: 20px; color: #94a3b8; font-size: 11px;">هذا إيميل آلي، يرجى عدم الرد عليه.</p>
                </div>
              </div>
            </div>
          `
        });
        console.log("Admin email sent");
      } catch (emailErr) {
        console.error("Admin email notification failed (non-critical):", emailErr);
      }

      res.json(order);
    } catch (err) {
      console.error("CRITICAL ERROR in Order Pay:", err);
      res.status(500).json({ 
        error: "حدث خطأ داخلي في الخادم أثناء حفظ بيانات الدفع.",
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  }
);

// 4. البائع يشحن المنتج (Seller)
router.patch(
  "/:id/ship",
  auth,
  requireRole(["seller", "user"]),
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  uploadReceipt, // Reuse existing receipt upload middleware (saves to uploads/receipts)
  validateBody(Joi.object({
    company: Joi.string().required(),
    trackingNumber: Joi.string().required()
  })),
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "الطلب غير موجود." });
      if (order.seller.toString() !== req.user.id) return res.status(403).json({ error: "غير مسموح لك بهذا الإجراء." });
      if (order.status !== "PAID_CONFIRMED") return res.status(400).json({ error: "يجب انتظار تأكيد الدفع من الإدارة قبل الشحن." });

      const shippingDetails = {
        company: req.body.company,
        trackingNumber: req.body.trackingNumber,
        shippedAt: new Date()
      };

      // Add optional shipping receipt if uploaded
      if (req.files && req.files.length > 0) {
        shippingDetails.shippingReceipt = `receipts/${req.files[0].filename}`;
      }

      order.shippingDetails = shippingDetails;
      order.status = "SHIPPED";
      await order.save();

      // إشعار للمشتري
      try {
        await createNotification(req.app, {
          userId: order.buyer,
          title: "تم شحن طلبك",
          body: `قام البائع بشحن المنتج عبر شركة ${req.body.company}. رقم التتبع: ${req.body.trackingNumber}. سيتم تحويل المبلغ للبائع تلقائياً بعد مرور 7 أيام إذا لم يتم تأكيد الاستلام أو فتح نزاع.`,
          type: "order",
          data: { orderId: order._id }
        });
      } catch (notifErr) {
        console.error("Notification to buyer failed:", notifErr);
      }

      res.json(order);
    } catch (err) {
      console.error("Ship order error:", err);
      res.status(500).json({ error: "حدث خطأ في الخادم أثناء تحديث حالة الشحن." });
    }
  }
);

// 5. المشتري يؤكد الاستلام (Buyer)
router.patch(
  "/:id/confirm-delivery",
  auth,
  requireRole(["buyer", "user"]),
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "الطلب غير موجود." });
      if (order.buyer.toString() !== req.user.id) return res.status(403).json({ error: "غير مسموح لك بهذا الإجراء." });
      
      if (order.status !== "SHIPPED") {
          return res.status(400).json({ 
              error: `لا يمكنك تأكيد الاستلام الآن. حالة الطلب الحالية هي: ${order.status}. يجب أن يقوم البائع بشحن المنتج أولاً.` 
          });
      }

      order.status = "DELIVERED";
      await order.save();

      // تحريك الرصيد من المعلق إلى المتاح للبائع
      try {
        if (!order.seller) {
          throw new Error("بيانات البائع غير متوفرة في الطلب.");
        }
        
        // التأكد من وجود مبلغ صالح للتحرير
        const amountToRelease = Number(order.sellerAmount) || 0;
        if (amountToRelease > 0) {
            await releaseBalance(order.seller, amountToRelease, order._id, order.currency, "PRODUCT");
        }

        // تحرير رصيد الشحن
        if (order.shippingFee > 0 && order.shippingPayer === "buyer") {
          await releaseBalance(order.seller, order.shippingFee, order._id, order.shippingCurrency, "SHIPPING");
        }
      } catch (walletErr) {
        console.error("Wallet balance release failed:", walletErr);
        // نرجع حالة الطلب كما كانت إذا فشل تحرير الرصيد
        try {
          order.status = "SHIPPED";
          await order.save();
        } catch (revertErr) {
          console.error("Critical: Failed to revert order status after wallet failure:", revertErr);
        }
        return res.status(500).json({ 
          error: "فشل تحرير الرصيد للبائع، يرجى المحاولة لاحقاً.",
          details: walletErr.message 
        });
      }
      
      // إشعار للبائع
      try {
        await createNotification(req.app, {
          userId: order.seller,
          title: "تم استلام الطلب",
          body: `أكد المشتري استلام المنتج للطلب #${order._id}. تم نقل الرصيد إلى محفظتك كأرصدة متاحة.`,
          type: "order",
          data: { orderId: order._id }
        });
      } catch (notifErr) {
        console.error("Notification to seller failed:", notifErr);
      }

      res.json(order);
    } catch (err) {
      console.error("Confirm delivery error details:", {
        orderId: req.params.id,
        userId: req.user.id,
        message: err.message,
        stack: err.stack
      });
      res.status(500).json({ 
        error: "حدث خطأ في الخادم أثناء تأكيد الاستلام.",
        details: err.message,
        stack: process.env.NODE_ENV === "development" ? err.stack : undefined
      });
    }
  }
);

// 6. فتح نزاع (Buyer or Seller)
router.post(
  "/:id/dispute",
  auth,
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  validateBody(Joi.object({
    reason: Joi.string().required(),
    details: Joi.string().allow(""),
    evidence: Joi.array().items(Joi.string()).default([])
  })),
  async (req, res) => {
    try {
      const order = await Order.findById(req.params.id);
      if (!order) return res.status(404).json({ error: "الطلب غير موجود." });
      
      // التأكد من أن المستخدم طرف في الطلب
      if (order.buyer.toString() !== req.user.id && order.seller.toString() !== req.user.id) {
          return res.status(403).json({ error: "غير مسموح لك بفتح نزاع على هذا الطلب." });
      }

      // لا يمكن فتح نزاع إذا كان الطلب مكتملاً أو ملغياً
      if (["COMPLETED", "CANCELLED"].includes(order.status)) {
          return res.status(400).json({ error: "لا يمكن فتح نزاع على طلب مكتمل أو ملغى." });
      }

      const dispute = await Dispute.create({
        order: order._id,
        openedBy: req.user.id,
        ...req.body
      });

      order.status = "DISPUTED";
      await order.save();

      // إشعار لحظي للأدمن
      try {
        const initiator = await User.findById(req.user.id).select("name").lean();
        const adminNotif = await AdminNotification.create({
          type: "dispute",
          title: "نزاع جديد",
          message: `قام ${initiator?.name || "مستخدم"} بفتح نزاع على الطلب #${order._id.toString().slice(-6).toUpperCase()}`,
          link: "/admin/escrow",
          data: { disputeId: dispute._id, orderId: order._id }
        });

        const io = req.app.get("io");
        if (io) io.emit("admin_notification:new", adminNotif);
      } catch (notifErr) {
        console.error("Admin dispute notification failed:", notifErr);
      }

      // إرسال إيميل للأدمن
      try {
        const initiator = await User.findById(req.user.id).select("name email phone").lean();
        
        await sendEmail({
          subject: `⚠️ نزاع جديد - طلب #${order._id.toString().slice(-6).toUpperCase()}`,
          html: `
            <div dir="rtl" style="font-family: 'Tajawal', sans-serif; padding: 20px; background-color: #fef2f2; color: #991b1b;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; padding: 30px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                <div style="text-align: center; margin-bottom: 25px;">
                  <span style="background-color: #fee2e2; color: #ef4444; padding: 8px 20px; border-radius: 12px; font-weight: 900; font-size: 12px; letter-spacing: 1px;">تنبيه نزاع جديد</span>
                  <h2 style="margin-top: 15px; color: #0f172a; font-size: 24px; font-weight: 900;">تم فتح نزاع جديد يتطلب التدخل</h2>
                </div>

                <div style="background-color: #f1f5f9; border-radius: 20px; padding: 20px; margin-bottom: 25px;">
                  <div style="margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <span style="color: #64748b; font-size: 12px; font-weight: bold;">رقم الطلب:</span>
                    <span style="float: left; color: #0f172a; font-weight: 900;">#${order._id.toString().toUpperCase()}</span>
                  </div>
                  <div style="margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <span style="color: #64748b; font-size: 12px; font-weight: bold;">بواسطة:</span>
                    <span style="float: left; color: #0f172a; font-weight: 900;">${initiator?.name}</span>
                  </div>
                  <div style="margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">
                    <span style="color: #64748b; font-size: 12px; font-weight: bold;">السبب:</span>
                    <span style="float: left; color: #ef4444; font-weight: 900;">${req.body.reason}</span>
                  </div>
                </div>

                <div style="text-align: center;">
                  <a href="${process.env.FRONTEND_URL}/admin/escrow" style="display: inline-block; background-color: #ef4444; color: #ffffff; padding: 14px 30px; border-radius: 16px; text-decoration: none; font-weight: 900; font-size: 14px; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);">فتح لوحة التحكم</a>
                </div>
              </div>
            </div>
          `
        });
      } catch (emailErr) {
        console.error("Admin dispute email failed:", emailErr);
      }

      // إشعار للطرف الآخر وللإدارة
      const otherPartyId = order.buyer.toString() === req.user.id ? order.seller : order.buyer;
      await createNotification(req.app, {
        userId: otherPartyId,
        title: "تم فتح نزاع على طلب",
        body: `قام الطرف الآخر بفتح نزاع على الطلب #${order._id}. سيتم مراجعة الأمر من قبل الإدارة.`,
        type: "order",
        data: { orderId: order._id }
      });

      res.status(201).json(dispute);
    } catch (err) {
        console.error("Open dispute error:", err);
        res.status(500).json({ error: "حدث خطأ في الخادم." });
    }
  }
);

// جلب طلبات المشتري
router.get("/buyer", auth, async (req, res) => {
  try {
    const orders = await Order.find({ buyer: req.user.id, isDeleted: { $ne: true } })
      .populate("ad", "title images price")
      .populate("seller", "name")
      .sort({ createdAt: -1 })
      .lean();
    res.json(orders);
  } catch {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

// جلب طلبات البائع
router.get("/seller", auth, async (req, res) => {
  try {
    const orders = await Order.find({ seller: req.user.id, isDeleted: { $ne: true } })
      .populate("ad", "title images price")
      .populate("buyer", "name")
      .sort({ createdAt: -1 })
      .lean();
    res.json(orders);
  } catch {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

// جلب تفاصيل طلب واحد
router.get("/:id", auth, validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("ad", "title images price description")
      .populate("buyer", "name email phone")
      .populate("seller", "name email phone")
      .lean();
    
    if (!order) return res.status(404).json({ error: "الطلب غير موجود." });
    
    // التحقق من أن المستخدم طرف في الطلب أو مسؤول
    if (order.buyer._id.toString() !== req.user.id && order.seller._id.toString() !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({ error: "غير مسموح لك بعرض هذا الطلب." });
    }
    
    res.json(order);
  } catch {
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

export default router;
