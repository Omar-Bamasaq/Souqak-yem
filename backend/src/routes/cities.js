import { Router } from "express";
import City from "../models/City.js";
import Ad from "../models/Ad.js";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { governorateId } = req.query || {};
    const q = {};
    if (governorateId) q.governorateId = governorateId;
    if (typeof req.query.active !== "undefined") q.isActive = req.query.active === "true";
    const list = await City.find(q).sort({ name: 1 }).lean();
    res.json(list);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const { name, governorateId, isActive = true } = req.body || {};
    if (!name || !governorateId) return res.status(400).json({ error: "Missing fields" });
    const item = await City.create({ name, governorateId, isActive: !!isActive });
    res.status(201).json(item);
  } catch (e) {
    res.status(400).json({ error: e && e.message ? e.message : "Create error" });
  }
});

router.put("/:id", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (typeof req.body.isActive !== "undefined") updates.isActive = req.body.isActive === "true" || req.body.isActive === true;
    if (req.body.governorateId) updates.governorateId = req.body.governorateId;
    const updated = await City.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch {
    res.status(400).json({ error: "Update error" });
  }
});

router.delete("/:id", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const adsCount = await Ad.countDocuments({ cityId: req.params.id });
    if (adsCount > 0) return res.status(400).json({ error: "لا يمكن الحذف لوجود إعلانات مرتبطة" });
    const deleted = await City.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
