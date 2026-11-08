import mongoose from "mongoose";

const AuctionAuditLogSchema = new mongoose.Schema(
  {
    auctionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true,
      immutable: true
    },
    administratorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      immutable: true
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      immutable: true
    },
    actorRole: {
      type: String,
      enum: ["administrator", "owner"],
      default: "administrator",
      immutable: true
    },
    action: {
      type: String,
      enum: [
        "approved",
        "rejected",
        "cancelled",
        "category_documents_approved",
        "category_documents_rejected",
        "category_documents_reopened"
      ],
      required: true,
      immutable: true
    },
    decisionAt: { type: Date, required: true, immutable: true },
    reason: { type: String, default: null, maxlength: 1_000, immutable: true },
    documentId: { type: mongoose.Schema.Types.ObjectId, default: null, immutable: true },
    previousStatus: { type: String, required: true, immutable: true },
    previousReviewStatus: { type: String, required: true, immutable: true },
    nextStatus: { type: String, required: true, immutable: true },
    nextReviewStatus: { type: String, required: true, immutable: true }
  },
  { versionKey: false, timestamps: false }
);

AuctionAuditLogSchema.index({ auctionId: 1, decisionAt: 1 });

for (const operation of [
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndUpdate",
  "findOneAndDelete"
]) {
  AuctionAuditLogSchema.pre(operation, function rejectAuditMutation() {
    throw new Error("Auction audit log records are immutable.");
  });
}

export const AuctionAuditLog =
  mongoose.models.AuctionAuditLog ||
  mongoose.model("AuctionAuditLog", AuctionAuditLogSchema);
export default AuctionAuditLog;
