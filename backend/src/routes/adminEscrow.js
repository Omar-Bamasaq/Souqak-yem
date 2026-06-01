import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import Order from "../models/Order.js";
import Ad from "../models/Ad.js";
import Withdrawal from "../models/Withdrawal.js";
import Dispute from "../models/Dispute.js";
import Conversation from "../models/Conversation.js";
import ConversationMessage from "../models/ConversationMessage.js";
import AdminEscrowLog from "../models/AdminEscrowLog.js";
import Transaction from "../models/Transaction.js";
import { 
  addPendingBalance,
  releaseBalance, 
  refundAvailableBalance, 
  adminAdjustBalance, 
  removePendingBalance 
} from "../services/walletService.js";
import Joi from "joi";
import { validateBody, validateParams } from "../middleware/validate.js";
import { createNotification } from "../services/notificationService.js";

const router = Router();

// Middleware لضمان أن المستخدم مسؤول
router.use(auth, requireRole(["admin"]));

// 1. عرض جميع طلبات الشراء الآمن (Dashboard)
router.get("/orders", async (req, res) => {
  try {
    const { status, page = 1, limit = 20, includeDeleted } = req.query;
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (includeDeleted !== "true") {
      filter.isDeleted = { $ne: true };
    }
    
    const orders = await Order.find(filter)
      .populate("buyer", "name email")
      .populate("seller", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    
    const total = await Order.countDocuments(filter);
    
    res.json({ orders, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("Admin orders fetch error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم أثناء جلب الطلبات." });
  }
});

// 2. تأكيد استلام الدفع من المشتري (Manual Confirm)
router.patch(
  "/orders/:id/confirm-payment",
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  async (req, res) => {
    try {
      // استخدام findOneAndUpdate مع الحالة لضمان عدم التكرار (Idempotency)
      const order = await Order.findOneAndUpdate(
        { _id: req.params.id, status: "AWAITING_PAYMENT_CONFIRMATION" },
        { 
          status: "PAID_CONFIRMED",
          verifiedByAdminId: req.user.id,
          verifiedAt: new Date()
        },
        { new: true }
      );

      if (!order) {
          // قد يكون الطلب غير موجود أو تم تأكيده مسبقاً من مسؤول آخر
          return res.status(400).json({ error: "الطلب غير موجود أو تم معالجته مسبقاً." });
      }

      // تسجيل العملية في سجل الإدارة
      await AdminEscrowLog.create({
        admin: req.user.id,
        actionType: "CONFIRM_PAYMENT",
        targetType: "Order",
        targetId: order._id,
        ipAddress: req.ip
      });

      // تحديث حالة الإعلان (Listing Visibility Logic)
      try {
        await Ad.findByIdAndUpdate(order.ad, {
          status: "SOLD",
          isVisible: false,
          sold: true,
          soldAt: new Date()
        });
      } catch (adErr) {
        console.error("Failed to update ad visibility on payment confirm:", adErr);
      }

      // إضافة رصيد معلق للبائع
      try {
        if (!order.seller) {
          throw new Error("بيانات البائع غير متوفرة في الطلب.");
        }
        
        // 1. إضافة رصيد المنتج
        const productAmount = Number(order.sellerAmount) || 0;
        await addPendingBalance(order.seller, productAmount, order._id, order.currency, "PRODUCT");
        
        // 2. إضافة رصيد الشحن (كعملية منفصلة دائماً إذا كان المشتري هو من يدفعه)
        if (order.shippingFee > 0 && order.shippingPayer === "buyer") {
          await addPendingBalance(order.seller, order.shippingFee, order._id, order.shippingCurrency, "SHIPPING");
        }
      } catch (walletErr) {
        console.error("Wallet pending balance update failed:", walletErr);
        // نرجع حالة الطلب كما كانت إذا فشل تحديث المحفظة
        try {
          order.status = "AWAITING_PAYMENT_CONFIRMATION";
          await order.save();
        } catch (revertErr) {
          console.error("Critical: Failed to revert order status in adminEscrow:", revertErr);
        }
        return res.status(500).json({ 
          error: "فشل تحديث رصيد البائع في المحفظة.",
          details: walletErr.message 
        });
      }

      // إشعار للبائع
      try {
        await createNotification(req.app, {
          userId: order.seller,
          title: "تم تأكيد الدفع",
          body: `تم تأكيد استلام المبلغ لطلبك #${order._id}. يرجى شحن المنتج الآن.`,
          type: "order",
          data: { orderId: order._id }
        });
      } catch (notifErr) {
        console.error("Notification to seller failed:", notifErr);
      }

      // إشعار للمشتري
      try {
        await createNotification(req.app, {
          userId: order.buyer,
          title: "تم تأكيد عملية الدفع",
          body: `تم تأكيد حوالتك بنجاح للطلب #${order._id}. بانتظار البائع لشحن المنتج.`,
          type: "order",
          data: { orderId: order._id }
        });
      } catch (notifErr) {
        console.error("Notification to buyer failed:", notifErr);
      }

      res.json(order);
    } catch (err) {
      console.error("Admin confirm payment error:", err);
      res.status(500).json({ 
        error: "حدث خطأ في الخادم أثناء تأكيد الدفع.",
        details: err.message
      });
    }
  }
);

// 2.1 رفض استلام الدفع (Admin Reject)
router.patch(
  "/orders/:id/reject-payment",
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  validateBody(Joi.object({ reason: Joi.string().required() })),
  async (req, res) => {
    try {
      const order = await Order.findOneAndUpdate(
        { _id: req.params.id, status: "AWAITING_PAYMENT_CONFIRMATION" },
        { 
          status: "AWAITING_PAYMENT", // إعادة الطلب لحالة بانتظار الدفع
          verifiedByAdminId: req.user.id,
          verifiedAt: new Date(),
          $set: { 
            notes: `رفض الدفع: ${req.body.reason}` 
          }
        },
        { new: true }
      );

      if (!order) return res.status(400).json({ error: "الطلب غير موجود أو معالج مسبقاً." });

      await AdminEscrowLog.create({
        admin: req.user.id,
        actionType: "REJECT_PAYMENT",
        targetType: "Order",
        targetId: order._id,
        details: { reason: req.body.reason },
        ipAddress: req.ip
      });

      // إعادة إظهار الإعلان عند رفض الدفع (Listing Visibility Logic)
      try {
        await Ad.findByIdAndUpdate(order.ad, {
          status: "AVAILABLE",
          isVisible: true,
          sold: false
        });
      } catch (adErr) {
        console.error("Failed to restore ad visibility on payment reject:", adErr);
      }

      // إشعار للمشتري
      await createNotification(req.app, {
        userId: order.buyer,
        title: "تم رفض عملية الدفع",
        body: `تم رفض بيانات الحوالة للطلب #${order._id}. السبب: ${req.body.reason}. يرجى إعادة إرسال البيانات الصحيحة.`,
        type: "order",
        data: { orderId: order._id }
      });

      res.json(order);
    } catch (err) {
      console.error("Admin reject payment error:", err);
      res.status(500).json({ error: "حدث خطأ في الخادم." });
    }
  }
);

// 3. عرض طلبات السحب المعلقة
router.get("/withdrawals", async (req, res) => {
  try {
    const { includeDeleted } = req.query || {};
    const filter = {};
    if (includeDeleted !== "true") {
      filter.isDeleted = { $ne: true };
    }
    const withdrawals = await Withdrawal.find(filter)
      .populate("user", "name email phone")
      .sort({ createdAt: -1 })
      .lean();
    res.json(withdrawals);
  } catch (err) {
    console.error("Admin withdrawals fetch error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم أثناء جلب طلبات السحب." });
  }
});

// 4. بدء معالجة طلب السحب (PENDING -> PROCESSING)
router.patch(
  "/withdrawals/:id/process",
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  async (req, res) => {
    try {
      const withdrawal = await Withdrawal.findOneAndUpdate(
        { _id: req.params.id, status: "PENDING" },
        { status: "PROCESSING" },
        { new: true }
      );

      if (!withdrawal) return res.status(400).json({ error: "طلب السحب غير موجود أو معالج مسبقاً." });

      await AdminEscrowLog.create({
        admin: req.user.id,
        actionType: "START_WITHDRAWAL_PROCESSING",
        targetType: "Withdrawal",
        targetId: withdrawal._id,
        ipAddress: req.ip
      });

      res.json(withdrawal);
    } catch (err) {
      console.error("Admin start withdrawal processing error:", err);
      res.status(500).json({ error: "حدث خطأ في الخادم أثناء معالجة طلب السحب." });
    }
  }
);

// 5. إكمال عملية السحب (بعد التحويل الفعلي للبائع)
router.patch(
  "/withdrawals/:id/complete",
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  validateBody(Joi.object({
    transactionProof: Joi.string().allow(""),
    adminNotes: Joi.string().allow("")
  })),
  async (req, res) => {
    try {
      const withdrawal = await Withdrawal.findOne({ _id: req.params.id, status: "PROCESSING" });
      if (!withdrawal) return res.status(400).json({ error: "يجب تحويل حالة الطلب إلى 'قيد المعالجة' أولاً." });

      const amount = withdrawal.amount;
      const withdrawFee = 0; // العمولة مخصومة مسبقاً من البداية
      const finalAmount = amount;

      withdrawal.status = "COMPLETED";
      withdrawal.transactionProof = req.body.transactionProof;
      withdrawal.adminNotes = req.body.adminNotes;
      withdrawal.feeAmount = withdrawFee;
      withdrawal.finalAmount = finalAmount;
      withdrawal.processedAt = new Date();
      await withdrawal.save();

      await AdminEscrowLog.create({
        admin: req.user.id,
        actionType: "COMPLETE_WITHDRAWAL",
        targetType: "Withdrawal",
        targetId: withdrawal._id,
        ipAddress: req.ip
      });

      // تسجيل العمليات في Ledger
      // تحديث المعاملة المعلقة الأصلية (التي تم إنشاؤها عند طلب السحب)
      try {
        await Transaction.findOneAndUpdate(
          { user: withdrawal.user, type: "WITHDRAWAL", status: "PENDING", amount: -amount },
          { status: "FAILED", description: `تم استبدالها بمعاملات الصافي والعمولة لطلب #${withdrawal._id}` }
        );
      } catch (e) { console.error("Update pending tx failed:", e); }

      // 1. عملية السحب (المبلغ الصافي)
      await Transaction.create({
        user: withdrawal.user,
        type: "WITHDRAWAL",
        amount: -finalAmount,
        currency: withdrawal.currency || "YER",
        balanceType: "available",
        description: `سحب رصيد (صافي) - طلب #${withdrawal._id}`,
        status: "COMPLETED"
      });

      // 2. عملية العمولة (0% لأنها خصمت عند الطلب)
      if (withdrawFee > 0) {
        await Transaction.create({
          user: withdrawal.user,
          type: "WITHDRAW_FEE",
          amount: -withdrawFee,
          currency: withdrawal.currency || "YER",
          balanceType: "available",
          description: `عمولة سحب رصيد - طلب #${withdrawal._id}`,
          status: "COMPLETED"
        });
      }

      // إشعار للمستخدم
      await createNotification(req.app, {
        userId: withdrawal.user,
        title: "تم إكمال طلب السحب ✅",
        body: `تم تحويل مبلغ ${amount.toLocaleString()} ${withdrawal.currency || "YER"} إلى حسابك بنجاح. شكراً لثقتك بسوقك!`,
        type: "wallet",
        data: { withdrawalId: withdrawal._id }
      });

      res.json(withdrawal);
    } catch (err) {
      console.error("Complete withdrawal error:", err);
      res.status(500).json({ error: "حدث خطأ في الخادم." });
    }
  }
);

// 6. رفض عملية السحب (وإعادة الرصيد للمحفظة)
router.patch(
  "/withdrawals/:id/reject",
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  validateBody(Joi.object({ adminNotes: Joi.string().required() })),
  async (req, res) => {
    try {
      // الرفض متاح من حالة PENDING أو PROCESSING
      const withdrawal = await Withdrawal.findOneAndUpdate(
        { _id: req.params.id, status: { $in: ["PENDING", "PROCESSING"] } },
        { 
          status: "REJECTED",
          adminNotes: req.body.adminNotes,
          processedAt: new Date()
        },
        { new: true }
      );

      if (!withdrawal) return res.status(400).json({ error: "طلب السحب غير موجود أو معالج مسبقاً." });

      await AdminEscrowLog.create({
        admin: req.user.id,
        actionType: "REJECT_WITHDRAWAL",
        targetType: "Withdrawal",
        targetId: withdrawal._id,
        details: { reason: req.body.adminNotes },
        ipAddress: req.ip
      });

      // إعادة الرصيد للمحفظة
      await refundAvailableBalance(withdrawal.user, withdrawal.amount, `إعادة رصيد لرفض طلب السحب: ${req.body.adminNotes}`, withdrawal.currency);

      // تحديث المعاملة المعلقة الأصلية لتصبح فشلت
      try {
        await Transaction.findOneAndUpdate(
          { user: withdrawal.user, type: "WITHDRAWAL", status: "PENDING", amount: -withdrawal.amount, currency: withdrawal.currency },
          { status: "FAILED", description: `تم رفض السحب: ${req.body.adminNotes}` }
        );
      } catch (e) { console.error("Update pending tx failed on reject:", e); }

      // إشعار للمستخدم
      await createNotification(req.app, {
        userId: withdrawal.user,
        title: "تم رفض طلب السحب",
        body: `تم رفض طلب السحب الخاص بك. السبب: ${req.body.adminNotes}. تم إعادة الرصيد لمحفظتك.`,
        type: "wallet",
        data: { withdrawalId: withdrawal._id }
      });

      res.json(withdrawal);
    } catch (err) {
      console.error("Admin reject withdrawal error:", err);
      res.status(500).json({ error: "حدث خطأ في الخادم أثناء رفض طلب السحب." });
    }
  }
);

// 6. عرض النزاعات
router.get("/disputes", async (req, res) => {
  try {
    const { includeDeleted } = req.query || {};
    const filter = {};
    if (includeDeleted !== "true") {
      filter.isDeleted = { $ne: true };
    }
    const disputes = await Dispute.find(filter)
      .populate({
          path: "order",
          populate: [{ path: "buyer", select: "name email" }, { path: "seller", select: "name email" }]
      })
      .populate("openedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();
    res.json(disputes);
  } catch (err) {
    console.error("Admin disputes fetch error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم أثناء جلب النزاعات." });
  }
});

// 7. إنشاء أو جلب غرفة محادثة النزاع
router.post(
  "/disputes/:id/chat",
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  async (req, res) => {
    try {
      const dispute = await Dispute.findById(req.params.id).populate("order");
      if (!dispute) return res.status(404).json({ error: "النزاع غير موجود" });

      const order = dispute.order;
      const adminId = req.user.id;
      const buyerId = order.buyer;
      const sellerId = order.seller;

      // البحث عن محادثة قائمة لهذا النزاع
      let conv = await Conversation.findOne({ 
        disputeId: dispute._id,
        type: "DISPUTE"
      });

      if (!conv) {
        conv = await Conversation.create({
          type: "DISPUTE",
          disputeId: dispute._id,
          title: `نزاع طلب #${order._id.toString().slice(-6)}`,
          participants: [buyerId, sellerId, adminId],
          adId: order.ad,
          adModel: "Ad",
          lastMessage: "تم إنشاء غرفة محادثة النزاع من قبل الإدارة"
        });

        // رسالة ترحيبية
        await ConversationMessage.create({
          conversationId: conv._id,
          senderId: adminId,
          text: `مرحباً، تم فتح هذه المحادثة لمناقشة النزاع على الطلب #${order._id.toString().slice(-6)}. يرجى من الطرفين تقديم أي توضيحات إضافية هنا.`
        });

        // إرسال إشعارات للأطراف
        const notificationData = {
          title: "غرفة محادثة النزاع",
          body: `تم فتح غرفة محادثة لمناقشة النزاع على الطلب #${order._id.toString().slice(-6)}.`,
          type: "message",
          data: { conversationId: conv._id }
        };

        await createNotification(req.app, {
          userId: buyerId,
          ...notificationData
        });

        await createNotification(req.app, {
          userId: sellerId,
          ...notificationData
        });
      }

      res.json(conv);
    } catch (err) {
      console.error("Dispute chat error:", err);
      res.status(500).json({ error: "حدث خطأ في الخادم" });
    }
  }
);

// 8. إغلاق غرفة محادثة النزاع
router.patch(
  "/disputes/:id/close-chat",
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  async (req, res) => {
    try {
      const conv = await Conversation.findOneAndUpdate(
        { disputeId: req.params.id, type: "DISPUTE" },
        { isClosed: true, closedAt: new Date() },
        { new: true }
      );
      if (!conv) return res.status(404).json({ error: "محادثة النزاع غير موجودة" });
      res.json(conv);
    } catch (err) {
      console.error("Admin close dispute chat error:", err);
      res.status(500).json({ error: "حدث خطأ في الخادم أثناء إغلاق محادثة النزاع." });
    }
});

// 10. إكمال الطلب يدوياً (تحرير الرصيد)
router.patch(
  "/orders/:id/complete",
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  async (req, res) => {
    try {
      const order = await Order.findOneAndUpdate(
        { _id: req.params.id, status: { $in: ["SHIPPED", "DELIVERED", "PAID_CONFIRMED"] } },
        { status: "COMPLETED" },
        { new: true }
      );

      if (!order) return res.status(400).json({ error: "الطلب غير جاهز للإكمال." });

      // تحرير الرصيد (المنتج والشحن) كعمليات منفصلة
      const productAmount = Number(order.sellerAmount) || 0;
      await releaseBalance(order.seller, productAmount, order._id, order.currency, "PRODUCT");
      
      if (order.shippingFee > 0 && order.shippingPayer === "buyer") {
        await releaseBalance(order.seller, order.shippingFee, order._id, order.shippingCurrency, "SHIPPING");
      }

      res.json(order);
    } catch (err) {
      console.error("Admin manual complete order error:", err);
      res.status(500).json({ error: "حدث خطأ في الخادم أثناء إكمال الطلب يدوياً." });
    }
  }
);

// 11. حل النزاع (Admin)
router.patch(
  "/disputes/:id/resolve",
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  validateBody(Joi.object({
    resolution: Joi.string().valid("RELEASE_TO_SELLER", "REFUND_TO_BUYER").required(),
    notes: Joi.string().required()
  })),
  async (req, res) => {
    try {
      const { resolution, notes } = req.body;
      const dispute = await Dispute.findOneAndUpdate(
        { _id: req.params.id, status: "OPEN" },
        { 
          status: resolution === "RELEASE_TO_SELLER" ? "RESOLVED_SELLER" : "RESOLVED_BUYER",
          resolutionNotes: notes,
          resolvedAt: new Date()
        },
        { new: true }
      ).populate("order");

      if (!dispute) return res.status(400).json({ error: "النزاع غير موجود أو تم حله مسبقاً." });

      const order = dispute.order;
      
      if (resolution === "RELEASE_TO_SELLER") {
          // تحرير المبلغ للبائع (سواء كان في حالة الدفع أو الشحن)
          const oldStatus = order.status;
          order.status = "COMPLETED";
          await order.save();
          
          // تحويل الرصيد للمتاح
          try {
            const amountToRelease = Number(order.sellerAmount) || 0;
            await releaseBalance(order.seller, amountToRelease, order._id, order.currency, "PRODUCT");

            // تحرير رصيد الشحن أيضاً
            if (order.shippingFee > 0 && order.shippingPayer === "buyer") {
              await releaseBalance(order.seller, order.shippingFee, order._id, order.shippingCurrency, "SHIPPING");
            }
          } catch (walletErr) {
            console.error("Resolve dispute releaseBalance failed:", walletErr);
            // Revert status
            try {
              order.status = oldStatus;
              await order.save();
            } catch (revertErr) {
              console.error("Critical: Failed to revert order status in resolve dispute:", revertErr);
            }
            throw walletErr; // Will be caught by outer catch
          }
      } else {
          // استرداد للمشتري (إلغاء الطلب)
          const oldStatus = order.status;
          order.status = "CANCELLED";
          await order.save();

          // إعادة الرصيد للمشتري
          try {
            await refundAvailableBalance(
              order.buyer, 
              order.totalAmount, 
              `استرداد كامل للطلب #${order._id} (حل نزاع لصالح المشتري)`, 
              order.currency,
              order._id // تمرير الـ orderId لربط المعاملة بالطلب لضمان دقة المحاسبة
            );

            // إزالة الرصيد المعلق من البائع (لأنه تم إلغاء الطلب بعد تأكيد الدفع)
            const productAmount = Number(order.sellerAmount) || 0;
            if (productAmount > 0) {
              await removePendingBalance(order.seller, productAmount, order._id, order.currency, "PRODUCT");
            }
            if (order.shippingFee > 0 && order.shippingPayer === "buyer") {
              await removePendingBalance(order.seller, order.shippingFee, order._id, order.shippingCurrency, "SHIPPING");
            }
          } catch (walletErr) {
            console.error("Resolve dispute refund/remove pending failed:", walletErr);
            // Revert status
            try {
              order.status = oldStatus;
              await order.save();
            } catch (revertErr) {
              console.error("Critical: Failed to revert order status in resolve dispute refund:", revertErr);
            }
            throw walletErr;
          }

          // إعادة إظهار الإعلان عند إلغاء الطلب (Listing Visibility Logic)
          try {
            await Ad.findByIdAndUpdate(order.ad, {
              status: "AVAILABLE",
              isVisible: true,
              sold: false
            });
          } catch (adErr) {
            console.error("Failed to restore ad visibility on dispute refund:", adErr);
          }
      }

      // إغلاق محادثة النزاع تلقائياً إن وجدت
      try {
        await Conversation.findOneAndUpdate(
          { disputeId: dispute._id, type: "DISPUTE" },
          { isClosed: true, closedAt: new Date(), lastMessage: "تم إغلاق المحادثة لصدور قرار حل النزاع" }
        );
      } catch (convErr) {
        console.error("Failed to auto-close conversation on dispute resolve:", convErr);
      }

      await AdminEscrowLog.create({
        admin: req.user.id,
        actionType: "RESOLVE_DISPUTE",
        targetType: "Dispute",
        targetId: dispute._id,
        details: { resolution, notes },
        ipAddress: req.ip
      });

      // إشعارات للأطراف
      await createNotification(req.app, {
        userId: order.buyer,
        title: "تم حل النزاع",
        body: `تم حل النزاع على الطلب #${order._id}. القرار: ${resolution === "REFUND_TO_BUYER" ? "استرداد المبلغ لك" : "تحرير المبلغ للبائع"}. ملاحظات: ${notes}`,
        type: "order",
        data: { orderId: order._id }
      });

      await createNotification(req.app, {
        userId: order.seller,
        title: "تم حل النزاع",
        body: `تم حل النزاع على الطلب #${order._id}. القرار: ${resolution === "RELEASE_TO_SELLER" ? "تحرير المبلغ لك" : "إعادة المبلغ للمشتري"}. ملاحظات: ${notes}`,
        type: "order",
        data: { orderId: order._id }
      });

      res.json(dispute);
    } catch (err) {
      console.error("Admin resolve dispute error:", err);
      res.status(500).json({ error: "حدث خطأ في الخادم أثناء حل النزاع." });
    }
  }
);

// 8. تعديل رصيد يدوي (Admin)
router.post(
  "/wallets/:userId/adjust",
  validateParams(Joi.object({ userId: Joi.string().length(24).hex().required() })),
  validateBody(Joi.object({
    amount: Joi.number().required(), // يمكن أن يكون سالباً للخصم
    balanceType: Joi.string().valid("pending", "available").required(),
    reason: Joi.string().required()
  })),
  async (req, res) => {
    try {
      const { amount, balanceType, reason } = req.body;
      const wallet = await adminAdjustBalance(req.params.userId, amount, balanceType, req.user.id, reason);
      
      await AdminEscrowLog.create({
        admin: req.user.id,
        actionType: "MANUAL_ADJUSTMENT",
        targetType: "User",
        targetId: req.params.userId,
        details: { amount, balanceType, reason },
        ipAddress: req.ip
      });

      // إشعار للمستخدم
      await createNotification(req.app, {
        userId: req.params.userId,
        title: "تعديل في الرصيد",
        body: `قامت الإدارة بتعديل رصيدك بمقدار ${amount} YER (${balanceType}). السبب: ${reason}`,
        type: "wallet",
        data: { walletId: wallet._id }
      });

      res.json(wallet);
    } catch (err) {
      console.error("Admin adjust balance error:", err);
      res.status(500).json({ error: "حدث خطأ في الخادم." });
    }
  }
);

// 9. محاسبة النظام (System Balance)
router.get("/system-balance", async (req, res) => {
  try {
    // حساب التدفقات بناءً على ما دفعه المشتري فعلياً (Total Amount)
    // هذا يشمل: سعر المنتج + رسوم حماية المشتري + رسوم الشحن (إذا دفعها المشتري)
    const orderStats = await Order.aggregate([
      { $match: { status: { $in: ["PAID_CONFIRMED", "SHIPPED", "DELIVERED", "COMPLETED"] } } },
      {
        $group: {
          _id: "$currency",
          totalIn: { $sum: "$totalAmount" }
        }
      }
    ]);

    // حساب المعاملات المالية للسحب والاسترداد
    // ملاحظة: لا نحسب WITHDRAW_FEE هنا لأنها تظل في النظام كربح للمنصة ولا تخرج من الحساب البنكي
    const txStats = await Transaction.aggregate([
      {
        $group: {
          _id: "$currency",
          totalOut: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$type", "WITHDRAWAL"] }, { $eq: ["$status", "COMPLETED"] }] },
                { $abs: "$amount" }, // المبلغ الصافي الذي خرج فعلياً
                0
              ]
            }
          },
          totalRefunds: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $eq: ["$type", "REFUND"] }, 
                    { $eq: ["$status", "COMPLETED"] },
                    { $ne: ["$order", null] } // استبعاد المسترجعات التي ليست مرتبطة بطلب (مثل رفض السحب)
                  ] 
                },
                "$amount",
                0
              ]
            }
          }
        }
      }
    ]);

    // دمج البيانات
    const currencies = ["YER", "YER_ADEN", "SAR", "USD"];
    const grossMap = {};
    currencies.forEach(c => grossMap[c] = 0);

    orderStats.forEach(stat => {
      const curr = stat._id || "YER";
      if (grossMap[curr] !== undefined) {
        grossMap[curr] += stat.totalIn;
      }
    });

    const allStats = currencies.map(curr => {
      const t = txStats.find(s => s._id === curr) || { totalOut: 0, totalRefunds: 0 };
      const totalIn = grossMap[curr] || 0;
      
      return {
        _id: curr,
        totalIn,
        totalOut: t.totalOut,
        totalRefunds: t.totalRefunds,
        expectedBalance: totalIn - t.totalOut - t.totalRefunds
      };
    }).filter(s => s.totalIn > 0 || s.totalOut > 0);

    const mainStats = allStats.find(s => s._id === "YER") || allStats[0] || { totalIn: 0, totalOut: 0, totalRefunds: 0, expectedBalance: 0, _id: "YER" };

    res.json({
      ...mainStats,
      allCurrencies: allStats
    });
  } catch (err) {
    console.error("System balance error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم." });
  }
});

export default router;
