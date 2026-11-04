import mongoose from "mongoose";

const storeSubscriptionSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProfile", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true, index: true },
    purchaseRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseRequest", default: null },
    status: { type: String, enum: ["pending", "active", "expired", "rejected", "cancelled"], default: "pending", index: true },
    price: { type: Number, required: true },
    currency: { type: String, required: true },
    duration: { type: Number, required: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    expiryReminderSentAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, default: "" }
  },
  { timestamps: true }
);

storeSubscriptionSchema.index({ userId: 1, status: 1 });
storeSubscriptionSchema.index({ purchaseRequestId: 1 }, { sparse: true });
storeSubscriptionSchema.index(
  { storeId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

storeSubscriptionSchema.statics.getStoreSubscriptionStatus = function (subscription, now = new Date()) {
  if (!subscription) return "inactive";

  const normalized = String(subscription.status || "").trim().toLowerCase();
  const endDate = subscription.endDate ? new Date(subscription.endDate) : null;

  if (endDate && endDate <= now) return "expired";
  if (normalized === "expired") return "expired";
  if (normalized === "rejected") return "rejected";
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "pending") return "pending";
  if (normalized === "active") return "active";

  return "inactive";
};

export default mongoose.models.StoreSubscription || mongoose.model("StoreSubscription", storeSubscriptionSchema);
