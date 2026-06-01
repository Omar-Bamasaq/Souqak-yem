import mongoose from "mongoose";

const ActivityLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true }, // e.g., "DELETE_AD", "RESTORE_AD", "MARK_SOLD"
    entityType: { type: String, required: true, index: true }, // e.g., "Ad", "User", "Review"
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    metadata: { type: mongoose.Schema.Types.Mixed }, // Any additional data (old values, etc.)
    ipAddress: { type: String },
    userAgent: { type: String }
  },
  { timestamps: true }
);

ActivityLogSchema.index({ createdAt: -1 });

export default mongoose.models.ActivityLog || mongoose.model("ActivityLog", ActivityLogSchema);
