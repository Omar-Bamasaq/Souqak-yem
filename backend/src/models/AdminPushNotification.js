import mongoose from "mongoose";

const adminPushNotificationSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetType: {
      type: String,
      enum: ["all", "specific"],
      required: true,
      default: "all"
    },
    recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    title: { type: String, required: true },
    content: { type: String, required: true },
    targetPage: { type: String, required: true, default: "home" },
    targetUrl: { type: String, required: true, default: "/" },
    sentCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

adminPushNotificationSchema.index({ createdAt: -1 });

export default mongoose.model("AdminPushNotification", adminPushNotificationSchema);