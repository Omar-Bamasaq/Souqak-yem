import { Router } from "express";
import auth from "../middleware/auth.js";
import Block from "../models/Block.js";

const router = Router();

router.get("/", auth, async (req, res) => {
  try {
    const list = await Block.find({ blockerId: req.user.id }).populate("blockedId", "name email").sort({ createdAt: -1 }).lean();
    res.json(list);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", auth, async (req, res) => {
  try {
    const { blockedId } = req.body;
    const targetId = blockedId || req.params.userId;
    if (!targetId) return res.status(400).json({ error: "targetId required" });
    if (String(targetId) === String(req.user.id)) return res.status(400).json({ error: "Invalid target" });
    const exists = await Block.findOne({ blockerId: req.user.id, blockedId: targetId }).lean();
    if (exists) return res.json({ blocked: true });
    await Block.create({ blockerId: req.user.id, blockedId: targetId });
    res.json({ blocked: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:userId", auth, async (req, res) => {
  try {
    const targetId = req.params.userId;
    if (String(targetId) === String(req.user.id)) return res.status(400).json({ error: "Invalid target" });
    const exists = await Block.findOne({ blockerId: req.user.id, blockedId: targetId }).lean();
    if (exists) return res.json({ blocked: true });
    await Block.create({ blockerId: req.user.id, blockedId: targetId });
    res.json({ blocked: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:userId", auth, async (req, res) => {
  try {
    await Block.deleteOne({ blockerId: req.user.id, blockedId: req.params.userId });
    res.json({ blocked: false });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
