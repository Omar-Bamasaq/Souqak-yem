import helmet from "helmet";
import crypto from "crypto";
import NodeCache from "node-cache";
import { getBackendBaseUrl } from "../utils/siteUrl.js";

const MAX_TRACKED_IPS = 10_000;
const blockCache = new NodeCache({ stdTTL: 3600, maxKeys: MAX_TRACKED_IPS });
const requestHistory = new Map();
let requestHistorySweepCounter = 0;
import { logSecurityEvent } from "../utils/logger.js";

/**
 * Production-Grade Security Headers
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://souqak-yem.com", "https://www.souqak-yem.com"],
      connectSrc: ["'self'", "https://souqak-yem.com", "https://www.souqak-yem.com", getBackendBaseUrl(), getBackendBaseUrl().replace(/^http/, "ws")],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameAncestors: ["'none'"], // Strictly prevent iframe embedding
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xFrameOptions: { action: "deny" },
  xContentTypeOptions: true,
  xPermittedCrossDomainPolicies: { permittedPolicies: "none" },
});

/**
 * CSRF Protection (Double Submit Cookie Pattern)
 * Since we use HttpOnly cookies for JWT, we need a way to prevent CSRF.
 * This middleware checks for a 'x-csrf-token' header against a 'csrfToken' cookie.
 */
export const csrfProtection = (req, res, next) => {
  // Methods that don't need CSRF protection
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    const token = req.cookies?.csrfToken || crypto.randomBytes(32).toString("hex");
    req.csrfToken = token;
    if (!req.cookies?.csrfToken) {
      res.cookie("csrfToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    return next();
  }

  const tokenFromCookie = req.cookies?.csrfToken;
  const tokenFromHeader = req.headers["x-csrf-token"];
  const cookieBuffer = typeof tokenFromCookie === "string" ? Buffer.from(tokenFromCookie) : null;
  const headerBuffer = typeof tokenFromHeader === "string" ? Buffer.from(tokenFromHeader) : null;
  const tokensMatch =
    cookieBuffer &&
    headerBuffer &&
    cookieBuffer.length === headerBuffer.length &&
    crypto.timingSafeEqual(cookieBuffer, headerBuffer);

  if (!tokensMatch) {
    logSecurityEvent("CSRF validation failed", req, { 
      tokenInCookie: !!tokenFromCookie, 
      tokenInHeader: !!tokenFromHeader 
    });
    return res.status(403).json({ error: "Invalid CSRF token", code: "CSRF_TOKEN_INVALID" });
  }

  next();
};

/**
 * Request Fingerprinting & Anti-Bot
 * Advanced prevention with blocking and cooldown
 */


export const botDetection = (req, res, next) => {
  const ip = String(req.ip || req.clientIp || "unknown");
  const now = Date.now();
  requestHistorySweepCounter += 1;
  if (requestHistorySweepCounter % 100 === 0) {
    for (const [trackedIp, history] of requestHistory) {
      if (history.length === 0 || now - history[history.length - 1] >= 10_000) {
        requestHistory.delete(trackedIp);
      }
    }
  }

  // 1. Check if IP is blocked
  if (blockCache.has(ip)) {
    return res.status(429).json({ 
      error: "Too Many Requests", 
      message: "Your IP has been temporarily blocked due to suspicious activity. Please try again later." 
    });
  }
  
  if (!requestHistory.has(ip)) {
    if (requestHistory.size >= MAX_TRACKED_IPS) {
      requestHistory.delete(requestHistory.keys().next().value);
    }
    requestHistory.set(ip, []);
  }

  const history = requestHistory.get(ip);
  history.push(now);

  // Keep only last 10 seconds of history
  const recentRequests = history.filter(time => now - time < 10000);
  requestHistory.set(ip, recentRequests);

  // 2. Risk Scoring & Blocking
  // If more than 30 requests in 10 seconds, block for 30 minutes
  if (recentRequests.length > 30) {
    if (blockCache.keys().length >= MAX_TRACKED_IPS) {
      blockCache.del(blockCache.keys()[0]);
    }
    blockCache.set(ip, true, 1800); // 30 minutes block
    
    logSecurityEvent("Bot blocked: extreme frequency", req, { 
      requestCount: recentRequests.length,
      blockDuration: "30m"
    });

    return res.status(429).json({ 
      error: "Too Many Requests", 
      message: "Suspicious activity detected. You are blocked for 30 minutes." 
    });
  }

  // If more than 15 requests in 10 seconds, log warning
  if (recentRequests.length > 15) {
    logSecurityEvent("Potential bot detected: high frequency", req, { 
      requestCount: recentRequests.length 
    });
  }

  next();
};
