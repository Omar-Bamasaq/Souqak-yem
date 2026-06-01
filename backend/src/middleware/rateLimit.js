const buckets = new Map();

function keyFrom(req) {
  const ip = req.ip || req.connection?.remoteAddress || "ip";
  const route = (req.baseUrl || "") + (req.path || req.originalUrl || "");
  const user = (req.user && req.user.id) || "anon";
  return `${ip}:${user}:${route}`;
}

export default function rateLimit({ windowMs = 60_000, max = 10, skip } = {}) {
  return (req, res, next) => {
    try {
      if (typeof skip === "function" && skip(req)) return next();
      const key = keyFrom(req);
      const now = Date.now();
      const bucket = buckets.get(key) || { ts: now, count: 0 };
      if (now - bucket.ts > windowMs) {
        bucket.ts = now;
        bucket.count = 0;
      }
      bucket.count += 1;
      buckets.set(key, bucket);
      if (bucket.count > max) {
        return res.status(429).json({ error: "Too many requests, please try later" });
      }
      next();
    } catch {
      next();
    }
  };
}
