import jwt from "jsonwebtoken";
import User from "../models/User.js";

const ACCESS_SECRET = process.env.JWT_SECRET || "access_dev_secret_12345";
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || "refresh_dev_secret_54321";

/**
 * Enhanced Authentication Middleware
 * Supports both HttpOnly Cookies (Primary) and Bearer Token (Legacy/Compatibility)
 */
async function auth(req, res, next) {
  // 1. Try to get token from HttpOnly Cookie first
  let token = req.cookies?.accessToken;

  // 2. Fallback to Authorization Header (Bearer)
  if (!token) {
    const header = req.headers.authorization || "";
    token = header && header.startsWith("Bearer ") ? header.slice(7) : null;
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    
    // Check user in DB to ensure account is still active/valid
    const user = await User.findById(payload.userId || payload.id).lean();
    
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    if (user.isDisabled) {
      return res.status(403).json({ error: "هذا الحساب محظور من قبل الإدارة." });
    }

    if (user.isDeleted) {
      return res.status(403).json({ error: "هذا الحساب تم حذفه." });
    }

    // Attach minimal user info to request
    req.user = {
      id: user._id.toString(),
      role: user.role,
      name: user.name,
      phone: user.phone,
      identityStatus: user.identityStatus,
      isVerifiedSeller: !!user.isVerifiedSeller
    };

    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Unauthorized: Token expired", code: "TOKEN_EXPIRED" });
    }
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
}

/**
 * Helper to generate tokens and set cookies
 */
export const sendAuthResponse = async (user, res) => {
  const userId = user._id.toString();
  
  const accessToken = jwt.sign({ id: userId, role: user.role }, ACCESS_SECRET, {
    expiresIn: "15m" // Short lived access token
  });

  const refreshToken = jwt.sign({ id: userId }, REFRESH_SECRET, {
    expiresIn: "7d" // Long lived refresh token
  });

  // Store hashed/plain refresh token in DB for rotation/revocation
  await User.findByIdAndUpdate(userId, { refreshToken });

  const isProduction = process.env.NODE_ENV === "production";

  // Set HttpOnly Cookies
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction, // HTTPS only in prod
    sameSite: isProduction ? "none" : "lax", // none for cross-site in prod (if needed)
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };

  res.cookie("accessToken", accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie("refreshToken", refreshToken, cookieOptions);

  return { accessToken, refreshToken }; // Return for legacy support if needed
};

/**
 * Admin only middleware
 */
export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

export const authenticate = auth;
export default auth;
