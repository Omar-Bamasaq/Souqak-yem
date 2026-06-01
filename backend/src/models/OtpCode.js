import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    name: { type: String }, // For registration data
    email: { type: String, required: true, index: true },
    password: { type: String }, // For registration data (hashed)
    code: { type: String, required: true },
    codeExpiresAt: { type: Date, required: true }, // Verification window (60s)
    expiresAt: { type: Date, required: true }, // Record TTL (15m)
    attempts: { type: Number, default: 0 },
    lockedUntil: { type: Date }
  },
  { timestamps: true }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("OtpCode", otpSchema);
