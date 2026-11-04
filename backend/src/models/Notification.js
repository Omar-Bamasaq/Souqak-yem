import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { 
      type: String, 
      enum: [
        "message", "ad_status", "comment", "follow", "favorite", "system",
        "purchase_approved", "purchase_rejected", 
        "verification_approved", "verification_rejected", "verification_expired", "verification_warning",
        "commission_reminder", 
        "ad_status_followup", "welcome_promotion_expired",
        "resell_request", "resell_status", "resell_sold", 
        "order", "store_order", "wallet", "wallet_service", "store_subscription",
        "store_order_new", "store_order_confirmed", "store_order_status_changed",
        "store_order_ready", "store_order_shipped", "store_order_delivered", "store_order_cancelled",
        "store_message_reply", "store_product_restocked", "store_discount_activated", "store_new_arrival",
        "store_customer_message", "store_inventory_low", "store_store_updated",
        "admin_message",
        "auction",
        // Brokerage types
        "broker_request", "broker_approved", "broker_rejected",
        "deal_pending", "deal_confirmed",
        "complaint_received", "complaint_resolved",
        "achievement_unlocked", "badge_awarded",
        "quote_offer", "quote_status", "booking_status"
      ], 
      required: true 
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed },
    link: { type: String, default: "" },
    storeProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProfile", default: null },
    eventKey: { type: String, default: null },
    relatedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

notificationSchema.index(
  { type: 1, relatedOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "store_order" },
    name: "store_order_per_order_unique"
  }
);
notificationSchema.index(
  { eventKey: 1 },
  {
    unique: true,
    partialFilterExpression: { eventKey: { $type: "string" } },
    name: "store_notification_event_unique"
  }
);
notificationSchema.index(
  { type: 1, relatedOrderId: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "store_order_new" },
    name: "store_order_new_per_order_unique"
  }
);

export default mongoose.model("Notification", notificationSchema);
