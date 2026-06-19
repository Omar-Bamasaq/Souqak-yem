import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const MEMBERSHIP_STATES = [
  "REQUEST_SENT",
  "AUTO_ACTIVE",
  "APPROVED",
  "REJECTED",
  "ACTIVE",
  "INACTIVE",
  "WITHDRAWN",
  "BANNED",
  "EXPIRED",
  "ARCHIVED"
];

const BrokerageMembershipSchema = new mongoose.Schema(
  {
    campaignId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "BrokerageCampaign", 
      required: true, 
      index: true 
    },
    brokerProfileId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "BrokerProfile", 
      required: true, 
      index: true 
    },
    
    state: { 
      type: String, 
      enum: MEMBERSHIP_STATES, 
      required: true 
    },

    // Metadata for tracking
    referralCode: { 
      type: String, 
      unique: true, 
      sparse: true 
    },
    referralLink: { type: String, default: null },
    qrCodeUrl: { type: String, default: null },
    viewCount: { type: Number, default: 0 },

    rejectedReason: { type: String, default: null },
    withdrawnAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    expiredAt: { type: Date, default: null },

    // Soft Delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

BrokerageMembershipSchema.index({ campaignId: 1, brokerProfileId: 1 }, { unique: true });
BrokerageMembershipSchema.index({ brokerProfileId: 1, state: 1 });
BrokerageMembershipSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
BrokerageMembershipSchema.plugin(softDeletePlugin);

export default mongoose.models.BrokerageMembership || mongoose.model("BrokerageMembership", BrokerageMembershipSchema);
