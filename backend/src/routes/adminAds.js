import { Router } from "express";
import Ad from "../models/Ad.js";
import AdAttributeValue from "../models/AdAttributeValue.js";
import Favorite from "../models/Favorite.js";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import adminAudit from "../middleware/adminAudit.js";
import { createNotification } from "../services/notificationService.js";
import Joi from "joi";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";

const router = Router();

router.use(auth, requireRole(["admin"]), adminAudit());

router.get("/", auth, requireRole(["admin"]), validateQuery(Joi.object({ 
  status: Joi.string().valid("pending", "approved", "rejected", "sold").optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  q: Joi.string().optional(),
  cityId: Joi.string().optional()
})), async (req, res) => {
  try {
    const { status, page, limit, q, cityId } = req.query || {};
    const query = {};
    if (status) query.status = status;
    if (cityId) query.cityId = cityId;
    if (q) query.title = { $regex: q, $options: "i" };

    const total = await Ad.countDocuments(query);
    const list = await Ad.find(query)
      .populate("userId", "name avatar")
      .populate("cityId", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    res.json({
      ads: list,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch(
  "/:id/status",
  auth,
  requireRole(["admin"]),
  validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })),
  validateBody(Joi.object({ status: Joi.string().valid("pending", "approved", "rejected").required() })),
  async (req, res) => {
  try {
    const { status } = req.body || {};
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: "Not found" });
    ad.status = status;
    if (status === "approved") {
      const now = new Date();
      ad.publishedAt = now;
      ad.expiresAt = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000);
      ad.expireReminderSent = false;
    }
    await ad.save();

    // إرسال إشعار للمستخدم بتحديث حالة إعلانه
    try {
      let title = "";
      let body = "";
      if (status === "approved") {
        title = "تم قبول إعلانك 🎉";
        body = `تهانينا! تم قبول إعلانك "${ad.title}" وهو الآن متاح للجميع.`;
      } else if (status === "rejected") {
        title = "تم رفض إعلانك ⚠️";
        body = `نعتذر منك، تم رفض إعلانك "${ad.title}". يرجى مراجعة سياسات النشر أو تعديل الإعلان.`;
      }

      if (title && body) {
        await createNotification(req.app, {
          userId: ad.userId,
          title,
          body,
          type: "ad_status",
          data: { adId: ad._id, status }
        });
      }
    } catch (notifErr) {
      console.error("Failed to send ad status notification:", notifErr);
    }

    res.json(ad.toObject());
  } catch {
    res.status(400).json({ error: "Update error" });
  }
});

router.delete("/:id", auth, requireRole(["admin"]), validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })), async (req, res) => {
  try {
    await AdAttributeValue.deleteMany({ adId: req.params.id });
    await Favorite.deleteMany({ adId: req.params.id });
    const deleted = await Ad.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
