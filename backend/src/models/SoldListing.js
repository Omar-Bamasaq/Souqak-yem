import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const SoldListingSchema = new mongoose.Schema(
  {
    adId: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    
    // Ad Snapshot (Data at time of sale)
    title: { type: String, required: true },
    price: { type: Number, required: true },
    currency: { type: String, required: true },
    categoryName: { type: String },
    images: [{ type: String }],
    
    // Commission Details
    commissionId: { type: mongoose.Schema.Types.ObjectId, ref: "Commission" },
    commissionAmount: { type: Number, required: true },
    commissionStatus: { 
      type: String, 
      enum: ["unpaid", "paid", "overdue", "Pending", "Rejected"], 
      default: "unpaid" 
    },
    
    // Sale Details
    soldAt: { type: Date, default: Date.now },
    buyerType: { type: String, enum: ["DIRECT", "SECURE"], default: "DIRECT" },
    
    // Admin Tracking
    adminNotes: { type: String },
    lastReminderSentAt: { type: Date },
    reminderCount: { type: Number, default: 0 },
    
    // Deletion Status (Reflecting original ad)
    isOriginalAdDeleted: { type: Boolean, default: false },

    // Soft Delete Fields (Phase 1)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null },
    status: { 
      type: String, 
      enum: ["active", "deleted", "archived"], 
      default: "active",
      index: true
    }
  },
  { timestamps: true }
);

SoldListingSchema.index({ adId: 1 });
SoldListingSchema.index({ sellerId: 1 });
SoldListingSchema.index({ commissionStatus: 1 });
SoldListingSchema.index({ soldAt: -1 });
SoldListingSchema.index({ createdAt: 1 });

SoldListingSchema.plugin(softDeletePlugin);

export default mongoose.models.SoldListing || mongoose.model("SoldListing", SoldListingSchema);
