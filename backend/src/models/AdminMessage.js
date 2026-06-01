import mongoose from "mongoose";

const adminMessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { 
      type: String, 
      enum: ["all", "specific"], 
      required: true,
      default: "all"
    },
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Used if targetType is "specific"
    title: { type: String, required: true },
    content: { type: String, required: true },
    isPinned: { type: Boolean, default: true },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Track who read the broadcast
  },
  { timestamps: true }
);

// Index for performance
adminMessageSchema.index({ targetType: 1, createdAt: -1 });
adminMessageSchema.index({ recipients: 1 });

export default mongoose.model("AdminMessage", adminMessageSchema);
