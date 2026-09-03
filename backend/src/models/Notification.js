import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { 
      type: String, 
      enum: [
        "message", "ad_status", "comment", "follow", "favorite",
        "purchase_approved", "purchase_rejected", 
        "verification_approved", "verification_rejected", 
        "commission_reminder", 
        "resell_request", "resell_status", "resell_sold", 
        "order", "wallet",
        "admin_message",
        // Brokerage types
        "broker_request", "broker_approved", "broker_rejected",
        "deal_pending", "deal_confirmed",
        "complaint_received", "complaint_resolved",
        "achievement_unlocked", "badge_awarded"
      ], 
      required: true 
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
