import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const DEAL_STATES = [
  "PENDING_BROKER_CONFIRM",
  "PENDING_BUYER_CONFIRM",
  "CONFIRMED",
  "REJECTED",
  "UNDER_DISPUTE",
  "ARCHIVED"
];

const BrokerageDealSchema = new mongoose.Schema(
  {
    adId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Ad", 
      required: true, 
      unique: true 
    },
    sellerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      index: true 
    },
    brokerProfileId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "BrokerProfile", 
      required: true, 
      index: true 
    },
    buyerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      index: true 
    },
    membershipId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "BrokerageMembership", 
      required: true 
    },

    state: { 
      type: String, 
      enum: DEAL_STATES, 
      required: true, 
      index: true 
    },

    // Reward details copied from campaign at time of deal creation (immutable)
    rewardType: { type: String, enum: ["FIXED", "PERCENTAGE"], required: true },
    rewardValue: { type: Number, required: true },
    rewardCurrency: { type: String, default: "YER_ADEN" },
    
    finalAdPrice: { type: Number, required: true },
    finalAdCurrency: { type: String, default: "YER_ADEN" },

    // Evidence used
    primaryEvidenceId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "BrokerageEvidence", 
      default: null 
    },

    sellerConfirmedAt: { type: Date, default: null },
    brokerConfirmedAt: { type: Date, default: null },
    buyerConfirmedAt: { type: Date, default: null },

    // Soft Delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

BrokerageDealSchema.index({ sellerId: 1, state: 1 });
BrokerageDealSchema.index({ brokerProfileId: 1, state: 1 });
BrokerageDealSchema.index({ buyerId: 1, state: 1 });
BrokerageDealSchema.plugin(softDeletePlugin);

export default mongoose.models.BrokerageDeal || mongoose.model("BrokerageDeal", BrokerageDealSchema);
