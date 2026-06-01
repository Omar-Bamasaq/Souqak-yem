import { Router } from "express";
import Governorate from "../models/Governorate.js";
import City from "../models/City.js";
import Ad from "../models/Ad.js";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const q = {};
    if (typeof req.query.active !== "undefined") q.isActive = req.query.active === "true";
    const list = await Governorate.find(Object.keys(q).length ? q : {}).sort({ name: 1 }).lean();
    res.json(list);
  } catch (error) {
    console.error("Governorates GET error:", error);
    res.status(500).json({ error: error.message || "Server error" });
  }
});

router.post("/", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const { name, isActive = true } = req.body || {};
    if (!name) return res.status(400).json({ error: "Missing fields" });
    const item = await Governorate.create({ name, isActive: !!isActive });
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
    const updated = await Governorate.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch {
    res.status(400).json({ error: "Update error" });
  }
});

router.delete("/:id", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const citiesCount = await City.countDocuments({ governorateId: req.params.id });
    if (citiesCount > 0) return res.status(400).json({ error: "لا يمكن الحذف لوجود مدن مرتبطة" });
    const adsCount = await Ad.countDocuments({ governorateId: req.params.id });
    if (adsCount > 0) return res.status(400).json({ error: "لا يمكن الحذف لوجود إعلانات مرتبطة" });
    const deleted = await Governorate.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("Governorate delete error:", err);
    res.status(500).json({ error: "حدث خطأ في الخادم أثناء حذف المحافظة." });
  }
});

export default router;
