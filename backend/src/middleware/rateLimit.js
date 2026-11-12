import { rateLimit as expressRateLimit } from "express-rate-limit";
import { logSecurityEvent } from "../utils/logger.js";

export default function rateLimit({
  windowMs = 60_000,
  max = 10,
  skip,
  message = "لقد تجاوزت الحد المسموح به للطلبات. يرجى الانتظار قليلاً.",
} = {}) {
  return expressRateLimit({
    windowMs,
    limit: max,
    skip,
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res) {
      logSecurityEvent("Rate limit exceeded", req, { max });
      res.setHeader("Retry-After", String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
}
