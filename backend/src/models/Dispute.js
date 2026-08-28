import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const disputeSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true },
    details: { type: String },
    evidence: [{ type: String }], // صور أو مستندات
    status: {
      type: String,
      enum: ["OPEN", "RESOLVED_BUYER", "RESOLVED_SELLER", "CLOSED", "deleted"],
      default: "OPEN",
      index: true
    },
    resolutionNotes: { type: String },
    resolvedAt: { type: Date },

    // Soft Delete Fields (Phase 1)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

disputeSchema.index({ createdAt: 1 });

disputeSchema.index({ status: 1 });
disputeSchema.index({ createdAt: 1 });

disputeSchema.plugin(softDeletePlugin);

export default mongoose.model("Dispute", disputeSchema);
