import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const CAMPAIGN_TYPES = ["AUTO_JOIN", "MANUAL_APPROVAL", "SINGLE_BROKER", "LIMITED"];
const REWARD_TYPES = ["FIXED", "PERCENTAGE"];
const CAMPAIGN_STATES = ["DRAFT", "ACTIVE", "SUSPENDED", "DEAL_CONFIRMED", "EXPIRED", "ARCHIVED"];

const BrokerageCampaignSchema = new mongoose.Schema(
  {
    adId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Ad", 
      required: true, 
      unique: true, 
      index: true 
    },
    sellerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      index: true 
    },
    
    type: { 
      type: String, 
      enum: CAMPAIGN_TYPES, 
      default: "AUTO_JOIN" 
    },
    maxBrokerCount: { 
      type: Number, 
      min: 1, 
      default: null 
    },

    rewardType: { 
      type: String, 
      enum: REWARD_TYPES, 
      required: true 
    },
    rewardValue: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    rewardCurrency: { 
      type: String, 
      default: "YER_ADEN" 
    },

    state: { 
      type: String, 
      enum: CAMPAIGN_STATES, 
      default: "ACTIVE" 
    },
    expiresAt: { type: Date, default: null },

    // Soft Delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

BrokerageCampaignSchema.index({ sellerId: 1, state: 1 });
BrokerageCampaignSchema.index({ adId: 1, state: 1 });
BrokerageCampaignSchema.plugin(softDeletePlugin);

export default mongoose.models.BrokerageCampaign || mongoose.model("BrokerageCampaign", BrokerageCampaignSchema);
