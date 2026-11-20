import { isValidPhoneNumber } from "../utils/securityRules.js";
import SystemSettings from "../models/SystemSettings.js";

export default async function requirePhoneVerification(req, res, next) {
  if (!isValidPhoneNumber(req.user?.phone)) {
    return res.status(403).json({
      error: "يجب توثيق رقم الهاتف قبل تنفيذ هذا الإجراء.",
      code: "PHONE_VERIFICATION_REQUIRED"
    });
  }

  let requireVerification = true;
  try {
    const settings = await SystemSettings.getSettings();
    requireVerification = settings.requirePhoneVerificationForAds !== false;
  } catch (error) {
    console.error("Failed to load ad phone-verification setting; enforcing verification.", error);
  }

  if (requireVerification && !req.user.phoneVerifiedAt) {
    return res.status(403).json({
      error: "يجب توثيق رقم الهاتف قبل تنفيذ هذا الإجراء.",
      code: "PHONE_VERIFICATION_REQUIRED"
    });
  }

  next();
}
