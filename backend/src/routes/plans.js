import { Router } from "express";
import Plan from "../models/Plan.js";
import { getFinalPrice } from "../utils/planUtils.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { type } = req.query;
    const filter = { isActive: true };
    if (type) filter.type = type;
    const plans = await Plan.find(filter).sort({ type: 1, durationInDays: 1 }).lean();
    
    // Add discount info
    const plansWithDiscounts = plans.map(plan => ({
      ...plan,
      ...getFinalPrice(plan)
    }));

    res.json(plansWithDiscounts);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
