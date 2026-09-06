import mongoose from "mongoose";

const referralRelationshipSchema = new mongoose.Schema({
  referrerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  referralCode: { type: String, required: true, index: true },
  attributionMethod: { type: String, enum: ["LINK", "ADMIN_OVERRIDE"], default: "LINK" },
  attributedAt: { type: Date, default: Date.now },
  registrationAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["ACTIVE", "SUSPENDED", "REVOKED"], default: "ACTIVE", index: true },
  adminOverride: { type: Boolean, default: false },
  overrideReason: { type: String, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  fraudFlags: { type: [String], default: [] }
}, { timestamps: true });

referralRelationshipSchema.index({ referrerUserId: 1, referredUserId: 1 }, { unique: true });

export default mongoose.models.ReferralRelationship || mongoose.model("ReferralRelationship", referralRelationshipSchema);