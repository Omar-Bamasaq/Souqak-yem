import { Router } from "express";
import Attribute from "../models/Attribute.js";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { categoryId } = req.query || {};
    const q = categoryId ? { categoryId } : {};
    const list = await Attribute.find(q).sort({ name: 1 }).lean();
    res.json(list);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const { categoryId, name, type, options } = req.body || {};
    if (!categoryId || !name || !type) return res.status(400).json({ error: "Missing fields" });
    const attr = await Attribute.create({ categoryId, name, type, options: Array.isArray(options) ? options : [] });
    res.status(201).json(attr);
  } catch (e) {
    res.status(400).json({ error: e && e.message ? e.message : "Create error" });
  }
});

router.put("/:id", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.type) updates.type = req.body.type;
    if (req.body.options) updates.options = Array.isArray(req.body.options) ? req.body.options : [];
    const updated = await Attribute.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch {
    res.status(400).json({ error: "Update error" });
  }
});

router.delete("/:id", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const deleted = await Attribute.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
