import { Router } from "express";
import path from "path";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import Commission from "../models/Commission.js";
import Ad from "../models/Ad.js";
import AdminNotification from "../models/AdminNotification.js";
import { uploadCommissionDocs, processImage } from "../middleware/upload.js";
import Joi from "joi";
import { validateBody } from "../middleware/validate.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = Router();

const commissionSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  phone: Joi.string().min(6).max(30).required(),
  salePrice: Joi.number().min(1).required(),
  currency: Joi.string().valid("YER", "YER_ADEN", "YER_SANAA", "SAR", "USD").default("YER_ADEN"),
  adId: Joi.string().length(24).hex().optional(),
});

router.post("/", auth, requireRole(["seller"]), uploadCommissionDocs, async (req, res) => {
  try {
    let { name, phone, salePrice, currency, adId } = req.body || {};

    if (adId && adId.length === 24) {
      const ad = await Ad.findById(adId).lean();
      if (ad) {
        if (!salePrice || Number(salePrice) <= 0) {
          salePrice = ad.price;
        }
        if (!currency) {
          currency = ad.currency;
        }
      }
    }

    // Validate manually since multipart/form-data can be tricky with Joi and multer sometimes
    if (!name || !phone || !salePrice) {
      return res.status(400).json({ error: "Name, phone and salePrice are required" });
    }

    const rawReceipt = req.files?.paymentReceipt?.[0];
    const rawAdImage = req.files?.adImage?.[0];
    if (!rawReceipt) return res.status(400).json({ error: "Payment receipt is required" });

    let paymentReceiptPath = null;
    let adImagePath = null;

    if (rawReceipt) {
      const processed = await processImage(rawReceipt.path, "receipts");
      paymentReceiptPath = `receipts/${path.basename(processed)}`;
    }
    if (rawAdImage) {
      const processed = await processImage(rawAdImage.path, "ads");
      adImagePath = path.basename(processed);
    }
    
    const commissionAmount = Math.round(Number(salePrice) * 0.01);
    const payload = {
      sellerId: req.user.id,
      price: Number(salePrice),
      commissionAmount,
      currency: currency || "YER_ADEN",
      status: "Pending",
      commissionStatus: "pending_review",
      paymentReceipt: paymentReceiptPath,
      adImage: adImagePath,
      payerName: name,
      payerPhone: phone,
      notes: `Name: ${name}, Phone: ${phone}`
    };
    if (adId && adId.length === 24) payload.adId = adId;
    
    let created;
    if (adId && adId.length === 24) {
      // Try to update an existing record (unpaid, overdue, or Rejected) for this ad
      // This prevents creating duplicate commission records for the same sold ad
      created = await Commission.findOneAndUpdate(
        { 
          adId, 
          sellerId: req.user.id, 
          status: { $in: ["unpaid", "overdue", "Rejected", "Pending"] } 
        },
        { $set: payload },
        { new: true, upsert: true }
      );
    } else {
      created = await Commission.create(payload);
    }

    // إنشاء إشعار للأدمن (Realtime)
    try {
      const adminNotif = await AdminNotification.create({
        type: "commission",
        title: "طلب دفع عمولة جديد",
        message: `طلب دفع عمولة جديد من البائع: ${name}`,
        link: "/admin/sold-ads",
        data: { commissionId: created._id }
      });
      const io = req.app.get("io");
      if (io) io.emit("admin_notification:new", adminNotif);
    } catch (err) {
      console.error("فشل إنشاء إشعار الأدمن للعمولة:", err);
    }

    // إرسال إشعار للأدمن (بشكل غير متزامن)
    try {
      let adTitle = "إعلان غير محدد";
      let adMainImage = null;
      if (adId) {
        const ad = await Ad.findById(adId).select("title images").lean();
        if (ad) {
          adTitle = ad.title;
          adMainImage = ad.images?.[0];
        }
      }

      const receiptUrl = `${process.env.BACKEND_URL || "https://souqak-yem.com"}/uploads/${created.paymentReceipt}`;
      const adImageUrl = adMainImage ? `${process.env.BACKEND_URL || "https://souqak-yem.com"}/uploads/${adMainImage}` : null;

      sendEmail({
        subject: "طلب دفع عمولة جديد",
        html: `
          <div dir="rtl" style="font-family: sans-serif; padding: 20px; background-color: #f0fdf4;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; padding: 30px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
              <h2 style="color: #16a34a; margin-bottom: 25px; text-align: center; border-bottom: 2px solid #f0fdf4; padding-bottom: 15px;">طلب دفع عمولة جديد</h2>
              
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <p style="margin: 10px 0; font-size: 16px;"><strong>اسم البائع:</strong> ${name}</p>
                <p style="margin: 10px 0; font-size: 16px;"><strong>رقم الهاتف:</strong> ${phone}</p>
                <p style="margin: 10px 0; font-size: 16px;"><strong>اسم الإعلان:</strong> ${adTitle}</p>
              </div>

              <div style="display: flex; gap: 20px; margin-bottom: 25px; background-color: #ecfdf5; padding: 15px; border-radius: 8px;">
                <div style="flex: 1;">
                  <p style="margin: 0; font-size: 14px; color: #065f46;">سعر البيع</p>
                  <p style="margin: 5px 0; font-size: 20px; font-weight: bold; color: #047857;">${Number(salePrice).toLocaleString()} ${currency || "YER_ADEN"}</p>
                </div>
                <div style="flex: 1; border-right: 2px solid #d1fae5; padding-right: 20px;">
                  <p style="margin: 0; font-size: 14px; color: #065f46;">قيمة العمولة (1%)</p>
                  <p style="margin: 5px 0; font-size: 20px; font-weight: bold; color: #059669;">${commissionAmount.toLocaleString()} ${currency || "YER_ADEN"}</p>
                </div>
              </div>

              <div style="margin-bottom: 25px;">
                <p style="margin-bottom: 10px; font-weight: bold;">المرفقات:</p>
                <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 15px;">
                  <div style="text-align: center;">
                    <p style="font-size: 12px; color: #64748b; margin-bottom: 5px;">سند الدفع</p>
                    <img src="${receiptUrl}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" />
                  </div>
                  ${adImageUrl ? `
                  <div style="text-align: center;">
                    <p style="font-size: 12px; color: #64748b; margin-bottom: 5px;">صورة الإعلان</p>
                    <img src="${adImageUrl}" style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #e2e8f0;" />
                  </div>
                  ` : ''}
                </div>
              </div>

              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL || "https://souqak-yem.com"}/admin/sold-ads" style="background-color: #16a34a; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(22, 163, 74, 0.2);">مراجعة الطلبات في لوحة التحكم</a>
              </div>
            </div>
          </div>
        `
      });
    } catch (mailErr) {
      console.error("فشل إرسال إشعار العمولة بريدياً:", mailErr);
    }

    res.status(201).json(created);
  } catch (error) {
    console.error("Create commission error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/mine", auth, async (req, res) => {
  try {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await Commission.updateMany(
      { 
        sellerId: req.user.id, 
        status: "unpaid", 
        soldAt: { $lt: tenDaysAgo } 
      },
      { $set: { status: "overdue" } }
    );

    // 2. Fetch all commissions
    const items = await Commission.find({ sellerId: req.user.id, isDeleted: { $ne: true } })
      .populate("adId", "title images price")
      .sort({ createdAt: -1 })
      .lean();
    res.json(items);
  } catch (error) {
    console.error("Get mine commissions error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/status-summary", auth, async (req, res) => {
  try {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    
    // Auto-update status first
    await Commission.updateMany(
      { sellerId: req.user.id, status: "unpaid", soldAt: { $lt: tenDaysAgo } },
      { $set: { status: "overdue" } }
    );

    const unpaid = await Commission.find({ 
      sellerId: req.user.id, 
      status: { $in: ["unpaid", "overdue"] } 
    }).lean();

    const summary = {
      unpaidCount: unpaid.filter(c => c.status === "unpaid").length,
      overdueCount: unpaid.filter(c => c.status === "overdue").length,
      totalUnpaidAmount: unpaid.reduce((sum, c) => sum + (c.commissionAmount || 0), 0),
      currency: unpaid.length > 0 ? unpaid[0].currency : "YER_ADEN",
      firstUnpaidAdId: unpaid.length === 1 ? unpaid[0].adId : null
    };

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
