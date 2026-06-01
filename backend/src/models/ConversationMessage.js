import mongoose from "mongoose";

const conversationMessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String },
    images: [{ type: String }],
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],

    // Soft Delete Fields (Admin-level - prevents ALL users from seeing)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

conversationMessageSchema.index({ conversationId: 1, createdAt: 1 });
conversationMessageSchema.index({ senderId: 1 });

export default mongoose.model("ConversationMessage", conversationMessageSchema);
