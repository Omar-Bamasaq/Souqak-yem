import { Router } from "express";
import mongoose from "mongoose";
import Joi from "joi";
import Review from "../models/Review.js";
import Ad from "../models/Ad.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { createNotification } from "../services/notificationService.js";
import auth from "../middleware/auth.js";
import rateLimit from "../middleware/rateLimit.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import { uploadImages } from "../middleware/upload.js";

const router = Router();

/**
 * Helper to update user's aggregated rating (Seller Rating)
 */
async function updateUserRating(userId) {
  try {
    const stats = await Review.aggregate([
      { $match: { sellerId: new mongoose.Types.ObjectId(userId), status: "APPROVED", isDeleted: { $ne: true } } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }
    ]);

    if (stats.length > 0) {
      await User.findByIdAndUpdate(userId, {
        sellerRating: stats[0].avg,
        sellerReviewsCount: stats[0].count
      });
    } else {
      await User.findByIdAndUpdate(userId, {
        sellerRating: 0,
        sellerReviewsCount: 0
      });
    }
  } catch (err) {
    console.error("Update user rating error:", err);
  }
}

// 1. Post a review for a seller (supports both Order and Ad context)
router.post(
  "/:targetId",
  auth,
  rateLimit({ windowMs: 60_000, max: 5 }),
  uploadImages.array("images", 3),
  validateParams(Joi.object({ targetId: Joi.string().length(24).hex().required() })),
  validateBody(Joi.object({
    reliability: Joi.alternatives().try(Joi.number().min(1).max(5), Joi.string().custom((value, helpers) => {
      const num = Number(value);
      if (isNaN(num) || num < 1 || num > 5) return helpers.error('any.invalid');
      return num;
    })).required(),
    communication: Joi.alternatives().try(Joi.number().min(1).max(5), Joi.string().custom((value, helpers) => {
      const num = Number(value);
      if (isNaN(num) || num < 1 || num > 5) return helpers.error('any.invalid');
      return num;
    })).required(),
    deliverySpeed: Joi.alternatives().try(Joi.number().min(1).max(5), Joi.string().custom((value, helpers) => {
      const num = Number(value);
      if (isNaN(num) || num < 1 || num > 5) return helpers.error('any.invalid');
      return num;
    })).required(),
    comment: Joi.string().trim().min(10).max(1000).required()
  })),
  async (req, res) => {
    try {
      const { targetId } = req.params;
      let { reliability, communication, deliverySpeed, comment } = req.body;
      // Convert string values to numbers
      reliability = Number(reliability);
      communication = Number(communication);
      deliverySpeed = Number(deliverySpeed);
      const buyerId = req.user.id;

      let order = await Order.findById(targetId);
      let ad = null;
      let sellerId = null;
      let orderId = undefined;

      if (order) {
        // Review based on an Escrow Order
        if (!["COMPLETED", "DELIVERED"].includes(order.status)) {
          return res.status(400).json({ error: "لا يمكنك تقييم البائع قبل إكمال الطلب" });
        }
        if (String(order.buyer) !== String(buyerId)) {
          return res.status(403).json({ error: "غير مسموح لك بتقييم هذا الطلب" });
        }
        ad = await Ad.findById(order.ad);
        sellerId = order.seller;
        orderId = order._id;
      } else {
        // Review based on a Manual Sale (Ad context)
        ad = await Ad.findById(targetId);
        if (!ad) return res.status(404).json({ error: "الطلب أو الإعلان غير موجود" });
        
        if (!ad.sold || !ad.buyerId) {
          return res.status(400).json({ error: "لا يمكنك تقييم البائع قبل إتمام عملية البيع" });
        }
        if (String(ad.buyerId) !== String(buyerId)) {
          return res.status(403).json({ error: "غير مسموح لك بتقييم هذا الإعلان" });
        }
        sellerId = ad.userId;
      }

      // Check if already reviewed (by order or by ad)
      const query = orderId ? { orderId } : { adId: ad._id, buyerId, orderId: { $exists: false } };
      const existingReview = await Review.findOne(query);
      if (existingReview) {
        return res.status(400).json({ error: "لقد قمت بتقييم هذا البائع مسبقاً" });
      }

      const overallRating = (Number(reliability) + Number(communication) + Number(deliverySpeed)) / 3;
      const filenames = (req.files || []).map(f => f.filename);

      const reviewData = {
        adId: ad._id,
        buyerId,
        sellerId,
        reliability,
        communication,
        deliverySpeed,
        rating: overallRating,
        comment,
        images: filenames,
        status: "APPROVED",
        isVerifiedPurchase: !!orderId
      };

      if (orderId) {
        reviewData.orderId = orderId;
      }

      const review = await Review.create(reviewData);

      // Update the user's overall rating
      await updateUserRating(sellerId);

      // Link review to ad if it's a manual sale
      if (!orderId) {
        await Ad.findByIdAndUpdate(ad._id, { reviewId: review._id });
      }

      // Notify the seller
      try {
        const reviewer = await User.findById(buyerId).select("name").lean();
        await createNotification(req.app, {
          userId: sellerId,
          type: "ad_status",
          title: "تقييم بائع جديد",
          body: `${reviewer?.name || "مستخدم"} قام بتقييمك بـ ${overallRating.toFixed(1)} نجوم عن عملية شراء`,
          data: { adId: ad._id, orderId, reviewId: review._id }
        });
      } catch (notifErr) {
        console.error("Review notification failed:", notifErr);
      }

      res.status(201).json(review);
    } catch (error) {
      console.error("Post review error:", error);
      res.status(500).json({ 
        error: "Server error", 
        message: error.message,
        code: error.code // Useful for identifying duplicate key errors
      });
    }
  }
);

// 2. Get reviews for a seller
router.get("/seller/:id", async (req, res) => {
  try {
    const sellerId = req.params.id;
    const reviews = await Review.find({ sellerId, status: "APPROVED", isDeleted: { $ne: true } })
      .populate("buyerId", "name avatar")
      .populate("adId", "title images")
      .sort({ createdAt: -1 })
      .lean();
    
    const stats = await Review.aggregate([
      { $match: { sellerId: new mongoose.Types.ObjectId(sellerId), status: "APPROVED", isDeleted: { $ne: true } } },
      { 
        $group: { 
          _id: null, 
          avgRating: { $avg: "$rating" },
          avgReliability: { $avg: "$reliability" },
          avgCommunication: { $avg: "$communication" },
          avgDeliverySpeed: { $avg: "$deliverySpeed" },
          count: { $sum: 1 } 
        } 
      }
    ]);

    res.json({
      items: reviews,
      stats: stats.length > 0 ? stats[0] : {
        avgRating: 0,
        avgReliability: 0,
        avgCommunication: 0,
        avgDeliverySpeed: 0,
        count: 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// 3. Get pending reviews for current user (Buyer)
router.get("/pending", auth, async (req, res) => {
  try {
    // A. Find completed Escrow orders
    const orders = await Order.find({
      buyer: req.user.id,
      status: { $in: ["COMPLETED", "DELIVERED"] }
    }).populate("ad", "title images").lean();

    // B. Find manual sales in chat
    const manualAds = await Ad.find({
      buyerId: req.user.id,
      buyerType: "DIRECT",
      sold: true,
      reviewId: null
    }).select("title images userId soldAt").lean();

    const reviewedOrderIds = await Review.find({ buyerId: req.user.id, orderId: { $ne: null }, isDeleted: { $ne: true } }).distinct("orderId");
    
    const pendingOrders = orders.filter(o => !reviewedOrderIds.some(rid => String(rid) === String(o._id)));
    
    // Combine both types of pending reviews
    const combined = [
      ...pendingOrders.map(o => ({ ...o, type: 'ORDER' })),
      ...manualAds.map(a => ({ ...a, type: 'AD' }))
    ];

    res.json(combined);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Remove old ad-specific routes if not needed, but keeping placeholder for compatibility
router.get("/ad/:id", async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.id).select("userId");
        if (!ad) return res.status(404).json({ error: "Ad not found" });
        // Redirect or fetch seller reviews instead
        const sellerId = ad.userId;
        const result = await fetch(`http://localhost:${process.env.PORT || 5000}/api/reviews/seller/${sellerId}`).then(r => r.json());
        res.json(result);
    } catch {
        res.status(500).json({ error: "Server error" });
    }
});

export default router;
