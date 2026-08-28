import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const BROKER_LEVELS = ["BEGINNER", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];
const BROKER_STATES = ["INACTIVE", "ACTIVE", "SUSPENDED", "BANNED"];

const BrokerProfileSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true, 
      unique: true 
    },
    
    state: { 
      type: String, 
      enum: BROKER_STATES, 
      default: "INACTIVE" 
    },
    
    level: { 
      type: String, 
      enum: BROKER_LEVELS, 
      default: "BEGINNER" 
    },
    
    // PRIVATE: System-only reputation score (0-1000), NEVER exposed to users
    reputation: { 
      type: Number, 
      min: 0, 
      max: 1000, 
      default: 0 
    },
    
    agreedToTermsAt: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },

    // Public stats for display
    successfulDealCount: { type: Number, default: 0 },
    complaintCount: { type: Number, default: 0 },
    complaintAgainstCount: { type: Number, default: 0 },
    complianceRate: { type: Number, default: 100.0 }, // 0-100 %
    
    // Soft Delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

BrokerProfileSchema.index({ state: 1, level: 1 });
BrokerProfileSchema.plugin(softDeletePlugin);

export default mongoose.models.BrokerProfile || mongoose.model("BrokerProfile", BrokerProfileSchema);
