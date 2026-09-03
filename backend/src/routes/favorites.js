import { Router } from "express";
import auth from "../middleware/auth.js";
import Favorite from "../models/Favorite.js";
import Ad from "../models/Ad.js";
import Conversation from "../models/Conversation.js";
import Block from "../models/Block.js";
import User from "../models/User.js";
import { createNotification } from "../services/notificationService.js";

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

    if (String(ad.userId) !== String(req.user.id)) {
      const blocked = await Block.findOne({
        $or: [
          { blockerId: ad.userId, blockedId: req.user.id },
          { blockerId: req.user.id, blockedId: ad.userId }
        ]
      }).lean();

      if (!blocked) {
        let conversation = await Conversation.findOne({
          adId,
          adModel: "Ad",
          participants: { $all: [req.user.id, ad.userId] }
        });

        if (!conversation) {
          conversation = await Conversation.create({
            adId,
            adModel: "Ad",
            participants: [req.user.id, ad.userId],
            lastMessage: ""
          });
          await Ad.findByIdAndUpdate(adId, { $inc: { contactsCount: 1 } });
        }

        const actor = await User.findById(req.user.id).select("name").lean();
        const messageText = `أضاف ${actor?.name || "مستخدم"} الإعلان إلى قائمة المفضلات.`;
        conversation.favoriteNotice = {
          text: messageText,
          actorName: actor?.name || "مستخدم",
          createdAt: new Date()
        };
        conversation.deletedBy = [];
        await conversation.save();

        const conversationUrl = `/messages?c=${conversation._id}&direct=1`;
        await createNotification(req.app, {
          userId: ad.userId,
          type: "favorite",
          title: "تمت إضافة إعلانك للمفضلة",
          body: `${actor?.name || "مستخدم"} أضاف إعلانك «${ad.title || "بدون عنوان"}» إلى قائمة المفضلات.`,
          data: { conversationId: conversation._id, adId, url: conversationUrl },
          push: true,
          email: true
        });

        const io = req.app.get("io");
        if (io) {
          io.to(`user:${ad.userId}`).emit("conversation:favorite_notice", {
            conversationId: String(conversation._id),
            favoriteNotice: conversation.favoriteNotice
          });
        }

        return res.json({ favorited: true, conversationId: conversation._id });
      }
    }

    res.json({ favorited: true, conversationId: null });
  } catch (error) {
    console.error("Toggle favorite error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
