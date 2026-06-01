export function requireRole(roles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (req.user.role === "admin") {
      return next();
    }
    const onlyGeneral = Array.isArray(roles) && roles.length > 0 && roles.every((r) => ["seller", "buyer", "user"].includes(r));
    if (onlyGeneral) {
      return next();
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
