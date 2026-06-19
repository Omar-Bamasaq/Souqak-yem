import mongoose from "mongoose";

const BADGE_TYPES = [
  "BEGINNER",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "DIAMOND",
  "FIRST_BROKERAGE",
  "TOP_BROKER",
  "COMMUNITY_FAVORITE"
];

const BrokerageBadgeSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      index: true 
    },
    type: { 
      type: String, 
      enum: BADGE_TYPES, 
      required: true 
    },
    unlockedAt: { type: Date, default: Date.now },
    achievementIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "BrokerageAchievement" }
    ]
  },
  { timestamps: true }
);

BrokerageBadgeSchema.index({ userId: 1, type: 1 }, { unique: true });

export default mongoose.models.BrokerageBadge || mongoose.model("BrokerageBadge", BrokerageBadgeSchema);
