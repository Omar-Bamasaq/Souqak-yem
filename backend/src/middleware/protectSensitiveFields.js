/**
 * Middleware to protect sensitive fields from being updated by non-admin users.
 */
export const protectSensitiveFields = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    return next();
  }

  const sensitiveFields = [
    "isDeleted",
    "deletedAt",
    "deletedBy",
    "deletedByUser",
    "deleteReason",
    "commissionStatus",
    "paymentStatus",
    "status",
    "isVerified",
    "featured",
    "featuredUntil",
    "balance"
  ];

  if (req.body) {
    sensitiveFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        delete req.body[field];
      }
    });
  }

  next();
};
