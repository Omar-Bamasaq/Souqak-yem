export const PASSWORD_RESET_OTP_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_OTP_LOCK_MS = 10 * 60 * 1000;
export const PASSWORD_RESET_OTP_ATTEMPT_WINDOW_MS = 20 * 60 * 1000;

export function isPasswordResetOtpLocked(otp, now = new Date()) {
  return otp.attempts >= PASSWORD_RESET_OTP_MAX_ATTEMPTS ||
    (otp.lockedUntil && otp.lockedUntil > now);
}

export async function hasReachedPasswordResetOtpAttemptLimit(OtpCode, email, now = new Date()) {
  const [summary] = await OtpCode.aggregate([
    {
      $match: {
        email,
        createdAt: { $gte: new Date(now.getTime() - PASSWORD_RESET_OTP_ATTEMPT_WINDOW_MS) }
      }
    },
    { $group: { _id: null, attempts: { $sum: { $ifNull: ["$attempts", 0] } } } }
  ]);
  return (summary?.attempts || 0) >= PASSWORD_RESET_OTP_MAX_ATTEMPTS;
}

export async function recordInvalidPasswordResetOtpAttempt(OtpCode, otpId, now = new Date()) {
  const updatedOtp = await OtpCode.findOneAndUpdate(
    {
      _id: otpId,
      $and: [
        {
          $or: [
            { attempts: { $lt: PASSWORD_RESET_OTP_MAX_ATTEMPTS } },
            { attempts: { $exists: false } }
          ]
        },
        {
          $or: [
            { lockedUntil: { $exists: false } },
            { lockedUntil: null },
            { lockedUntil: { $lte: now } }
          ]
        }
      ]
    },
    { $inc: { attempts: 1 } },
    { new: true }
  );

  if (!updatedOtp) return { locked: true };
  if (updatedOtp.attempts < PASSWORD_RESET_OTP_MAX_ATTEMPTS) return { locked: false };

  await OtpCode.updateOne(
    { _id: otpId, attempts: { $gte: PASSWORD_RESET_OTP_MAX_ATTEMPTS } },
    { $set: { lockedUntil: new Date(now.getTime() + PASSWORD_RESET_OTP_LOCK_MS) } }
  );
  return { locked: true };
}
