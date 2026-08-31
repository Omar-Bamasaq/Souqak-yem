import { Router } from "express";
import path from "path";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import Plan from "../models/Plan.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import User from "../models/User.js";
import Ad from "../models/Ad.js";
import Notification from "../models/Notification.js";
import { createNotification } from "../services/notificationService.js";
import AdminNotification from "../models/AdminNotification.js";
import { uploadReceipt, processImage } from "../middleware/upload.js";
import { sendEmail } from "../utils/sendEmail.js";
import { getFinalPrice } from "../utils/planUtils.js";
import SystemSettings from "../models/SystemSettings.js";

const router = Router();

router.get("/mine", auth, async (req, res) => {
  try {
    const prs = await PurchaseRequest.find({ user: req.user.id })
      .populate("plan", "name type durationInDays price")
      .populate("product", "title")
      .sort({ createdAt: -1 })
      .lean();
    res.json(prs);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", auth, requireRole(["seller"]), uploadReceipt, async (req, res) => {
  try {
    const planId = req.body?.planId;
    const productId = req.body?.productId;
    const receiptFile = req.files?.[0];
    const plan = await Plan.findById(planId).lean();
    if (!plan || !plan.isActive) return res.status(400).json({ error: "خطة غير صالحة" });
    
    const priceDetails = getFinalPrice(plan);
    
    if (plan.type === "featured" && !productId) return res.status(400).json({ error: "يجب اختيار إعلان" });
    if (plan.type === "featured" && !receiptFile) return res.status(400).json({ error: "يجب رفع سند الدفع" });

    if (plan.type === "featured" && productId) {
      const ad = await Ad.findById(productId).lean();
      if (!ad) return res.status(400).json({ error: "إعلان غير صالح" });
      if (String(ad.userId) !== String(req.user.id)) return res.status(403).json({ error: "غير مصرح" });
    }

    let paymentReceipt = undefined;
    if (receiptFile && (plan.type === "featured" || plan.type === "verification")) {
      const processed = await processImage(receiptFile.path, "receipts");
      paymentReceipt = `receipts/${path.basename(processed)}`;
    }

    const pr = await PurchaseRequest.create({
      user: req.user.id,
      plan: plan._id,
      product: productId || undefined,
      paymentReceipt: (plan.type === "featured" || plan.type === "verification") ? paymentReceipt : undefined,
      status: (plan.type === "featured" || plan.type === "verification") ? "Pending" : "Approved",
      price: priceDetails.finalPrice,
      originalPrice: priceDetails.originalPrice,
      currency: plan.currency
    });

    if (plan.type === "featured" || plan.type === "verification") {
      await createNotification(req.app, {
        userId: req.user.id,
        type: "purchase_approved",
        title: "تم استلام طلبك",
        body: `تم استلام طلب ${plan.type === 'featured' ? 'تمييز الإعلان' : 'توثيق الحساب'} وهو قيد المراجعة حالياً.`,
        data: { requestId: pr._id }
      });
    }

    // إنشاء إشعار للأدمن (Realtime)
    if (plan.type === "featured" || plan.type === "verification") {
      try {
        const requester = await User.findById(req.user.id).select("name").lean();
        const typeLabel = plan.type === "featured" ? "تمييز إعلان" : "توثيق حساب";
        const adminNotif = await AdminNotification.create({
          type: plan.type,
          title: `طلب ${typeLabel} جديد`,
          message: `طلب ${typeLabel} من المستخدم: ${requester?.name || "غير معروف"}`,
          link: plan.type === "featured" ? "/admin/featured-requests" : "/admin/verification-requests",
          data: { requestId: pr._id }
        });
        const io = req.app.get("io");
        if (io) io.emit("admin_notification:new", adminNotif);
      } catch (err) {
        console.error("فشل إنشاء إشعار الأدمن:", err);
      }
    }

    // إرسال إشعار للأدمن (بشكل غير متزامن)
    if (plan.type === "featured" || plan.type === "verification") {
      User.findById(req.user.id).select("name").lean().then(requester => {
        const typeLabel = plan.type === "featured" ? "تمييز إعلان" : "توثيق حساب";
        sendEmail({
          subject: `طلب ${typeLabel} جديد`,
          html: `
            <div dir="rtl" style="font-family: sans-serif; padding: 20px; background-color: #f9fafb;">
              <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #d97706; margin-bottom: 20px;">طلب ${typeLabel} جديد</h2>
                <p style="font-size: 16px; color: #374151;">وصل طلب ${typeLabel} جديد للمنصة:</p>
                <div style="background-color: #fffbeb; border-right: 4px solid #d97706; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <p style="margin: 5px 0;"><strong>اسم المستخدم:</strong> ${requester?.name || "غير متوفر"}</p>
                  <p style="margin: 5px 0;"><strong>نوع الباقة:</strong> ${plan.name}</p>
                </div>
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${process.env.FRONTEND_URL || "https://souqak-yem.com"}/admin" style="background-color: #d97706; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">فتح لوحة تحكم الأدمن</a>
                </div>
              </div>
            </div>
          `
        });
      }).catch(err => console.error("فشل في إشعار الأدمن:", err));
    }

    if (plan.type === "featured" && productId) {
      // Nothing here yet, waits for approval
    }

    res.status(201).json(pr);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/approve", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const pr = await PurchaseRequest.findById(req.params.id).populate("plan").lean();
    if (!pr) return res.status(404).json({ error: "Not found" });
    if (pr.status === "Approved") return res.json(pr);
    const plan = pr.plan;
    const updatedPR = await PurchaseRequest.findByIdAndUpdate(pr._id, { status: "Approved" }, { new: true }).lean();
    if (plan.type === "verification") {
      const expires = new Date(Date.now() + plan.durationInDays * 24 * 60 * 60 * 1000);
      await User.findByIdAndUpdate(pr.user, { 
        isVerifiedSeller: true, 
        verified: true, 
        verificationStatus: "verified",
        verificationDate: new Date(),
        verificationExpiryDate: expires,
        verifiedAt: new Date(), 
        verificationExpiresAt: expires 
      });
    } else if (plan.type === "featured" && pr.product) {
      const expires = new Date(Date.now() + plan.durationInDays * 24 * 60 * 60 * 1000);
      // Ensure the ad is updated and the featured status is set correctly
      const ad = await Ad.findByIdAndUpdate(pr.product, { 
        $set: {
          featured: true, 
          featuredUntil: expires, 
          featuredAt: new Date(), 
          featuredExpiresAt: expires,
          status: "approved" // Force approved status if it was pending
        }
      });

      // Track conversion if this ad had a welcome promotion
      if (ad && ad.welcomePromotionStartDate) {
        const settings = await SystemSettings.getSettings();
        if (settings.welcomePromotion && settings.welcomePromotion.stats) {
          settings.welcomePromotion.stats.totalConversions += 1;
          settings.welcomePromotion.stats.purchasedAfterTrialCount += 1;
          await settings.save();
        }
      }
    }
    await createNotification(req.app, {
      userId: pr.user,
      type: "purchase_approved",
      title: "تم قبول طلبك",
      body: plan.type === "featured" ? "تم قبول طلب تمييز إعلانك بنجاح." : "تم قبول طلب التوثيق بنجاح.",
      data: { purchaseRequestId: pr._id }
    });
    res.json(updatedPR);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/reject", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const { rejectionReason } = req.body || {};
    const pr = await PurchaseRequest.findById(req.params.id).lean();
    if (!pr) return res.status(404).json({ error: "Not found" });
    if (pr.status === "Rejected") return res.json(pr);
    const updatedPR = await PurchaseRequest.findByIdAndUpdate(pr._id, { status: "Rejected", rejectionReason: rejectionReason || "" }, { new: true }).lean();
    await createNotification(req.app, {
      userId: pr.user,
      type: "purchase_rejected",
      title: "تم رفض طلبك",
      body: rejectionReason || "تم رفض طلبك من قبل الإدارة.",
      data: { purchaseRequestId: pr._id, rejectionReason }
    });
    res.json(updatedPR);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
