import express from "express";
import mongoose from "mongoose";
import Ad from "../models/Ad.js";
import ResellAd from "../models/ResellAd.js";
import ResellRequest from "../models/ResellRequest.js";
import ResellTransaction from "../models/ResellTransaction.js";
import { authenticate } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import { createNotification } from "../services/notificationService.js";

const router = express.Router();

// 1.1 Check Request Status for an ad
router.get("/request-status/:adId", authenticate, async (req, res) => {
  try {
    const adId = req.params.adId;
    const resellerId = req.user.id;
    
    let targetId = adId;
    // Check if adId is actually a ResellAd ID
    const baseAd = await Ad.findById(adId);
    if (!baseAd) {
      const resellAd = await ResellAd.findById(adId);
      if (resellAd) targetId = resellAd.originalAdId;
    }

    // Check if user is already reselling this ad
    const ad = await ResellAd.findOne({ originalAdId: targetId, resellerId, status: "active" });
    if (ad) return res.json({ status: "active" });
    
    // Check for pending/rejected requests
    const request = await ResellRequest.findOne({ originalAdId: targetId, resellerId }).sort({ createdAt: -1 });
    if (request) return res.json({ status: request.status });
    
    res.json({ status: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 1. Request to start reselling an ad (Submit an offer)
router.post("/request", authenticate, async (req, res) => {
  try {
    const { originalAdId, newPrice, customDescription, marketingType = "resell" } = req.body;
    const resellerId = req.user.id;

    if (!originalAdId) {
      return res.status(400).json({ error: "معرف الإعلان مفقود" });
    }

    if (marketingType === "resell" && (typeof newPrice === 'undefined' || newPrice === null)) {
      return res.status(400).json({ error: "السعر مطلوب عند اختيار إعادة البيع بسعر مخصص" });
    }

    if (!customDescription) {
      return res.status(400).json({ error: "الوصف مطلوب لتقديم العرض" });
    }

    let targetOriginalId = originalAdId;
    
    if (!mongoose.Types.ObjectId.isValid(targetOriginalId)) {
      return res.status(400).json({ error: "معرف الإعلان غير صالح" });
    }

    let ad = await Ad.findById(targetOriginalId);
    
    // If not found, check if originalAdId is actually a ResellAd ID
    if (!ad) {
      const resellAd = await ResellAd.findById(targetOriginalId);
      if (resellAd) {
        targetOriginalId = resellAd.originalAdId;
        ad = await Ad.findById(targetOriginalId);
      }
    }

    if (!ad) return res.status(404).json({ error: "الإعلان الأصلي غير موجود" });
    
    // For affiliate type, we use the original ad price
    const finalPrice = marketingType === "affiliate" ? ad.price : Number(newPrice);

    if (!ad.isResellEnabled) return res.status(400).json({ error: "إعادة البيع غير مفعلة لهذا الإعلان" });
    if (String(ad.userId) === String(resellerId)) return res.status(400).json({ error: "لا يمكنك إعادة بيع إعلانك الخاص" });

    if (marketingType === "resell" && ad.maxResellPrice && finalPrice > ad.maxResellPrice) {
      return res.status(400).json({ error: `السعر المقترح (${finalPrice}) يتجاوز الحد الأعلى المسموح به لهذا الإعلان (${ad.maxResellPrice})` });
    }

    // Radical Fix: Check if already has a request
    const existing = await ResellRequest.findOne({ originalAdId: targetOriginalId, resellerId });
    if (existing) {
      // If already active/approved, block updating here (should use different edit route if needed)
      if (existing.status === "approved") {
        return res.status(400).json({ error: "لديك عرض مقبول بالفعل ونشط. لا يمكن تعديله من هنا." });
      }

      // If pending or rejected, allow UPDATING the current request instead of failing with 400
      existing.newPrice = finalPrice;
      existing.customDescription = customDescription;
      existing.marketingType = marketingType;
      existing.status = ad.allowAutoApproval ? "approved" : "pending";
      existing.rejectionReason = undefined; // Clear reason if it was rejected
      await existing.save();

      if (existing.status === "approved") {
        // Create/Update ResellAd
        await ResellAd.findOneAndUpdate(
          { originalAdId: targetOriginalId, resellerId },
          { newPrice: finalPrice, customDescription, marketingType, status: "active" },
          { upsert: true }
        );
        return res.json({ success: true, status: "approved", message: "تم تحديث عرضك والموافقة عليه" });
      }

      // Notify seller about the UPDATE
      await createNotification(req.app, {
        userId: ad.userId,
        title: "تحديث عرض تسويق",
        body: `قام ${req.user.name} بتحديث عرضه لإعلان "${ad.title}" (${marketingType === 'affiliate' ? 'تسويق بنفس السعر' : `بسعر ${finalPrice}`})`,
        type: "resell_request",
        data: { requestId: existing._id, link: `/resell/requests` }
      });

      return res.json({ success: true, status: "pending", message: "تم تحديث عرضك بنجاح وهو قيد المراجعة" });
    }

    // Check max resellers limit
    const currentResellersCount = await ResellAd.countDocuments({ originalAdId: targetOriginalId, status: "active" });
    if (currentResellersCount >= (ad.maxResellers || 5)) {
      return res.status(400).json({ error: "عذراً، وصل هذا الإعلان للحد الأقصى من المسوقين المسموح بهم من قبل البائع" });
    }

    if (ad.allowAutoApproval) {
      // Auto approve and create ResellAd immediately
      const request = new ResellRequest({
        originalAdId: targetOriginalId,
        resellerId,
        sellerId: ad.userId,
        newPrice: finalPrice,
        customDescription,
        marketingType,
        status: "approved"
      });
      await request.save();

      const resellAd = new ResellAd({
        originalAdId: targetOriginalId,
        resellerId,
        newPrice: finalPrice,
        customDescription,
        marketingType,
        status: "active"
      });
      await resellAd.save();

      return res.json({ success: true, status: "approved", message: "تمت الموافقة التلقائية وإنشاء الإعلان" });
    }

    const request = new ResellRequest({
      originalAdId: targetOriginalId,
      resellerId,
      sellerId: ad.userId,
      newPrice: finalPrice,
      customDescription,
      marketingType,
      status: "pending"
    });
    await request.save();

    // Notify seller
    await createNotification(req.app, {
      userId: ad.userId,
      title: "طلب إعادة بيع جديد",
      body: `طلب المستخدم ${req.user.name} تسويق إعلانك "${ad.title}"`,
      type: "resell_request",
      data: { 
        requestId: request._id,
        resellerName: req.user.name,
        resellerLevel: req.user.resellerLevel || "Beginner",
        adTitle: ad.title,
        newPrice: finalPrice,
        currency: ad.currency,
        marketingType,
        link: `/resell/requests` 
      }
    });

    res.json({ success: true, status: "pending", message: "تم إرسال عرضك للبائع للمراجعة" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Approve/Reject resell request (Seller only)
router.post("/approve", authenticate, async (req, res) => {
  try {
    console.log("POST /api/resell/approve hit with body:", req.body);
    const { requestId, status, rejectionReason } = req.body; // 'approved' or 'rejected'
    const sellerId = req.user.id;

    if (!requestId) {
      return res.status(400).json({ error: "معرف الطلب (requestId) مطلوب" });
    }

    const request = await ResellRequest.findById(requestId).populate("originalAdId");
    if (!request) return res.status(404).json({ error: "الطلب غير موجود في قاعدة البيانات" });
    
    // Check if original ad exists (crucial for approved status)
    if (!request.originalAdId) {
      return res.status(400).json({ error: "الإعلان الأصلي المرتبط بهذا الطلب تم حذفه من المنصة" });
    }

    if (String(request.sellerId) !== String(sellerId)) return res.status(403).json({ error: "غير مصرح لك بمعالجة هذا الطلب" });
    if (request.status !== "pending") return res.status(400).json({ error: "تمت معالجة هذا الطلب مسبقاً" });

    request.status = status;
    if (status === "rejected") {
      request.rejectionReason = rejectionReason;
    }
    await request.save();

    if (status === "approved") {
      // Create or Update the ResellAd automatically
      try {
        await ResellAd.findOneAndUpdate(
          { originalAdId: request.originalAdId._id || request.originalAdId, resellerId: request.resellerId },
          { 
            newPrice: request.newPrice,
            customDescription: request.customDescription,
            marketingType: request.marketingType || "resell",
            status: "active"
          },
          { upsert: true, new: true }
        );
      } catch (dbErr) {
        console.error("Database error during ResellAd update:", dbErr);
        throw new Error("فشل تحديث بيانات الإعلان في قاعدة البيانات");
      }
    }

    // Notify reseller
    try {
      const adTitle = request.originalAdId.title || "إعلانك المختار";
      await createNotification(req.app, {
        userId: request.resellerId,
        title: status === "approved" ? "تم قبول عرض التسويق الخاص بك" : "تم رفض عرض التسويق",
        body: status === "approved" 
          ? `تمت الموافقة على عرضك لإعلان "${adTitle}". إعلانك الآن نشط!` 
          : `عذراً، تم رفض عرضك لإعلان "${adTitle}".${rejectionReason ? ` السبب: ${rejectionReason}` : ""}`,
        type: "resell_status",
        data: { link: "/reseller/dashboard" }
      });
    } catch (notifErr) {
      console.error("Notification failed but request was saved:", notifErr);
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error("Resell Approval Error:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
});

// 3. Create Resell Ad (Reseller only, after approval)
router.post("/create", authenticate, async (req, res) => {
  try {
    const { originalAdId, newPrice, customDescription } = req.body;
    const resellerId = req.user.id;

    const request = await ResellRequest.findOne({ originalAdId, resellerId, status: "approved" });
    if (!request) return res.status(400).json({ error: "يجب الحصول على موافقة البائع أولاً" });

    const ad = await Ad.findById(originalAdId);
    if (!ad) return res.status(404).json({ error: "الإعلان الأصلي غير موجود" });

    // Constraints
    if (ad.maxResellPrice && newPrice > ad.maxResellPrice) {
      return res.status(400).json({ error: `السعر يتجاوز الحد الأعلى المسموح به (${ad.maxResellPrice})` });
    }

    const resellAd = new ResellAd({
      originalAdId,
      resellerId,
      newPrice,
      customDescription,
      status: "active"
    });
    await resellAd.save();

    res.json({ success: true, resellAd });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Initiate Mark as Sold (can be called from dashboard or chat)
router.post("/mark-as-sold", authenticate, async (req, res) => {
  try {
    const { resellAdId, buyerId, chatId, finalPriceOverride } = req.body;
    const userId = req.user.id;

    const resellAd = await ResellAd.findById(resellAdId).populate("originalAdId");
    if (!resellAd) return res.status(404).json({ error: "إعلان إعادة البيع غير موجود" });

    const isReseller = String(resellAd.resellerId) === String(userId);
    const isOriginalSeller = String(resellAd.originalAdId.userId) === String(userId);

    if (!isReseller && !isOriginalSeller) {
      return res.status(403).json({ error: "غير مصرح لك بإتمام هذه العملية" });
    }

    if (resellAd.status === "sold") return res.status(400).json({ error: "الإعلان مباع بالفعل" });

    // Check if there is already a pending transaction
    let transaction = await ResellTransaction.findOne({ resellAdId, status: { $in: ["pending_seller_confirmation", "pending_reseller_confirmation"] } });

    if (!transaction) {
      const originalAd = resellAd.originalAdId;
      const originalPrice = originalAd.price;
      // تجاهل أي تعديل يدوي للسعر من العميل لضمان السلامة المالية
      const finalPrice = resellAd.newPrice; 
      const platformFee = originalPrice * 0.01;
      
      let resellerProfit = 0;
      if (finalPrice > originalPrice) resellerProfit = (finalPrice - originalPrice);

      transaction = new ResellTransaction({
        originalAdId: originalAd._id,
        resellAdId: resellAd._id,
        resellerId: resellAd.resellerId,
        sellerId: originalAd.userId,
        buyerId,
        chatId, // Link to chat if provided
        originalPrice,
        finalPrice,
        platformFee,
        resellerProfit,
        status: isReseller ? "pending_seller_confirmation" : "pending_reseller_confirmation",
        confirmedByReseller: isReseller,
        confirmedBySeller: isOriginalSeller
      });
      await transaction.save();

      // Notify the other party
      const notifyUserId = isReseller ? originalAd.userId : resellAd.resellerId;
      await createNotification(req.app, {
        userId: notifyUserId,
        title: "تأكيد عملية بيع جديدة",
        body: `يرجى تأكيد إتمام عملية البيع لإعلان "${originalAd.title}" بسعر ${finalPrice}.`,
        type: "resell_confirmation",
        data: { transactionId: transaction._id, link: isReseller ? "/resell/requests" : "/reseller/dashboard" }
      });
    }

    res.json({ success: true, message: "تم إرسال طلب تأكيد العملية للطرف الآخر", transactionId: transaction._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4.1 Confirm Sale (The other party confirms)
router.post("/confirm-sale", authenticate, async (req, res) => {
  try {
    const { transactionId } = req.body;
    const userId = req.user.id;

    const transaction = await ResellTransaction.findById(transactionId).populate("resellAdId").populate("originalAdId");
    if (!transaction) return res.status(404).json({ error: "العملية غير موجودة" });

    const isReseller = String(transaction.resellerId) === String(userId);
    const isSeller = String(transaction.sellerId) === String(userId);

    if (!isReseller && !isSeller) return res.status(403).json({ error: "غير مصرح لك" });

    if (isReseller) transaction.confirmedByReseller = true;
    if (isSeller) transaction.confirmedBySeller = true;

    if (transaction.confirmedByReseller && transaction.confirmedBySeller) {
      transaction.status = "completed";
      
      // Finalize ad status
      await ResellAd.findByIdAndUpdate(transaction.resellAdId, { status: "sold" });
      
      // Update User Stats (Rating and Completion Rate)
      const User = mongoose.model("User");
      const reseller = await User.findById(transaction.resellerId);
      if (reseller) {
        reseller.resellerSalesCount += 1;
        
        // Completion rate: (Sales / (Sales + Cancellations))
        const totalAttempts = reseller.resellerSalesCount + (reseller.resellerCancellationsCount || 0);
        reseller.resellerCompletionRate = Math.min(100, (reseller.resellerSalesCount / totalAttempts) * 100);
        
        // Update Level based on sales
        if (reseller.resellerSalesCount >= 100 && reseller.resellerCompletionRate >= 95) {
          reseller.resellerLevel = "VIP";
          reseller.isTrustedReseller = true;
        } else if (reseller.resellerSalesCount >= 50 && reseller.resellerCompletionRate >= 90) {
          reseller.resellerLevel = "Pro";
          reseller.isTrustedReseller = true;
        } else if (reseller.resellerSalesCount >= 10 && reseller.resellerCompletionRate >= 85) {
          reseller.resellerLevel = "Active";
          reseller.isTrustedReseller = true;
        } else {
          reseller.resellerLevel = "Beginner";
        }
        
        await reseller.save();
      }

      // Notify both
      await createNotification(req.app, {
        userId: transaction.sellerId,
        title: "تم تأكيد المبيعة بنجاح",
        body: `تم تأكيد عملية البيع لإعلان "${transaction.originalAdId.title}" بنجاح.`,
        type: "resell_sold",
        data: { link: "/seller/transactions" }
      });
      await createNotification(req.app, {
        userId: transaction.resellerId,
        title: "مبروك! تم تأكيد أرباحك",
        body: `تم تأكيد المبيعة بنجاح. ربحك المضاف: ${transaction.resellerProfit}.`,
        type: "resell_sold",
        data: { link: "/reseller/dashboard" }
      });
    } else {
      transaction.status = isReseller ? "pending_seller_confirmation" : "pending_reseller_confirmation";
    }

    await transaction.save();
    res.json({ success: true, status: transaction.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get reseller dashboard stats
router.get("/stats", authenticate, async (req, res) => {
  try {
    const resellerId = req.user.id;
    const User = mongoose.model("User");
    const user = await User.findById(resellerId);

    const adsCount = await ResellAd.countDocuments({ resellerId, isDeleted: { $ne: true } });
    const activeAds = await ResellAd.countDocuments({ resellerId, status: "active", isDeleted: { $ne: true } });
    
    const transactions = await ResellTransaction.find({ resellerId, isDeleted: { $ne: true } });
    const totalProfit = transactions.reduce((sum, t) => sum + (t.resellerProfit || 0), 0);
    const totalSales = transactions.filter(t => t.status === "completed").length;

    const resellAds = await ResellAd.find({ resellerId, isDeleted: { $ne: true } }).populate({
      path: "originalAdId",
      select: "title price currency images"
    }).lean();
    
    const totalViews = resellAds.reduce((sum, a) => sum + (a.viewsCount || 0), 0);
    const totalClicks = resellAds.reduce((sum, a) => sum + (a.referralClicks || 0), 0);

    // Conversion Rate: (Sales / Clicks) * 100
    const conversionRate = totalClicks > 0 ? ((totalSales / totalClicks) * 100).toFixed(1) : 0;

    res.json({
      adsCount,
      activeAds,
      totalSales,
      totalProfit,
      totalViews,
      totalClicks,
      conversionRate,
      completionRate: user?.resellerCompletionRate || 0,
      resellerLevel: user?.resellerLevel || "Beginner",
      recentAds: resellAds.slice(-5)
    });
  } catch (error) {
    console.error("Resell stats error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 5.1 Get Resell Requests for Seller
router.get("/requests", authenticate, async (req, res) => {
  try {
    const sellerId = req.user.id;
    const requests = await ResellRequest.find({ sellerId, isDeleted: { $ne: true } })
      .populate("resellerId", "name")
      .populate("originalAdId", "title price")
      .sort({ createdAt: -1 });
    
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Get My Resell Ads
router.get("/my-ads", authenticate, async (req, res) => {
  try {
    const resellerId = req.user.id;
    const ads = await ResellAd.find({ resellerId, isDeleted: { $ne: true } })
      .populate({
        path: "originalAdId",
        select: "title price images description isResellEnabled"
      })
      .sort({ createdAt: -1 });
    
    res.json(ads);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6.1 Get Pending Transactions for User (as reseller or seller)
router.get("/pending-transactions", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const transactions = await ResellTransaction.find({
      $or: [{ resellerId: userId }, { sellerId: userId }],
      status: { $in: ["pending_seller_confirmation", "pending_reseller_confirmation"] },
      isDeleted: { $ne: true }
    })
    .populate("originalAdId", "title price")
    .sort({ createdAt: -1 });
    
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Track Referral Click
router.post("/track-click/:resellAdId", async (req, res) => {
  try {
    const { resellAdId } = req.params;
    await ResellAd.findByIdAndUpdate(resellAdId, { $inc: { referralClicks: 1 } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Find Resell Ad by Original ID + Reseller ID
router.get("/find-by-ref", async (req, res) => {
  try {
    const { adId, refId } = req.query; // originalAdId and resellerId
    const resellAd = await ResellAd.findOne({ originalAdId: adId, resellerId: refId, status: "active" }).select("_id").lean();
    res.json({ resellAdId: resellAd ? resellAd._id : null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Get Opportunities & Unserved Requests
router.get("/opportunities", authenticate, async (req, res) => {
  try {
    const resellerId = req.user.id;

    // 1. High Commission Ads (Opportunities)
    const opportunities = await Ad.find({ 
      isResellEnabled: true, 
      status: "approved",
      userId: { $ne: resellerId }
    })
    .sort({ commissionValue: -1 })
    .limit(5)
    .populate("userId", "name avatar isVerifiedSeller")
    .lean();

    // 2. Unserved "Orders" (Purchase requests) that match reseller's active categories
    // First find reseller's categories from their active ads
    const myResellAds = await ResellAd.find({ resellerId, status: "active", isDeleted: { $ne: true } }).populate("originalAdId", "categoryId");
    const myCatIds = [...new Set(myResellAds.map(a => a.originalAdId?.categoryId))].filter(Boolean);

    const unservedRequests = await Ad.find({
      adType: "order",
      status: "approved",
      categoryId: { $in: myCatIds },
      userId: { $ne: resellerId }
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate("userId", "name avatar isVerifiedSeller")
    .lean();

    res.json({ opportunities, unservedRequests });
  } catch (error) {
    console.error("Resell opportunities error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
