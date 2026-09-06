export function requireRole(roles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (req.user.role === "admin") {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
