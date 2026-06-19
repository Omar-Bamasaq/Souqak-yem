import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    type: { type: String, enum: ["DIRECT", "DISPUTE"], default: "DIRECT" },
    title: { type: String },
    disputeId: { type: mongoose.Schema.Types.ObjectId, ref: "Dispute", index: true },
    adId: { type: mongoose.Schema.Types.ObjectId, required: false, ref: "Ad", index: true },
    lastMessage: { type: String },
    mutedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    pinnedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],
    isClosed: { type: Boolean, default: false },
    closedAt: { type: Date },

    isDeletedByAdmin: { type: Boolean, default: false, index: true },
    deletedByAdminAt: { type: Date, default: null },
    deletedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isPermanentlyDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

conversationSchema.index({ adId: 1, participants: 1 });
conversationSchema.index({ createdAt: 1 });
conversationSchema.index({ deletedByAdminAt: 1 });

export default mongoose.model("Conversation", conversationSchema);
