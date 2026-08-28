import User from "../models/User.js";
import {
  verifyAccessToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  JWT_ALGORITHM,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  inspectJwtClaimsOnly,
  getAccessSecretFingerprint,
  getRefreshSecretFingerprint,
} from "../config/jwt.js";

const ACCESS_FP = getAccessSecretFingerprint();
const REFRESH_FP = getRefreshSecretFingerprint();
console.log(
  `[AuthMW] Sign+Verify using Access(${ACCESS_FP.length}ch,${ACCESS_FP.sha256first12}) Refresh(${REFRESH_FP.length}ch,${REFRESH_FP.sha256first12}) algo=${JWT_ALGORITHM}`
);

async function auth(req, res, next) {
  let token = req.cookies?.accessToken;
  let source = token ? "cookie" : null;

  if (!token) {
    const header = req.headers.authorization || "";
    token = header && header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (token) source = "header";
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const payload = verifyAccessToken(token);
    const claims = inspectJwtClaimsOnly(token);
    const alg = claims?.header?.alg || "?";

    const user = await User.findById(payload.userId || payload.id).lean();

    if (!user) {
      console.log(
        `[Auth][${req.method} ${req.path}] verified (source=${source} alg=${alg}) but user not found: uid=${
          payload.userId || payload.id
        }`
      );
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    if (user.isDisabled) {
      console.log(
        `[Auth][${req.method} ${req.path}] verified (source=${source}) but user DISABLED: ${user._id}`
      );
      return res.status(403).json({ error: "هذا الحساب محظور من قبل الإدارة." });
    }

    if (user.isDeleted) {
      console.log(
        `[Auth][${req.method} ${req.path}] verified (source=${source}) but user DELETED: ${user._id}`
      );
      return res.status(403).json({ error: "هذا الحساب تم حذفه." });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      name: user.name,
      phone: user.phone,
      identityStatus: user.identityStatus,
      isVerifiedSeller: !!user.isVerifiedSeller,
    };

    console.log(
      `[Auth][${req.method} ${req.path}] OK (source=${source} alg=${alg}) uid=${user._id} role=${user.role}`
    );

    next();
  } catch (error) {
    console.error(
      `[Auth][${req.method} ${req.path}] FAILED (source=${source}): ${error.name} ${error.message}`
    );
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Unauthorized: Token expired",
        code: "TOKEN_EXPIRED",
      });
    }
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
}

export const sendAuthResponse = async (user, res) => {
  const userId = user._id.toString();

  const accessToken = signAccessToken({ id: userId, role: user.role });
  const refreshToken = signRefreshToken({ id: userId });

  await User.findByIdAndUpdate(userId, { refreshToken });

  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };

  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, cookieOptions);

  console.log(
    `[sendAuthResponse] user=${userId} role=${user.role} access_exp=${ACCESS_TOKEN_EXPIRES_IN} refresh_exp=${REFRESH_TOKEN_EXPIRES_IN} algo=${JWT_ALGORITHM}`
  );

  return { accessToken, refreshToken };
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
