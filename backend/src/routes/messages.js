import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import Message from "../models/Message.js";
import Product from "../models/Product.js";

const router = Router();

router.post("/", auth, requireRole(["buyer"]), async (req, res) => {
  try {
    const { productId, message } = req.body;
    if (!productId || !message) return res.status(400).json({ error: "Missing fields" });
    const p = await Product.findById(productId).lean();
    if (!p || p.status !== "approved") return res.status(400).json({ error: "Invalid product" });
    const m = await Message.create({ product: productId, buyer: req.user.id, message });

    // Update promotionStats in Ad if applicable
    const AdModel = (await import("../models/Ad.js")).default;
    const ad = await AdModel.findById(productId);
    if (ad && ad.isWelcomePromoted) {
      ad.promotionStats.messages = (ad.promotionStats.messages || 0) + 1;
      await ad.save();
    }

    res.status(201).json(m);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/product/:id", auth, requireRole(["seller"]), async (req, res) => {
  try {
    const p = await Product.findById(req.params.id).lean();
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.seller.toString() !== req.user.id) return res.status(403).json({ error: "Forbidden" });
    const msgs = await Message.find({ product: req.params.id }).populate("buyer", "name email").sort({ createdAt: -1 }).lean();
    res.json(msgs);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
