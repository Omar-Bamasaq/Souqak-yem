import { Router } from "express";
import Joi from "joi";
import PlatformReview from "../models/PlatformReview.js";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { validateBody } from "../middleware/validate.js";
import rateLimit from "../middleware/rateLimit.js";

const router = Router();

// 1. إرسال تقييم للمنصة
router.post(
  "/",
  auth,
  rateLimit({ windowMs: 24 * 60 * 60 * 1000, max: 1 }), // تقييم واحد كل 24 ساعة لكل مستخدم
  validateBody(Joi.object({
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().trim().max(1000).allow(""),
    category: Joi.string().valid("GENERAL", "UI_UX", "PERFORMANCE", "FEATURE_REQUEST", "BUG_REPORT", "SUPPORT").default("GENERAL"),
    platform: Joi.string().valid("web", "mobile", "other").default("web"),
    isAnonymous: Joi.boolean().default(false)
  })),
  async (req, res) => {
    try {
      const review = await PlatformReview.create({
        userId: req.user.id,
        ...req.body,
        status: "APPROVED",
        isPublic: true // يظهر تلقائياً في حائط الآراء عند الاعتماد التلقائي
      });
      res.status(201).json(review);
    } catch (error) {
      console.error("Platform review submission error:", error);
      res.status(500).json({ error: "حدث خطأ أثناء إرسال التقييم" });
    }
  }
);

// 2. جلب التقييمات العامة (مع مراعاة الخصوصية)
router.get("/public", async (req, res) => {
  try {
    const reviews = await PlatformReview.find({ isPublic: true, status: "APPROVED" })
      .populate("userId", "name avatar")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // معالجة الخصوصية: إذا كان التقييم مجهولاً، نقوم بتعديل بيانات المستخدم
    const processedReviews = reviews.map(review => {
      if (review.isAnonymous) {
        return {
          ...review,
          userId: {
            name: "مستخدم سوقك",
            avatar: null
          }
        };
      }
      return review;
    });

    res.json(processedReviews);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// 3. جلب إحصائيات التقييم (للمدير أو للعرض العام)
router.get("/stats", async (req, res) => {
  try {
    const stats = await PlatformReview.aggregate([
      { $match: { status: "APPROVED" } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
          totalCount: { $sum: 1 },
          distribution: {
            $push: "$rating"
          }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({ avgRating: 0, totalCount: 0, stars: { 1:0, 2:0, 3:0, 4:0, 5:0 } });
    }

    const ratings = stats[0].distribution;
    const starCounts = { 1:0, 2:0, 3:0, 4:0, 5:0 };
    ratings.forEach(r => {
      starCounts[Math.floor(r)] = (starCounts[Math.floor(r)] || 0) + 1;
    });

    res.json({
      avgRating: stats[0].avgRating,
      totalCount: stats[0].totalCount,
      stars: starCounts
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// 4. جلب جميع التقييمات للمدير (Admin Only)
router.get("/admin/all", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const reviews = await PlatformReview.find()
      .populate("userId", "name avatar email")
      .sort({ createdAt: -1 })
      .lean();
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// 5. تعديل حالة التقييم أو حذفه (Admin Only)
router.patch("/admin/:id", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const { status, isPublic } = req.body;
    const review = await PlatformReview.findByIdAndUpdate(
      req.params.id,
      { $set: { status, isPublic } },
      { new: true }
    );
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/admin/:id", auth, requireRole(["admin"]), async (req, res) => {
  try {
    await PlatformReview.findByIdAndDelete(req.params.id);
    res.json({ message: "تم حذف التقييم بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
