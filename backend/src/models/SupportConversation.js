import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const supportConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lastMessage: { type: String },
    lastMessageAt: { type: Date, default: Date.now },
    userUnreadCount: { type: Number, default: 0 },
    adminUnreadCount: { type: Number, default: 0 },
    status: { type: String, enum: ["open", "closed", "deleted"], default: "open", index: true },

    deletedByUser: { type: Boolean, default: false, index: true },
    deletedByUserAt: { type: Date, default: null },
    deletedByAdmin: { type: Boolean, default: false, index: true },
    deletedByAdminAt: { type: Date, default: null },
    deletedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isPermanentlyDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

supportConversationSchema.index({ createdAt: 1 });
supportConversationSchema.index({ deletedByAdminAt: 1 });
supportConversationSchema.index({ deletedByUserAt: 1 });

export default mongoose.model("SupportConversation", supportConversationSchema);
