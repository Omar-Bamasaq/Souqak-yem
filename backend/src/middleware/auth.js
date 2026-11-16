import User from "../models/User.js";
import {
  verifyAccessToken,
  inspectJwtClaimsOnly
} from "../config/jwt.js";
import {
  ACCESS_COOKIE_TTL_MS,
  createAuthSession,
  getAccessCookieOptions,
  getAuthSessionContext,
  getRefreshCookieName,
  getRefreshCookieOptions,
  isAuthSessionActive,
  isLegacyAccessTokenActive,
  revokeSessionForRefreshToken
} from "../services/authSessions.js";

async function auth(req, res, next) {
  const shouldLogRequest = !req.privateMessageAttachmentRequest;
  const header = req.headers.authorization || "";
  let token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  let source = token ? "header" : null;
  const hasStorePwaContext = req.headers["x-souqak-store-pwa-id"] !== undefined;
  if (!token && !hasStorePwaContext) {
    token = req.cookies?.accessToken || null;
    if (token) source = "cookie";
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
      if (shouldLogRequest) {
        console.log(
          `[Auth][${req.method} ${req.path}] verified (source=${source} alg=${alg}) but user not found: uid=${
            payload.userId || payload.id
          }`
        );
      }
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }

    if (payload.sid && !(await isAuthSessionActive(payload.sid, user._id))) {
      return res.status(401).json({ error: "Unauthorized: Session revoked", code: "SESSION_REVOKED" });
    }
    if (!payload.sid) {
      const legacyAccessRevokedAt = user.legacyAccessTokensRevokedAt
        ? new Date(user.legacyAccessTokensRevokedAt).getTime()
        : 0;
      if ((legacyAccessRevokedAt && payload.iat * 1000 <= legacyAccessRevokedAt)
        || !(await isLegacyAccessTokenActive(token, user._id))) {
        return res.status(401).json({ error: "Unauthorized: Legacy session revoked", code: "SESSION_REVOKED" });
      }
    }

    if (user.isDisabled) {
      if (shouldLogRequest) {
        console.log(
          `[Auth][${req.method} ${req.path}] verified (source=${source}) but user DISABLED: ${user._id}`
        );
      }
      return res.status(403).json({ error: "هذا الحساب محظور من قبل الإدارة." });
    }

    if (user.isDeleted) {
      if (shouldLogRequest) {
        console.log(
          `[Auth][${req.method} ${req.path}] verified (source=${source}) but user DELETED: ${user._id}`
        );
      }
      return res.status(403).json({ error: "هذا الحساب تم حذفه." });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      permissions: Array.isArray(user.permissions) ? user.permissions : [],
      name: user.name,
      phone: user.phone,
      phoneVerifiedAt: user.phoneVerifiedAt || null,
      identityStatus: user.identityStatus,
      isVerifiedSeller: !!user.isVerifiedSeller,
      verificationStatus: user.verificationStatus,
      verificationExpiryDate: user.verificationExpiryDate,
      isDisabled: !!user.isDisabled,
      isDeleted: !!user.isDeleted,
    };
    req.authSessionId = payload.sid || null;
    req.authToken = token;

    if (shouldLogRequest) {
      console.log(
        `[Auth][${req.method} ${req.path}] OK (source=${source} alg=${alg}) uid=${user._id} role=${user.role}`
      );
    }

    next();
  } catch (error) {
    if (shouldLogRequest) {
      console.error(
        `[Auth][${req.method} ${req.path}] FAILED (source=${source}): ${error.name} ${error.message}`
      );
    }
    if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(error.name)) {
      if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Unauthorized: Token expired",
        code: "TOKEN_EXPIRED",
      });
      }
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
    next(error);
  }
}

export const sendAuthResponse = async (user, res, { req } = {}) => {
  const userId = user._id.toString();
  const context = getAuthSessionContext(req || { headers: {} });
  const existingRefreshToken = req?.cookies?.[getRefreshCookieName(context)];
  const revokedSessionIds = await revokeSessionForRefreshToken(existingRefreshToken, context);
  disconnectAuthSessionSockets(req, revokedSessionIds);
  const { accessToken, refreshToken } = await createAuthSession({ user, context });
  const refreshCookieOptions = getRefreshCookieOptions(context);
  res.cookie(getRefreshCookieName(context), refreshToken, refreshCookieOptions);

  if (context.appType === "main") {
    res.cookie("accessToken", accessToken, getAccessCookieOptions(ACCESS_COOKIE_TTL_MS));
    if (user.refreshToken) {
      await User.updateOne(
        {
          _id: userId,
          refreshToken: user.refreshToken
        },
        {
          $set: {
            legacyRefreshTokenDisabledAt: user.legacyRefreshTokenDisabledAt || new Date()
          },
          $unset: { refreshToken: 1 }
        }
      );
    }
  }

  console.log(
    `[sendAuthResponse] user=${userId} role=${user.role} app=${context.appType}`
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

export function disconnectAuthSessionSockets(req, sessionIds = []) {
  const io = req?.app?.get("io");
  if (!io) return;
  for (const sessionId of new Set(sessionIds.filter(Boolean))) {
    io.in(`session:${sessionId}`).disconnectSockets(true);
  }
}

export const authenticate = auth;
export default auth;
