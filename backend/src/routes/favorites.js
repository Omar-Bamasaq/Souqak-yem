import { Router } from "express";
import auth from "../middleware/auth.js";
import Favorite from "../models/Favorite.js";
import Ad from "../models/Ad.js";
import ResellAd from "../models/ResellAd.js";

const router = Router();

router.get("/", auth, async (req, res) => {
  try {
    const favs = await Favorite.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    
    // Manual population to handle both Ad and ResellAd
    const items = await Promise.all(favs.map(async (f) => {
      // First try regular Ad
      let ad = await Ad.findById(f.adId)
        .populate("governorateId", "name")
        .populate("cityId", "name")
        .populate("userId", "name avatar isVerifiedSeller")
        .lean();
      
      if (ad) {
        if (ad.status !== "approved") return null;
        return ad;
      }

      // If not found, try ResellAd
      let resellAd = await ResellAd.findById(f.adId)
        .populate({
          path: "originalAdId",
          populate: [
            { path: "governorateId", select: "name" },
            { path: "cityId", select: "name" },
            { path: "userId", select: "name isVerifiedSeller" }
          ]
        })
        .populate("resellerId", "name isVerifiedSeller")
        .lean();
      
      if (resellAd && resellAd.status === "active" && resellAd.originalAdId) {
        return {
          ...resellAd.originalAdId,
          _id: resellAd._id,
          originalId: resellAd.originalAdId._id,
          price: resellAd.newPrice,
          description: resellAd.customDescription || resellAd.originalAdId.description,
          userId: resellAd.resellerId,
          viewCount: resellAd.viewsCount || 0,
          createdAt: resellAd.createdAt,
          isResell: true
        };
      }
      
      return null;
    }));

    res.json(items.filter(Boolean));
  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/count", auth, async (req, res) => {
  try {
    const favs = await Favorite.find({ userId: req.user.id }).lean();
    let count = 0;
    
    for (const f of favs) {
      const ad = await Ad.findById(f.adId).select("status").lean();
      if (ad && ad.status === "approved") {
        count++;
        continue;
      }
      
      const resellAd = await ResellAd.findById(f.adId).select("status").lean();
      if (resellAd && resellAd.status === "active") {
        count++;
      }
    }
    
    res.json({ count });
  } catch (error) {
    console.error("Get favorites count error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/status/:adId", auth, async (req, res) => {
  try {
    const exists = await Favorite.findOne({ userId: req.user.id, adId: req.params.adId }).lean();
    res.json({ favorited: !!exists });
  } catch (error) {
    console.error("Get favorite status error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:adId", auth, async (req, res) => {
  try {
    const adId = req.params.adId;
    
    // Check in Ad collection
    let ad = await Ad.findById(adId).lean();
    let isValid = ad && ad.status === "approved";
    
    // If not in Ad, check in ResellAd collection
    if (!isValid) {
      const resellAd = await ResellAd.findById(adId).lean();
      if (resellAd && resellAd.status === "active") {
        isValid = true;
      }
    }

    if (!isValid) return res.status(404).json({ error: "الإعلان غير موجود أو غير متاح" });

    const exists = await Favorite.findOne({ userId: req.user.id, adId }).lean();
    if (exists) {
      await Favorite.deleteOne({ _id: exists._id });
      return res.json({ favorited: false });
    }
    
    await Favorite.create({ userId: req.user.id, adId });

    // Update promotionStats if applicable
    if (ad && ad.isWelcomePromoted) {
      await Ad.findByIdAndUpdate(adId, { $inc: { "promotionStats.favorites": 1 } });
    }

    res.json({ favorited: true });
  } catch (error) {
    console.error("Toggle favorite error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
