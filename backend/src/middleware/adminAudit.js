import AdminAuditLog from "../models/AdminAuditLog.js";

function redact(obj) {
  const clone = JSON.parse(JSON.stringify(obj || {}));
  const redactKeys = ["password", "token", "otp", "otpCode"];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    for (const k of Object.keys(o)) {
      if (redactKeys.includes(k.toLowerCase())) {
        o[k] = "***";
      } else {
        walk(o[k]);
      }
    }
  };
  walk(clone);
  return clone;
}

export default function adminAudit() {
  return async (req, res, next) => {
    const start = Date.now();
    res.on("finish", async () => {
      try {
        if (!req.user || req.user.role !== "admin") return;
        if (req.method === "GET") return;
        await AdminAuditLog.create({
          adminId: req.user.id,
          action: `${req.method} ${req.baseUrl}${req.path}`,
          method: req.method,
          route: `${req.baseUrl}${req.path}`,
          params: redact(req.params),
          query: redact(req.query),
          body: redact(req.body),
          ip: req.ip,
          durationMs: Date.now() - start
        });
      } catch {}
    });
    next();
  };
}

