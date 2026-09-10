import { hasAdminPermission, permissionForRequest } from "../config/adminPermissions.js";

export function requireRole(roles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (req.user.role === "admin") {
      return next();
    }
    if (roles.includes("admin") && req.user.role === "supervisor") {
      const permission = permissionForRequest(req);
      if (hasAdminPermission(req.user, permission)) return next();
      return res.status(403).json({ error: "لا تملك صلاحية الوصول إلى هذا القسم." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export function requireMainAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "هذه العملية متاحة للأدمن الرئيسي فقط." });
  }
  next();
}
