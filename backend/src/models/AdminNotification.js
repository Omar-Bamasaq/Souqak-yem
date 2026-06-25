import mongoose from "mongoose";

const adminNotificationSchema = new mongoose.Schema(
  {
    type: { 
      type: String, 
      enum: [
        // Existing
        "verification", "featured", "commission", "order_payment", "dispute", "withdrawal",
        // General
        "new_ad", "ad_pending", "ad_approved", "ad_rejected",
        "new_user", "user_verified", "user_banned",
        "new_order", "order_updated",
        "new_support_ticket", "support_reply",
        "new_platform_review", "admin_reply_to_review",
        "new_ad_report", "report_handled"
      ], 
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
