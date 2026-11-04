import mongoose from "mongoose";

const storeNotificationSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    storeProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProfile", required: true, index: true },
    endpoint: { type: String, maxlength: 2048 },
    keys: {
      p256dh: { type: String },
      auth: { type: String }
    },
    enabled: { type: Boolean, default: true },
    orderNotifications: { type: Boolean, default: true },
    messageNotifications: { type: Boolean, default: true },
    marketingNotifications: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

storeNotificationSubscriptionSchema.index(
  { userId: 1, storeProfileId: 1, endpoint: 1 },
  { unique: true, name: "store_notification_user_store_endpoint_unique" }
);
storeNotificationSubscriptionSchema.index(
  { userId: 1, storeProfileId: 1 },
  {
    unique: true,
    partialFilterExpression: { endpoint: { $exists: false } },
    name: "store_notification_user_store_internal_unique"
  }
);
storeNotificationSubscriptionSchema.index({ storeProfileId: 1, enabled: 1 });

export default mongoose.models.StoreNotificationSubscription
  || mongoose.model("StoreNotificationSubscription", storeNotificationSubscriptionSchema);
