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
        "new_user", "user_verified", "user_banned", "phone_verification_request",
        "new_order", "order_updated", "store_subscription",
        "new_support_ticket", "support_reply",
        "new_platform_review", "admin_reply_to_review",
        "new_ad_report", "report_handled", "booking_submission", "quote_request_report"
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
