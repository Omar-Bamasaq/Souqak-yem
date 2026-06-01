import { Router } from "express";
import auth from "../middleware/auth.js";
import User from "../models/User.js";
import crypto from "crypto";

const router = Router();

router.post("/send-otp", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.email) return res.status(400).json({ error: "Email required" });
    const code = String(crypto.randomInt(100000, 1000000));
    const expires = new Date(Date.now() + 5 * 60 * 1000);
    user.emailOTP = code;
    user.otpExpiresAt = expires;
    await user.save();
    console.log(`OTP to ${user.email}: ${code}`);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/verify-otp", auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Code required" });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.emailOTP || !user.otpExpiresAt) return res.status(400).json({ error: "No active OTP" });
    if (user.otpExpiresAt.getTime() < Date.now()) {
      user.emailOTP = undefined;
      user.otpExpiresAt = undefined;
      await user.save();
      return res.status(400).json({ error: "Code expired" });
    }
    if (user.emailOTP !== String(code)) return res.status(400).json({ error: "Invalid code" });
    user.isEmailVerified = true;
    user.emailOTP = undefined;
    user.otpExpiresAt = undefined;
    await user.save();
    res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, isEmailVerified: user.isEmailVerified }
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
