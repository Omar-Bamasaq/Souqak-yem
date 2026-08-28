import { Router } from "express";
import User from "../models/User.js";
import Ad from "../models/Ad.js";
import auth from "../middleware/auth.js";
import rateLimit from "../middleware/rateLimit.js";
import SellerReport from "../models/SellerReport.js";

const router = Router();

router.get("/:id", async (req, res) => {
  try {
    const seller = await User.findById(req.params.id).select("name avatar isVerifiedSeller createdAt").lean();
    if (!seller) return res.status(404).json({ error: "Not found" });
    const { page = 1, limit = 12 } = req.query || {};
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 100);
    const filter = {
      userId: seller._id,
      status: "approved",
      expiresAt: { $gt: new Date() },
      isArchived: { $ne: true },
      sold: { $ne: true }
    };
    const [items, total] = await Promise.all([
      Ad.find(filter).select("title images price governorateId cityId featured viewCount createdAt")
        .populate("governorateId", "name")
        .populate("cityId", "name")
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      Ad.countDocuments(filter)
    ]);
    res.json({ seller, items, page: p, pages: Math.ceil(total / l), total });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/report", auth, rateLimit({ windowMs: 60_000, max: 5 }), async (req, res) => {
  try {
    const { category, reason, details } = req.body || {};
    if (!category || !String(category).trim()) return res.status(400).json({ error: "Category required" });
    if (!reason || !String(reason).trim()) return res.status(400).json({ error: "Reason required" });
    const seller = await User.findById(req.params.id).lean();
    if (!seller) return res.status(404).json({ error: "Seller not found" });
    if (String(seller._id) === String(req.user.id)) return res.status(400).json({ error: "Cannot report yourself" });
    const r = await SellerReport.create({ 
      sellerId: seller._id, 
      reporterId: req.user.id, 
      category: String(category).trim(),
      reason: String(reason).trim(),
      details: String(details || "").trim()
    });
    res.status(201).json(r);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
