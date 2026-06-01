import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const ResellRequestSchema = new mongoose.Schema(
  {
    originalAdId: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", required: true },
    resellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Original seller
    marketingType: { type: String, enum: ["resell", "affiliate"], default: "resell" },
    newPrice: { type: Number, required: true },
    customDescription: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected", "deleted"], default: "pending", index: true },
    rejectionReason: { type: String },

    // Soft Delete Fields (Phase 1)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

ResellRequestSchema.index({ sellerId: 1, status: 1 });
ResellRequestSchema.index({ resellerId: 1 });
ResellRequestSchema.index({ originalAdId: 1, resellerId: 1 }, { unique: true });
ResellRequestSchema.index({ createdAt: 1 });

ResellRequestSchema.plugin(softDeletePlugin);

export default mongoose.models.ResellRequest || mongoose.model("ResellRequest", ResellRequestSchema);
