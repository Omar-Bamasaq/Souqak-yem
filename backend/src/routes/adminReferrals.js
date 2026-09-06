import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import adminAudit from "../middleware/adminAudit.js";
import ReferralProfile from "../models/ReferralProfile.js";
import ReferralRelationship from "../models/ReferralRelationship.js";
import ReferralCommission from "../models/ReferralCommission.js";
import ReferralEngine from "../engines/ReferralEngine.js";
import SystemSettings from "../models/SystemSettings.js";
import User from "../models/User.js";
import Joi from "joi";
import { validateBody } from "../middleware/validate.js";

const router = Router();
const requireBearerHeader = (req, res, next) => {
  if (!req.headers.authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization header required" });
  }
  next();
};
router.use(requireBearerHeader, auth, requireRole(["admin"]), adminAudit());

router.get("/overview", async (req, res) => {
  const [ambassadors, relationships, commissions] = await Promise.all([
    ReferralProfile.countDocuments(),
    ReferralRelationship.countDocuments({ status: "ACTIVE" }),
    ReferralCommission.aggregate([{ $group: { _id: "$status", total: { $sum: "$commissionAmount" }, count: { $sum: 1 } } }])
  ]);
  res.json({ ambassadors, relationships, commissions: Object.fromEntries(commissions.map(item => [item._id, item])) });
});

router.get("/ambassadors", async (req, res) => {
  res.json(await ReferralProfile.find().populate("userId", "name email phone role").sort({ createdAt: -1 }).lean());
});

router.get("/relationships", async (req, res) => {
  res.json(await ReferralRelationship.find().populate("referrerUserId", "name email").populate("referredUserId", "name email").sort({ createdAt: -1 }).lean());
});

router.get("/commissions", async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.sourceType) filter.sourceType = req.query.sourceType;
  res.json(await ReferralCommission.find(filter).populate("referrerUserId", "name email").populate("referredUserId", "name email").sort({ createdAt: -1 }).limit(500).lean());
});

router.patch("/commissions/:id/freeze", async (req, res) => {
  const item = await ReferralCommission.findOneAndUpdate({ _id: req.params.id, status: "AVAILABLE" }, { status: "FROZEN", reversalReason: req.body?.reason || "مراجعة إدارية" }, { new: true });
  if (!item) return res.status(404).json({ error: "العمولة غير موجودة أو لا يمكن تجميدها" });
  res.json(item);
});

router.patch("/commissions/:id/release", async (req, res) => {
  const item = await ReferralCommission.findOneAndUpdate({ _id: req.params.id, status: "FROZEN" }, { status: "AVAILABLE", availableAt: new Date() }, { new: true });
  if (!item) return res.status(404).json({ error: "العمولة غير مجمدة" });
  res.json(item);
});

router.get("/withdrawals", async (req, res) => {
  const Withdrawal = (await import("../models/Withdrawal.js")).default;
  res.json(await Withdrawal.find().populate("user", "name email phone").sort({ createdAt: -1 }).limit(500).lean());
});

router.get("/fraud-flags", async (req, res) => {
  res.json(await ReferralRelationship.find({ fraudFlags: { $exists: true, $not: { $size: 0 } } }).populate("referrerUserId", "name email").populate("referredUserId", "name email").lean());
});

router.post("/relationships/:id/override", validateBody(Joi.object({ referrerUserId: Joi.string().length(24).hex().required(), reason: Joi.string().min(5).required() })), async (req, res) => {
  const relationship = await ReferralRelationship.findById(req.params.id);
  if (!relationship) return res.status(404).json({ error: "العلاقة غير موجودة" });
  if (String(relationship.referrerUserId) === String(req.body.referrerUserId)) return res.status(400).json({ error: "السفير لم يتغير" });
  if (String(relationship.referredUserId) === String(req.body.referrerUserId)) return res.status(400).json({ error: "لا يمكن إسناد المستخدم إلى نفسه" });
  const newReferrer = await User.findOne({ _id: req.body.referrerUserId, isDeleted: { $ne: true }, isDisabled: { $ne: true } }).select("_id").lean();
  if (!newReferrer) return res.status(400).json({ error: "السفير الجديد غير صالح" });
  relationship.referrerUserId = req.body.referrerUserId;
  relationship.adminOverride = true;
  relationship.attributionMethod = "ADMIN_OVERRIDE";
  relationship.overrideReason = req.body.reason;
  relationship.createdBy = req.user.id;
  await relationship.save();
  res.json(relationship);
});

router.patch("/settings", validateBody(Joi.object({ referralProgram: Joi.object().required() })), async (req, res) => {
  const settings = await SystemSettings.getSettings();
  settings.referralProgram = { ...settings.referralProgram.toObject(), ...req.body.referralProgram };
  settings.updatedBy = req.user.id;
  await settings.save();
  res.json(settings.referralProgram);
});

export default router;