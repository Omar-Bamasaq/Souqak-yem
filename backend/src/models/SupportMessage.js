import mongoose from "mongoose";

const supportMessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "SupportConversation", required: true, index: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["user", "admin"], required: true },
    text: { type: String },
    images: [{ type: String }],
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" }
  },
  { timestamps: true }
);

export default mongoose.model("SupportMessage", supportMessageSchema);
