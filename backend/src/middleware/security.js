import helmet from "helmet";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import NodeCache from "node-cache";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const blockCache = new NodeCache({ stdTTL: 3600 }); // Default block 1 hour
const requestHistory = new Map();
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
      imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://souqak-beta.vercel.app"],
      connectSrc: ["'self'", "https://souqak-beta.vercel.app", "http://localhost:5000", "ws://localhost:5000"],
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
    // Generate and set CSRF token for the session if it doesn't exist
    if (!req.cookies.csrfToken) {
      const token = crypto.randomBytes(32).toString("hex");
      res.cookie("csrfToken", token, {
        httpOnly: false, // Must be accessible by frontend JS to send back in header
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
    }
    return next();
  }

  const tokenFromCookie = req.cookies.csrfToken;
  const tokenFromHeader = req.headers["x-csrf-token"];

  if (!tokenFromCookie || !tokenFromHeader || tokenFromCookie !== tokenFromHeader) {
    logSecurityEvent("CSRF validation failed", req, { 
      tokenInCookie: !!tokenFromCookie, 
      tokenInHeader: !!tokenFromHeader 
    });
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  next();
};

/**
 * Request Fingerprinting & Anti-Bot
 * Advanced prevention with blocking and cooldown
 */


export const botDetection = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();

  // 1. Check if IP is blocked
  if (blockCache.has(ip)) {
    return res.status(429).json({ 
      error: "Too Many Requests", 
      message: "Your IP has been temporarily blocked due to suspicious activity. Please try again later." 
    });
  }
  
  if (!requestHistory.has(ip)) {
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
