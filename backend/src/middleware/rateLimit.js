import { logSecurityEvent } from "../utils/logger.js";

const buckets = new Map();

/**
 * Simple Rate Limiter (no IP banning)
 */
export default function rateLimit({ 
  windowMs = 60_000, 
  max = 10, 
  skip, 
  message = "لقد تجاوزت الحد المسموح به للطلبات. يرجى الانتظار قليلاً.",
  keyPrefix = "" 
} = {}) {
  return (req, res, next) => {
    // Disable rate limiting entirely for development
    return next();
    try {
      const ip = req.clientIp || req.ip;
      const path = req.path || req.originalUrl || "";
      console.log(`[Rate Limit] Checking ${req.method} ${path} from ${ip}`);
      
      if (typeof skip === "function" && skip(req)) {
        console.log(`[Rate Limit] Skipping ${path}`);
        return next();
      }

      const user = (req.user && req.user.id) || "anon";
      const key = `${keyPrefix}:${ip}:${user}`;
      
      const now = Date.now();
      const bucket = buckets.get(key) || { ts: now, count: 0 };

      // Reset bucket if window passed
      if (now - bucket.ts > windowMs) {
        bucket.ts = now;
        bucket.count = 0;
      }

      bucket.count += 1;
      buckets.set(key, bucket);

      if (bucket.count > max) {
        logSecurityEvent("Rate limit exceeded", req, { 
          count: bucket.count, 
          max 
        });

        return res.status(429).json({ error: message, retryAfter: windowMs / 1000 });
      }

      next();
    } catch (err) {
      console.error("Rate limit error:", err);
      next();
    }
  };
}