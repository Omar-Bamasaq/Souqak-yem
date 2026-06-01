import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const AdReportSchema = new mongoose.Schema(
  {
    adId: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", required: true, index: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    category: { type: String, required: true },
    reason: { type: String, required: true },
    details: { type: String },
    status: { type: String, enum: ["open", "reviewed", "dismissed", "deleted"], default: "open", index: true },

    // Soft Delete Fields (Phase 1)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

AdReportSchema.index({ status: 1, createdAt: -1 });
AdReportSchema.index({ createdAt: 1 });

AdReportSchema.plugin(softDeletePlugin);

export default mongoose.models.AdReport || mongoose.model("AdReport", AdReportSchema);
