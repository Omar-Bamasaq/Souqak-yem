import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const COMPLAINT_PARTIES = ["SELLER", "BROKER", "BUYER"];
const COMPLAINT_STATES = ["CREATED", "PENDING_MODERATION", "RESOLVED_IN_FAVOR", "RESOLVED_AGAINST", "REJECTED", "ARCHIVED"];

const BrokerageComplaintSchema = new mongoose.Schema(
  {
    dealId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "BrokerageDeal", 
      index: true,
      default: null
    },
    membershipId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "BrokerageMembership", 
      index: true,
      default: null
    },
    campaignId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "BrokerageCampaign", 
      index: true,
      default: null
    },
    
    complainantId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      index: true 
    },
    complainantParty: { 
      type: String, 
      enum: COMPLAINT_PARTIES, 
      required: true 
    },

    againstUserId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      index: true 
    },
    againstParty: { 
      type: String, 
      enum: COMPLAINT_PARTIES, 
      required: true 
    },

    reason: { type: String, required: true, minLength: 10, maxLength: 1000 },
    evidenceUrls: [{ type: String }],
    
    state: { 
      type: String, 
      enum: COMPLAINT_STATES, 
      default: "CREATED" 
    },
    
    moderatorNotes: { type: String, default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      default: null 
    },
    
    // Soft Delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

BrokerageComplaintSchema.index({ complainantId: 1, state: 1 });
BrokerageComplaintSchema.index({ againstUserId: 1, state: 1 });
BrokerageComplaintSchema.plugin(softDeletePlugin);

export default mongoose.models.BrokerageComplaint || mongoose.model("BrokerageComplaint", BrokerageComplaintSchema);
