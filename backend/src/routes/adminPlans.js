import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import Plan from "../models/Plan.js";
import { getFinalPrice } from "../utils/planUtils.js";

const router = Router();

router.use(auth, requireRole(["admin"]));

router.get("/", async (req, res) => {
  try {
    const plans = await Plan.find().sort({ type: 1, durationInDays: 1 }).lean();
    const plansWithCalculated = plans.map(p => ({
      ...p,
      ...getFinalPrice(p)
    }));
    res.json(plansWithCalculated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { 
      name, type, durationInDays, price, currency,
      discountType, discountValue, isSaleActive, saleStartDate, saleEndDate,
      saleLabel, saleType, applyToAllPlans, remainingSlots, isPopularOffer
    } = req.body || {};
    
    if (!name || !type || !durationInDays) return res.status(400).json({ error: "Missing fields" });
    if (!["verification", "featured"].includes(type)) return res.status(400).json({ error: "Invalid type" });
    
    const cur = ["SAR", "YER", "YER_ADEN", "YER_SANAA", "USD"].includes(currency) ? currency : "YER_ADEN";
    
    const planData = { 
      name, type, durationInDays, price: price || 0, currency: cur,
      discountType, discountValue, isSaleActive, saleStartDate, saleEndDate,
      saleLabel, saleType, applyToAllPlans, remainingSlots, isPopularOffer
    };

    const plan = await Plan.create(planData);

    // If applyToAllPlans is true, update all other plans with these sale settings
    if (applyToAllPlans) {
      await Plan.updateMany(
        { _id: { $ne: plan._id } },
        { 
          isSaleActive, 
          discountType, 
          discountValue, 
          saleStartDate, 
          saleEndDate, 
          saleLabel, 
          saleType,
          applyToAllPlans: true
        }
      );
    }

    res.status(201).json(plan);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { 
      name, type, durationInDays, price, currency, isActive,
      discountType, discountValue, isSaleActive, saleStartDate, saleEndDate,
      saleLabel, saleType, applyToAllPlans, remainingSlots, isPopularOffer
    } = req.body || {};
    
    const update = {};
    if (name != null) update.name = name;
    if (type != null) update.type = type;
    if (durationInDays != null) update.durationInDays = durationInDays;
    if (price != null) update.price = price;
    if (currency != null && ["SAR", "YER", "YER_ADEN", "YER_SANAA", "USD"].includes(currency)) update.currency = currency;
    if (isActive != null) update.isActive = isActive;
    
    // Discount fields
    if (discountType != null) update.discountType = discountType;
    if (discountValue != null) update.discountValue = discountValue;
    if (isSaleActive != null) update.isSaleActive = isSaleActive;
    if (saleStartDate !== undefined) update.saleStartDate = saleStartDate;
    if (saleEndDate !== undefined) update.saleEndDate = saleEndDate;
    if (saleLabel != null) update.saleLabel = saleLabel;
    if (saleType != null) update.saleType = saleType;
    if (applyToAllPlans != null) update.applyToAllPlans = applyToAllPlans;
    if (remainingSlots != null) update.remainingSlots = remainingSlots;
    if (isPopularOffer != null) update.isPopularOffer = isPopularOffer;

    const plan = await Plan.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!plan) return res.status(404).json({ error: "Not found" });

    // If applyToAllPlans is true, update all other plans
    if (applyToAllPlans && isSaleActive !== undefined) {
      const saleUpdate = {
        isSaleActive,
        discountType: discountType || plan.discountType,
        discountValue: discountValue || plan.discountValue,
        saleStartDate: saleStartDate !== undefined ? saleStartDate : plan.saleStartDate,
        saleEndDate: saleEndDate !== undefined ? saleEndDate : plan.saleEndDate,
        saleLabel: saleLabel || plan.saleLabel,
        saleType: saleType || plan.saleType,
        applyToAllPlans: true
      };
      await Plan.updateMany({ _id: { $ne: plan._id } }, saleUpdate);
    }

    res.json(plan);
  } catch (err) {
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
