import { isValidPhoneNumber } from "../utils/securityRules.js";

export default function requirePhoneVerification(req, res, next) {
  if (!isValidPhoneNumber(req.user?.phone) || !req.user.phoneVerifiedAt) {
    return res.status(403).json({
      error: "يجب توثيق رقم الهاتف قبل تنفيذ هذا الإجراء.",
      code: "PHONE_VERIFICATION_REQUIRED"
    });
  }
  next();
}
