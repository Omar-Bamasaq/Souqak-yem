import { Router } from "express";
import Plan from "../models/Plan.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { isActive: true };
    if (type) filter.type = type;
    const plans = await Plan.find(filter).sort({ type: 1, durationInDays: 1 }).lean();
    res.json(plans);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
