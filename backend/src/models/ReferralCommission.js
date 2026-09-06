import mongoose from "mongoose";

const referralCommissionSchema = new mongoose.Schema({
  referrerUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  referredUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  relationshipId: { type: mongoose.Schema.Types.ObjectId, ref: "ReferralRelationship", required: true, index: true },
  sourceType: { type: String, enum: ["SALE", "SAFE_PURCHASE", "PROMOTION"], required: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  sourceEventId: { type: String, required: true },
  rewardType: { type: String, required: true },
  status: { type: String, enum: ["PENDING", "AVAILABLE", "WITHDRAWAL_RESERVED", "PAID", "REVERSED", "CANCELLED", "FROZEN"], default: "PENDING", index: true },
  platformRevenueAmount: { type: Number, required: true, min: 0 },
  platformRevenueType: { type: String, required: true },
  referralRate: { type: Number, required: true, min: 0, max: 100 },
  commissionAmount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, index: true },
  pendingUntil: { type: Date, required: true, index: true },
  availableAt: { type: Date, default: null },
  reversedAt: { type: Date, default: null },
  reversalReason: { type: String, default: null },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction", default: null },
  withdrawalId: { type: mongoose.Schema.Types.ObjectId, ref: "Withdrawal", default: null },
  originalCommissionId: { type: mongoose.Schema.Types.ObjectId, ref: "ReferralCommission", default: null }
}, { timestamps: true });

referralCommissionSchema.index({ sourceType: 1, sourceId: 1, referrerUserId: 1, rewardType: 1 }, { unique: true });

export default mongoose.models.ReferralCommission || mongoose.model("ReferralCommission", referralCommissionSchema);