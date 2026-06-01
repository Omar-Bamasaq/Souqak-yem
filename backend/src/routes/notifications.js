import { Router } from "express";
import auth from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";

const router = Router();

router.get("/", auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const p = Math.max(1, parseInt(page));
    const l = Math.max(1, Math.min(100, parseInt(limit)));

    const [list, total] = await Promise.all([
      Notification.find({ userId: req.user.id })
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      Notification.countDocuments({ userId: req.user.id })
    ]);

    res.json({
      items: list,
      total,
      page: p,
      limit: l,
      pages: Math.ceil(total / l)
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/", auth, async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user.id });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const n = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id }).lean();
    if (!n) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/unread-count", auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.id, isRead: false });
    res.json({ count });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/read", auth, async (req, res) => {
  try {
    const n = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { isRead: true }, { new: true }).lean();
    if (!n) return res.status(404).json({ error: "Not found" });
    res.json(n);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/read-all", auth, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, isRead: false }, { $set: { isRead: true } });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/prefs", auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id).select("notificationPrefs").lean();
    res.json(u?.notificationPrefs || {});
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/prefs", auth, async (req, res) => {
  try {
    const prefs = req.body || {};
    await User.findByIdAndUpdate(req.user.id, { notificationPrefs: prefs }, { new: true }).lean();
    res.json({ ok: true });
  } catch {
    res.status(400).json({ error: "Update error" });
  }
});

router.patch("/prompt-seen", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { hasSeenNotificationPrompt: true });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
