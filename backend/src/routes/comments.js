import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import Comment from "../models/Comment.js";
import Joi from "joi";
import { validateParams } from "../middleware/validate.js";

const router = Router();

router.delete("/:id", auth, requireRole(["admin"]), validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })), async (req, res) => {
  try {
    const c = await Comment.findByIdAndDelete(req.params.id).lean();
    if (!c) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/:id/report", auth, validateParams(Joi.object({ id: Joi.string().length(24).hex().required() })), async (req, res) => {
  try {
    const c = await Comment.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Not found" });
    c.reports = (c.reports || 0) + 1;
    await c.save();
    res.json({ ok: true, reports: c.reports });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
