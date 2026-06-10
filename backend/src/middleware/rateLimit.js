import { logSecurityEvent } from "../utils/logger.js";

const buckets = new Map();
const bannedIps = new Map(); // IP -> Expiry time

/**
 * Advanced Rate Limiter with Progressive Delay and IP Banning
 */
export default function rateLimit({ 
  windowMs = 60_000, 
  max = 10, 
  skip, 
  message = "لقد تجاوزت الحد المسموح به للطلبات. يرجى الانتظار قليلاً.",
  keyPrefix = "" 
} = {}) {
  return (req, res, next) => {
    try {
      const ip = req.clientIp || req.ip;
      
      // 1. Check if IP is banned
      if (bannedIps.has(ip)) {
        const expiry = bannedIps.get(ip);
        if (Date.now() < expiry) {
          return res.status(403).json({ error: "تم حظر هذا العنوان مؤقتاً بسبب نشاط مشبوه." });
        }
        bannedIps.delete(ip);
      }

      if (typeof skip === "function" && skip(req)) return next();

      const user = (req.user && req.user.id) || "anon";
      const key = `${keyPrefix}:${ip}:${user}`;
      
      const now = Date.now();
      const bucket = buckets.get(key) || { ts: now, count: 0, violations: 0 };

      // Reset bucket if window passed
      if (now - bucket.ts > windowMs) {
        bucket.ts = now;
        bucket.count = 0;
      }

      bucket.count += 1;
      buckets.set(key, bucket);

      if (bucket.count > max) {
        bucket.violations += 1;
        
        // Progressive Delay: Exponential backoff for violations
        const delay = Math.min(bucket.violations * 1000, 30000); // Max 30s delay
        
        logSecurityEvent("Rate limit exceeded", req, { 
          count: bucket.count, 
          max, 
          violations: bucket.violations,
          delay 
        });

        // If too many violations, ban IP for 1 hour
        if (bucket.violations > 20) {
          const banDuration = 60 * 60 * 1000;
          bannedIps.set(ip, Date.now() + banDuration);
          logSecurityEvent("IP Banned due to repeated rate limit violations", req, { banDuration });
        }

        setTimeout(() => {
          if (!res.headersSent) {
            return res.status(429).json({ error: message, retryAfter: windowMs / 1000 });
          }
        }, delay);
        
        return;
      }

      next();
    } catch (err) {
      console.error("Rate limit error:", err);
      next();
    }
  };
}
