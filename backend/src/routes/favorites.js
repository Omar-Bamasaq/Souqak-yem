import { Router } from "express";
import auth from "../middleware/auth.js";
import Favorite from "../models/Favorite.js";
import Ad from "../models/Ad.js";

const router = Router();

router.get("/", auth, async (req, res) => {
  try {
    const favs = await Favorite.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
    
    // Manual population for Ad only
    const items = await Promise.all(favs.map(async (f) => {
      const ad = await Ad.findById(f.adId)
        .populate("governorateId", "name")
        .populate("cityId", "name")
        .populate("userId", "name avatar isVerifiedSeller")
        .lean();
      
      if (ad && ad.status === "approved") {
        return ad;
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
    
    // Check in Ad collection only
    const ad = await Ad.findById(adId).lean();
    const isValid = ad && ad.status === "approved";

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
