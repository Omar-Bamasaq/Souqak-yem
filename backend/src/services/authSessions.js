import crypto from "crypto";
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import AuthSession from "../models/AuthSession.js";
import StorePwaHandoff from "../models/StorePwaHandoff.js";
import User from "../models/User.js";
import {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  signAccessToken,
  verifyRefreshToken
} from "../config/jwt.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_RACE_GRACE_MS = 30_000;

function getAuthVersion(value) {
  const version = Number(value);
  return Number.isSafeInteger(version) && version >= 0 ? version : 0;
}

function durationToMs(value, fallback) {
  const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?$/i);
  if (!match) return fallback;
  const amount = Number(match[1]);
  const unit = (match[2] || "ms").toLowerCase();
  const multiplier = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 60 * 60_000,
    d: DAY_MS,
    w: 7 * DAY_MS
  }[unit];
  return Number.isFinite(amount * multiplier) ? amount * multiplier : fallback;
}

export const REFRESH_SESSION_TTL_MS = durationToMs(REFRESH_TOKEN_EXPIRES_IN, 30 * DAY_MS);
export const ACCESS_COOKIE_TTL_MS = durationToMs(ACCESS_TOKEN_EXPIRES_IN, 7 * DAY_MS);

export function hashAuthToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function createOpaqueAuthToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function getStorePwaIdFromRequest(req) {
  const value = req.headers?.["x-souqak-store-pwa-id"];
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value) ? value : null;
}

export function getAuthSessionContext(req) {
  const rawStoreId = req.headers?.["x-souqak-store-pwa-id"];
  if (rawStoreId === undefined) return { appType: "main", storeProfileId: null };
  const storeId = getStorePwaIdFromRequest(req);
  if (!storeId) {
    const error = new Error("Store PWA ID is invalid.");
    error.status = 400;
    throw error;
  }

  const expectedOrigin = process.env.STORE_PWA_ORIGIN || "https://apps.souqak-yem.com";
  const origin = req.headers?.origin;
  let normalizedExpectedOrigin = expectedOrigin;
  try {
    normalizedExpectedOrigin = new URL(expectedOrigin).origin;
  } catch {
    const error = new Error("Store PWA origin is misconfigured.");
    error.status = 500;
    throw error;
  }
  const isExpectedOrigin = origin === normalizedExpectedOrigin;
  const isLocalDevOrigin = process.env.NODE_ENV !== "production"
    && typeof origin === "string"
    && /^https?:\/\/localhost(?::\d+)?$/.test(origin);
  if (!isExpectedOrigin && !isLocalDevOrigin) {
    const error = new Error("Store PWA session origin is not allowed.");
    error.status = 403;
    throw error;
  }

  return { appType: "store-pwa", storeProfileId: new mongoose.Types.ObjectId(storeId) };
}

export function getRefreshCookieName(context) {
  return context.appType === "store-pwa"
    ? `storeRefresh_${String(context.storeProfileId)}`
    : "refreshToken";
}

export function getRefreshCookiePath(context) {
  return context.appType === "store-pwa"
    ? `/api/auth/store-pwa/${String(context.storeProfileId)}`
    : "/";
}

export function getRefreshCookieOptions(context, maxAge = REFRESH_SESSION_TTL_MS) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: getRefreshCookiePath(context),
    maxAge
  };
}

export function getAccessCookieOptions(maxAge = ACCESS_COOKIE_TTL_MS) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/",
    maxAge
  };
}

export async function createAuthSession({
  user,
  context = { appType: "main", storeProfileId: null },
  sourceSessionId = null,
  sourceAccessTokenHash = null,
  refreshToken = createOpaqueAuthToken(),
  legacy = false,
  now = new Date()
}) {
  const refreshTokenHash = hashAuthToken(refreshToken);
  const sessionId = randomUUID();
  const authVersion = getAuthVersion(user.authVersion);
  const expiresAt = new Date(now.getTime() + REFRESH_SESSION_TTL_MS);
  const session = await AuthSession.create({
    sessionId,
    userId: user._id,
    authVersion,
    appType: context.appType,
    storeProfileId: context.storeProfileId,
    initialRefreshTokenHash: refreshTokenHash,
    currentRefreshTokenHash: refreshTokenHash,
    usedRefreshTokenHashes: [],
    expiresAt,
    sourceSessionId,
    sourceAccessTokenHash,
    legacyMigrated: legacy,
    lastUsedAt: now
  });
  const accessToken = signAccessToken({
    id: String(user._id),
    role: user.role,
    sid: sessionId
  });
  return { session, accessToken, refreshToken, expiresAt };
}

function matchesSessionContext(session, context) {
  return session.appType === context.appType
    && (context.appType !== "store-pwa"
      || String(session.storeProfileId) === String(context.storeProfileId));
}

export async function revokeSessionForRefreshToken(refreshToken, context, reason = "session_replaced") {
  if (!refreshToken) return [];
  const session = await AuthSession.findOne({
    currentRefreshTokenHash: hashAuthToken(refreshToken),
    appType: context.appType,
    storeProfileId: context.storeProfileId || null,
    revokedAt: null
  }).select("sessionId").lean();
  return session ? revokeAuthSession(session.sessionId, reason) : [];
}

async function findOrMigrateLegacySession(refreshToken, context, now) {
  if (context.appType !== "main") return null;
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    return null;
  }
  const userId = payload.id || payload.userId;
  if (!userId) return null;
  const user = await User.findById(userId);
  if (!user || user.isDisabled || user.isDeleted
    || user.refreshToken !== refreshToken) {
    return null;
  }

  const tokenHash = hashAuthToken(refreshToken);
  let session = await AuthSession.findOne({ initialRefreshTokenHash: tokenHash });
  if (session) {
    await User.updateOne(
      { _id: user._id, refreshToken },
      {
        $set: { legacyRefreshTokenDisabledAt: now },
        $unset: { refreshToken: 1 }
      }
    );
    return session;
  }
  if (user.legacyRefreshTokenDisabledAt) {
    const disabledAt = new Date(user.legacyRefreshTokenDisabledAt).getTime();
    if (Number.isFinite(disabledAt) && now.getTime() - disabledAt < 1_000) {
      for (let attempt = 0; attempt < 3 && !session; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
        session = await AuthSession.findOne({ initialRefreshTokenHash: tokenHash });
      }
    }
    if (!session) {
      await User.updateOne(
        { _id: user._id, refreshToken },
        { $unset: { refreshToken: 1 } }
      );
    }
    return session;
  }

  try {
    session = await AuthSession.create({
      sessionId: randomUUID(),
      userId: user._id,
      authVersion: getAuthVersion(user.authVersion),
      appType: "main",
      storeProfileId: null,
      initialRefreshTokenHash: tokenHash,
      currentRefreshTokenHash: tokenHash,
      usedRefreshTokenHashes: [],
      expiresAt: new Date(now.getTime() + REFRESH_SESSION_TTL_MS),
      legacyMigrated: true,
      lastUsedAt: now
    });
  } catch (error) {
    session = await AuthSession.findOne({ initialRefreshTokenHash: tokenHash });
    if (!session) throw error;
  }

  const claimed = await User.findOneAndUpdate(
    {
      _id: user._id,
      refreshToken,
      $or: [
        { legacyRefreshTokenDisabledAt: null },
        { legacyRefreshTokenDisabledAt: { $exists: false } }
      ]
    },
    {
      $set: { legacyRefreshTokenDisabledAt: now },
      $unset: { refreshToken: 1 }
    },
    { new: true }
  );
  if (!claimed) {
    const latestUser = await User.findById(user._id).select(
      "refreshToken legacyRefreshTokenDisabledAt authVersion"
    ).lean();
    if (latestUser?.legacyRefreshTokenDisabledAt
      && !latestUser.refreshToken
      && getAuthVersion(latestUser.authVersion) === getAuthVersion(session.authVersion)) {
      return session;
    }
    await revokeAuthSession(session.sessionId, "legacy_migration_conflict", now);
    return null;
  }
  return session;
}

export async function rotateRefreshSession(refreshToken, context, now = new Date()) {
  if (!refreshToken) return { status: "missing" };
  const tokenHash = hashAuthToken(refreshToken);
  let session = await AuthSession.findOne({
    currentRefreshTokenHash: tokenHash,
    revokedAt: null,
    expiresAt: { $gt: now }
  });
  if (session?.legacyMigrated && context.appType === "main") {
    await User.updateOne(
      { _id: session.userId, refreshToken },
      {
        $set: { legacyRefreshTokenDisabledAt: now },
        $unset: { refreshToken: 1 }
      }
    );
  }

  if (!session) {
    session = await findOrMigrateLegacySession(refreshToken, context, now);
    if (session?.currentRefreshTokenHash !== tokenHash
      || session?.revokedAt
      || session?.expiresAt <= now) {
      session = null;
    }
  }
  if (!session || !matchesSessionContext(session, context)) {
    const stale = await AuthSession.findOne({
      usedRefreshTokenHashes: tokenHash,
      revokedAt: null
    });
    if (stale && matchesSessionContext(stale, context)) {
      if (stale.previousRefreshTokenHash === tokenHash
        && stale.previousTokenValidUntil
        && stale.previousTokenValidUntil > now) {
        return { status: "rotated", retryAfterMs: 150 };
      }
      const sessionIds = await revokeAuthSession(stale.sessionId, "refresh_token_reuse", now);
      return { status: "reused", sessionIds };
    }
    return { status: "invalid" };
  }

  const user = await User.findById(session.userId);
  if (!user || user.isDisabled || user.isDeleted) {
    await revokeAuthSession(session.sessionId, "account_unavailable", now);
    return { status: "invalid" };
  }
  if (getAuthVersion(session.authVersion) !== getAuthVersion(user.authVersion)) {
    await revokeAuthSession(session.sessionId, "auth_version_changed", now);
    return { status: "invalid" };
  }
  if (session.sourceSessionId
    && !(await isAuthSessionActive(session.sourceSessionId, session.userId, now))) {
    await revokeAuthSession(session.sessionId, "source_session_revoked", now);
    return { status: "invalid" };
  }

  const nextRefreshToken = createOpaqueAuthToken();
  const nextHash = hashAuthToken(nextRefreshToken);
  const nextExpiresAt = new Date(now.getTime() + REFRESH_SESSION_TTL_MS);
  const updated = await AuthSession.findOneAndUpdate(
    {
      _id: session._id,
      currentRefreshTokenHash: tokenHash,
      revokedAt: null,
      expiresAt: { $gt: now }
    },
    {
      $set: {
        currentRefreshTokenHash: nextHash,
        previousRefreshTokenHash: tokenHash,
        previousTokenValidUntil: new Date(now.getTime() + REFRESH_RACE_GRACE_MS),
        expiresAt: nextExpiresAt,
        lastUsedAt: now
      },
      $addToSet: { usedRefreshTokenHashes: tokenHash }
    },
    { new: true }
  );
  if (!updated) return rotateRefreshSession(refreshToken, context, now);

  return {
    status: "ok",
    session: updated,
    user,
    accessToken: signAccessToken({
      id: String(user._id),
      role: user.role,
      sid: updated.sessionId
    }),
    refreshToken: nextRefreshToken,
    expiresAt: nextExpiresAt
  };
}

export async function isAuthSessionActive(sessionId, userId, now = new Date()) {
  if (!sessionId) return true;
  const session = await AuthSession.findOne({
    sessionId,
    userId,
    revokedAt: null,
    expiresAt: { $gt: now }
  }).lean();
  if (!session) return false;
  const user = await User.findById(userId).select("authVersion").lean();
  if (!user
    || getAuthVersion(session.authVersion) !== getAuthVersion(user.authVersion)) {
    await revokeAuthSession(sessionId, "auth_version_changed", now);
    return false;
  }
  if (session.sourceSessionId
    && !(await isAuthSessionActive(session.sourceSessionId, userId, now))) {
    await AuthSession.updateOne(
      { sessionId, revokedAt: null },
      { $set: { revokedAt: now, revokeReason: "source_session_revoked" } }
    );
    return false;
  }
  return true;
}

export async function isLegacyAccessTokenActive(accessToken, userId) {
  const revokedSession = await AuthSession.exists({
    userId,
    sourceAccessTokenHash: hashAuthToken(accessToken),
    legacyAccessSource: true,
    revokedAt: { $ne: null }
  });
  return !revokedSession;
}

export async function revokeAuthSession(sessionId, reason = "logout", now = new Date()) {
  if (!sessionId) return [];
  const childSessionIds = await AuthSession.find({
    sourceSessionId: sessionId,
    revokedAt: null
  }).distinct("sessionId");
  await Promise.all([
    AuthSession.updateMany(
      { $or: [{ sessionId }, { sourceSessionId: sessionId }], revokedAt: null },
      { $set: { revokedAt: now, revokeReason: reason } }
    ),
    StorePwaHandoff.updateMany(
      { sourceSessionId: sessionId, consumedAt: null, revokedAt: null },
      { $set: { revokedAt: now } }
    )
  ]);
  return [...new Set([sessionId, ...childSessionIds])];
}

export async function revokeSessionsForSourceAccessToken(accessToken, reason = "source_logout", now = new Date()) {
  if (!accessToken) return;
  const sourceAccessTokenHash = hashAuthToken(accessToken);
  const sourceSessions = await AuthSession.find({ sourceAccessTokenHash })
    .distinct("sessionId");
  await Promise.all([
    AuthSession.updateMany(
      {
        $or: [
          { sourceAccessTokenHash },
          { sourceSessionId: { $in: sourceSessions } }
        ],
        revokedAt: null
      },
      { $set: { revokedAt: now, revokeReason: reason } }
    ),
    StorePwaHandoff.updateMany(
      { sourceAccessTokenHash, revokedAt: null },
      { $set: { revokedAt: now } }
    )
  ]);
  return sourceSessions;
}

export async function createStorePwaHandoff({
  userId,
  targetStoreId,
  sourceSessionId = null,
  sourceAccessTokenHash = null,
  now = new Date()
}) {
  const grant = createOpaqueAuthToken();
  const expiresAt = new Date(now.getTime() + 60_000);
  await StorePwaHandoff.create({
    grantHash: hashAuthToken(grant),
    userId,
    targetStoreId,
    sourceSessionId,
    sourceAccessTokenHash,
    expiresAt
  });
  return { grant, expiresAt };
}

export async function createLegacyAccessSourceSession({
  userId,
  accessToken,
  now = new Date()
}) {
  const tokenHash = hashAuthToken(accessToken);
  let session = await AuthSession.findOne({
    userId,
    sourceAccessTokenHash: tokenHash,
    legacyAccessSource: true,
    revokedAt: null,
    expiresAt: { $gt: now }
  });
  if (session) return session;

  const legacySessionId = `legacy-access-${tokenHash}`;
  const syntheticTokenHash = hashAuthToken(createOpaqueAuthToken());
  const expiresAt = new Date(now.getTime() + REFRESH_SESSION_TTL_MS);
  const user = await User.findById(userId).select("authVersion").lean();
  try {
    session = await AuthSession.create({
      sessionId: legacySessionId,
      userId,
      authVersion: getAuthVersion(user?.authVersion),
      appType: "main",
      initialRefreshTokenHash: syntheticTokenHash,
      currentRefreshTokenHash: syntheticTokenHash,
      expiresAt,
      sourceAccessTokenHash: tokenHash,
      legacyMigrated: true,
      legacyAccessSource: true
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    session = await AuthSession.findOne({
      sessionId: legacySessionId,
      userId,
      revokedAt: null,
      expiresAt: { $gt: now }
    });
  }
  return session;
}

export async function consumeStorePwaHandoff({
  grant,
  targetStoreId,
  now = new Date()
}) {
  if (!grant) return null;
  return StorePwaHandoff.findOneAndUpdate(
    {
      grantHash: hashAuthToken(grant),
      targetStoreId,
      expiresAt: { $gt: now },
      consumedAt: null,
      revokedAt: null
    },
    { $set: { consumedAt: now } },
    { new: true }
  );
}
