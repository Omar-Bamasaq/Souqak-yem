import { ipKeyGenerator } from "express-rate-limit";

export function getVisitorRateLimitKey(req) {
  const trustedUserId = req.user?.id || null;
  if (trustedUserId) return `uid:${trustedUserId}`;

  const clientIp = req.clientIp || req.ip;
  const ipKey = clientIp ? ipKeyGenerator(clientIp) : "unknown";
  return `ip:${ipKey}`;
}
