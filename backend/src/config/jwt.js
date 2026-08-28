import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadDotenvIfNeeded() {
  if (globalThis.__suqaq_dotenv_loaded) return;
  const backendRoot = path.resolve(__dirname, "..", "..");
  const candidates = [
    path.join(backendRoot, ".env.local"),
    path.join(backendRoot, "..", ".env.local"),
    path.join(backendRoot, ".env"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      try {
        const r = dotenv.config({ path: c, override: true });
        process.env = { ...r.parsed, ...process.env };
      } catch (e) {
        /* ignore */
      }
    }
  }
  globalThis.__suqaq_dotenv_loaded = true;
}

const _FALLBACK_ACCESS_TOKEN_SECRET = "access_dev_secret_12345";
const _FALLBACK_REFRESH_TOKEN_SECRET = "refresh_dev_secret_12345";
const _FALLBACK_JWT_SECRET = _FALLBACK_ACCESS_TOKEN_SECRET;

export const JWT_ALGORITHM = "HS256";
export const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "7d";
export const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "30d";

export function getAccessTokenSecret() {
  loadDotenvIfNeeded();
  const s =
    process.env.JWT_ACCESS_SECRET ||
    process.env.ACCESS_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    process.env.ACCESS_SECRET ||
    _FALLBACK_ACCESS_TOKEN_SECRET;
  return String(s).trim();
}

export function getRefreshTokenSecret() {
  loadDotenvIfNeeded();
  const s =
    process.env.JWT_REFRESH_SECRET ||
    process.env.REFRESH_TOKEN_SECRET ||
    process.env.REFRESH_SECRET ||
    _FALLBACK_REFRESH_TOKEN_SECRET;
  return String(s).trim();
}

export function getJwtSecret() {
  return getAccessTokenSecret();
}

export function getAccessSecretFingerprint() {
  const s = getAccessTokenSecret();
  return {
    length: s ? s.length : 0,
    sha256first12: s
      ? crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 12)
      : "000000000000",
  };
}

export function getRefreshSecretFingerprint() {
  const s = getRefreshTokenSecret();
  return {
    length: s ? s.length : 0,
    sha256first12: s
      ? crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 12)
      : "000000000000",
  };
}

export function isUsingFallbackAccessSecret() {
  const fp = getAccessSecretFingerprint();
  const fallbackFp = crypto
    .createHash("sha256")
    .update(_FALLBACK_ACCESS_TOKEN_SECRET)
    .digest("hex")
    .slice(0, 12);
  return fp.sha256first12 === fallbackFp;
}

export function signAccessToken(payload) {
  return jwt_sign(payload, getAccessTokenSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
}

export function signRefreshToken(payload) {
  return jwt_sign(payload, getRefreshTokenSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  });
}

export function verifyAccessToken(token) {
  return jwt_verify(token, getAccessTokenSecret(), {
    algorithms: [JWT_ALGORITHM],
  });
}

export function verifyRefreshToken(token) {
  return jwt_verify(token, getRefreshTokenSecret(), {
    algorithms: [JWT_ALGORITHM],
  });
}

import jwt from "jsonwebtoken";

function jwt_sign(payload, secret, options) {
  return jwt.sign(payload, secret, options);
}

function jwt_verify(token, secret, options) {
  return jwt.verify(token, secret, options);
}

export function inspectJwtClaimsOnly(rawToken) {
  try {
    const parts = String(rawToken || "").trim().split(".");
    if (parts.length !== 3) return null;
    const b64UrlDecode = (s) => {
      const pad = "=".repeat(((4 - (s.length % 4)) % 4));
      const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    };
    const header = b64UrlDecode(parts[0]);
    const payload = b64UrlDecode(parts[1]);
    return { header, payload };
  } catch (e) {
    return null;
  }
}

let __loaded_once = false;
if (!__loaded_once) {
  loadDotenvIfNeeded();
  const fp = getAccessSecretFingerprint();
  const rfp = getRefreshSecretFingerprint();
  console.log(
    `[JWTConfig] Access secret fingerprint=len=${fp.length} sha=${fp.sha256first12} fallback=${
      isUsingFallbackAccessSecret() ? "YES" : "NO"
    }`
  );
  console.log(
    `[JWTConfig] Refresh secret fingerprint=len=${rfp.length} sha=${rfp.sha256first12}`
  );
  __loaded_once = true;
}

export default {
  JWT_ALGORITHM,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  getAccessTokenSecret,
  getRefreshTokenSecret,
  getJwtSecret,
  getAccessSecretFingerprint,
  getRefreshSecretFingerprint,
  isUsingFallbackAccessSecret,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  inspectJwtClaimsOnly,
  loadDotenvIfNeeded,
};
