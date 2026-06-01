import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import Plan from "../models/Plan.js";

const router = Router();

router.use(auth, requireRole(["admin"]));

router.get("/", async (req, res) => {
  try {
    const plans = await Plan.find().sort({ type: 1, durationInDays: 1 }).lean();
    res.json(plans);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, type, durationInDays, price, currency } = req.body || {};
    if (!name || !type || !durationInDays) return res.status(400).json({ error: "Missing fields" });
    if (!["verification", "featured"].includes(type)) return res.status(400).json({ error: "Invalid type" });
    const cur = ["SAR", "YER", "YER_ADEN", "YER_SANAA", "USD"].includes(currency) ? currency : "YER_ADEN";
    const plan = await Plan.create({ name, type, durationInDays, price: price || 0, currency: cur });
    res.status(201).json(plan);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { name, type, durationInDays, price, currency, isActive } = req.body || {};
    const update = {};
    if (name != null) update.name = name;
    if (type != null) update.type = type;
    if (durationInDays != null) update.durationInDays = durationInDays;
    if (price != null) update.price = price;
    if (currency != null && ["SAR", "YER", "YER_ADEN", "YER_SANAA", "USD"].includes(currency)) update.currency = currency;
    if (isActive != null) update.isActive = isActive;
    const plan = await Plan.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!plan) return res.status(404).json({ error: "Not found" });
    res.json(plan);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
