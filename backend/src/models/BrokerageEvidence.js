import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const EVIDENCE_TYPES = [
  "INTERNAL_QR_SCAN",
  "INTERNAL_REFERRAL_LINK",
  "REFERRAL_CODE_ENTERED",
  "INTERNAL_PLATFORM_MESSAGE",
  "MANUAL_INTERNAL_SCREENSHOT",
  "MANUAL_EXTERNAL_SCREENSHOT",
  "MANUAL_TEXT_ONLY"
];

const EVIDENCE_STATES = ["CREATED", "VERIFIED", "REJECTED", "USED_IN_DEAL", "ARCHIVED"];

const BrokerageEvidenceSchema = new mongoose.Schema(
  {
    membershipId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "BrokerageMembership", 
      required: true, 
      index: true 
    },
    adId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Ad", 
      required: true, 
      index: true 
    },
    buyerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      index: true 
    },

    type: { 
      type: String, 
      enum: EVIDENCE_TYPES, 
      required: true 
    },
    rank: { type: Number, required: true, min: 10, max: 100 },
    
    data: { type: mongoose.Schema.Types.Mixed, default: null },
    screenshotUrl: { type: String, default: null },
    notes: { type: String, default: null },
    
    state: { 
      type: String, 
      enum: EVIDENCE_STATES, 
      default: "CREATED" 
    },

    rejectedReason: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    usedAt: { type: Date, default: null },

    // Soft Delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

BrokerageEvidenceSchema.index({ membershipId: 1, state: 1 });
BrokerageEvidenceSchema.index({ buyerId: 1, adId: 1 });
BrokerageEvidenceSchema.plugin(softDeletePlugin);

export default mongoose.models.BrokerageEvidence || mongoose.model("BrokerageEvidence", BrokerageEvidenceSchema);
