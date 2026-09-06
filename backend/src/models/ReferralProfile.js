import mongoose from "mongoose";

const referralProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  referralCode: { type: String, required: true, unique: true, index: true },
  status: { type: String, enum: ["ACTIVE", "SUSPENDED", "BANNED"], default: "ACTIVE", index: true },
  totalReferredUsers: { type: Number, default: 0 },
  recoveryBalances: [{
    currency: { type: String, required: true },
    amount: { type: Number, default: 0 }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.models.ReferralProfile || mongoose.model("ReferralProfile", referralProfileSchema);