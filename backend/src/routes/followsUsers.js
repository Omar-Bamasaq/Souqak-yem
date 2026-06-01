import { Router } from "express";
import auth from "../middleware/auth.js";
import Follow from "../models/Follow.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { createNotification } from "../services/notificationService.js";
import { requireRole } from "../middleware/roles.js";

const router = Router();

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
router.get("/followers/mine", auth, requireRole(["seller"]), async (req, res) => {
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
