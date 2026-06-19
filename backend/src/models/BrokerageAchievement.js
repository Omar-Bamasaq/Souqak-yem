import mongoose from "mongoose";

const ACHIEVEMENT_TYPES = [
  "FIRST_DEAL",
  "DEALS_5",
  "DEALS_10",
  "DEALS_25",
  "DEALS_50",
  "DEALS_100",
  "PERFECT_COMPLIANCE_30",
  "ZERO_COMPLAINTS_90"
];

const BrokerageAchievementSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      index: true 
    },
    type: { 
      type: String, 
      enum: ACHIEVEMENT_TYPES, 
      required: true 
    },
    unlockedAt: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

BrokerageAchievementSchema.index({ userId: 1, type: 1 }, { unique: true });

export default mongoose.models.BrokerageAchievement || mongoose.model("BrokerageAchievement", BrokerageAchievementSchema);
