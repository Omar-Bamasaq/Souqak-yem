import { Router } from "express";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import Follow from "../models/Follow.js";
import StoreFollow from "../models/StoreFollow.js";
import StoreProfile from "../models/StoreProfile.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { createNotification } from "../services/notificationService.js";
import { requireRole } from "../middleware/roles.js";

const router = Router();

router.get("/store/:storeId/count", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.storeId)) {
      return res.status(400).json({ error: "Invalid store ID" });
    }
    const store = await StoreProfile.findOne({ _id: req.params.storeId, status: "active" }).select("_id").lean();
    if (!store) return res.status(404).json({ error: "Store not found" });
    const count = await StoreFollow.countDocuments({ storeProfileId: store._id });
    return res.json({ count });
  } catch (error) {
    console.error("Store follower count error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/store/:storeId/status", auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.storeId)) {
      return res.status(400).json({ error: "Invalid store ID" });
    }
    const store = await StoreProfile.findOne({ _id: req.params.storeId, status: "active" }).select("_id").lean();
    if (!store) return res.status(404).json({ error: "Store not found" });
    const exists = await StoreFollow.findOne({
      followerId: req.user.id,
      storeProfileId: store._id
    }).lean();
    return res.json({ following: Boolean(exists) });
  } catch (error) {
    console.error("Store follow status error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/store/:storeId", auth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.storeId)) {
      return res.status(400).json({ error: "Invalid store ID" });
    }
    const store = await StoreProfile.findOne({ _id: req.params.storeId, status: "active" })
      .select("_id userId")
      .lean();
    if (!store) return res.status(404).json({ error: "Store not found" });
    if (String(store.userId) === String(req.user.id)) {
      return res.status(400).json({ error: "لا يمكنك متابعة متجرك أو مشروعك." });
    }

    const existing = await StoreFollow.findOne({
      followerId: req.user.id,
      storeProfileId: store._id
    }).lean();
    const following = !existing;
    if (existing) {
      await StoreFollow.deleteOne({ _id: existing._id });
    } else {
      await StoreFollow.create({ followerId: req.user.id, storeProfileId: store._id });
    }

    const count = await StoreFollow.countDocuments({ storeProfileId: store._id });
    return res.json({ following, count });
  } catch (error) {
    console.error("Store follow update error:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/status/:sellerId", auth, async (req, res) => {
  try {
    const exists = await Follow.findOne({ followerId: req.user.id, sellerId: req.params.sellerId }).lean();
    res.json({ following: !!exists });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// List sellers the current user follows
router.get("/mine", auth, async (req, res) => {
  try {
    const rows = await Follow.find({ followerId: req.user.id })
      .populate("sellerId", "name isVerifiedSeller createdAt")
      .sort({ createdAt: -1 })
      .lean();
    const sellers = rows.map((r) => r.sellerId).filter(Boolean);
    res.json(sellers);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/mine/count", auth, async (req, res) => {
  try {
    const count = await Follow.countDocuments({ sellerId: req.user.id });
    res.json({ count });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/count/:sellerId", async (req, res) => {
  try {
    const count = await Follow.countDocuments({ sellerId: req.params.sellerId });
    res.json({ count });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// List followers of the current seller (names)
router.get("/followers/mine", auth, requireRole(["seller", "user"]), async (req, res) => {
  try {
    const rows = await Follow.find({ sellerId: req.user.id })
      .populate("followerId", "name")
      .sort({ createdAt: -1 })
      .lean();
    const followers = rows.map((r) => r.followerId).filter(Boolean);
    res.json(followers);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:sellerId", auth, async (req, res) => {
  try {
    const seller = await User.findById(req.params.sellerId).select("_id").lean();
    if (!seller) return res.status(404).json({ error: "Seller not found" });
    if (String(seller._id) === String(req.user.id)) return res.status(400).json({ error: "Cannot follow yourself" });
    const exists = await Follow.findOne({ followerId: req.user.id, sellerId: seller._id }).lean();
    if (exists) {
      await Follow.deleteOne({ _id: exists._id });
      return res.json({ following: false });
    }
    const f = await Follow.create({ followerId: req.user.id, sellerId: seller._id });
    try {
      await createNotification(req.app, {
        userId: seller._id,
        type: "follow",
        title: "متابع جديد",
        body: "قام مستخدم بمتابعتك",
        data: { followerId: req.user.id, followId: f._id }
      });
    } catch {}
    res.json({ following: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
