import jwt from "jsonwebtoken";
import User from "../models/User.js";

async function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header && header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const secret = process.env.JWT_SECRET || "dev_secret_key_change_this_in_production_12345";
    console.log('Using secret:', secret);
    const payload = jwt.verify(token, secret);
    console.log('Token payload:', payload);
    const user = await User.findById(payload.userId || payload.id).lean();
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (user.isDisabled) return res.status(403).json({ error: "هذا الحساب محظور من قبل الإدارة." });
    if (user.isDeleted) return res.status(403).json({ error: "هذا الحساب تم حذفه." });
    req.user = {
      id: user._id.toString(),
      role: user.role,
      name: user.name,
      phone: user.phone,
      isPhoneVerified: !!user.isPhoneVerified,
      identityStatus: user.identityStatus,
      isVerifiedSeller: !!user.isVerifiedSeller,
      verificationExpiresAt: user.verificationExpiresAt
    };
    console.log('Auth success:', req.user.id, req.user.role);
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    res.status(401).json({ error: "Unauthorized" });
  }
}

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

export const authenticate = auth;
export default auth;
