import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const ResellAdSchema = new mongoose.Schema(
  {
    originalAdId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Ad", 
      required: true,
      index: true
    },
    resellerId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true,
      index: true
    },
    newPrice: { type: Number, required: true },
    customDescription: { type: String },
    viewsCount: { type: Number, default: 0 },
    status: { 
      type: String, 
      enum: ["pending", "active", "inactive", "disabled", "expired"], 
      default: "active",
      index: true
    },
    
    // Soft Delete Fields
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedByUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

ResellAdSchema.index({ originalAdId: 1, status: 1 });
ResellAdSchema.index({ resellerId: 1, status: 1 });

ResellAdSchema.plugin(softDeletePlugin);

export default mongoose.models.ResellAd || mongoose.model("ResellAd", ResellAdSchema);
