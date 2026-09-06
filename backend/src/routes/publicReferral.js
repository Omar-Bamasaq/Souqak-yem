import { Router } from "express";
import ReferralProfile from "../models/ReferralProfile.js";
import { referralCodeCookie } from "./referrals.js";

const router = Router();
router.get("/r/:code", async (req, res) => {
  const profile = await ReferralProfile.findOne({ referralCode: req.params.code, status: "ACTIVE" }).select("_id").lean();
  if (!profile) return res.redirect("/");
  res.cookie(referralCodeCookie, req.params.code, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 60 * 60 * 1000, path: "/" });
  res.redirect("/");
});
export default router;