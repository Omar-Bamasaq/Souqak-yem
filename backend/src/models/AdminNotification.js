import mongoose from "mongoose";

const adminNotificationSchema = new mongoose.Schema(
  {
    type: { 
      type: String, 
      enum: ["verification", "featured", "commission", "order_payment", "dispute", "withdrawal"], 
      required: true 
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    data: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

export default mongoose.model("AdminNotification", adminNotificationSchema);
