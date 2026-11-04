import mongoose from "mongoose";

const purchaseRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    draftActionId: { type: mongoose.Schema.Types.ObjectId, ref: "DraftAction", default: null },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Ad" },
    storeProfile: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProfile" },
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending", index: true },
    price: { type: Number },
    originalPrice: { type: Number },
    currency: { type: String },
    duration: { type: Number },
    paymentReceipt: { type: String },
    rejectionReason: { type: String },
    planSnapshot: {
      name: { type: String, default: "" },
      description: { type: String, default: "" },
      type: { type: String, default: "" },
      adServiceType: { type: String, enum: ["featured", "placement", "interstitial"], default: null },
      adPositions: { type: [{ type: String, enum: ["home", "between_ads", "category"] }], default: [] },
      basePrice: { type: Number, default: null },
      price: { type: Number, default: null },
      originalPrice: { type: Number, default: null },
      currency: { type: String, default: "" },
      durationInDays: { type: Number, default: null },
      rotationIntervalSeconds: { type: Number, min: 1, max: 60, default: null },
      interstitialDelaySeconds: { type: Number, default: null },
      frequencyCapHours: { type: Number, default: null },
      socialPromotionIncluded: { type: Boolean, default: false },
      socialPromotionRequested: { type: Boolean, default: false },
      socialPromotionPrice: { type: Number, default: 0 }
    },
    storeName: { type: String },
    businessActivity: { type: String },
    campaign: {
      isActive: { type: Boolean, default: false },
      serviceType: { type: String, enum: ["featured", "placement", "interstitial"], default: null },
      positions: { type: [{ type: String, enum: ["home", "between_ads", "category"] }], default: [] },
      durationInDays: { type: Number, min: 1, default: null },
      rotationIntervalSeconds: { type: Number, min: 1, max: 60, default: null },
      delaySeconds: { type: Number, min: 0, max: 120, default: null },
      frequencyCapHours: { type: Number, min: 1, max: 720, default: null },
      startsAt: { type: Date, default: null },
      endsAt: { type: Date, default: null },
      activatedAt: { type: Date, default: null },
      adminExtensions: {
        type: [{
          days: { type: Number, required: true, min: 1, max: 365 },
          reason: { type: String, required: true, trim: true, maxlength: 1000 },
          extendedAt: { type: Date, required: true },
          extendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
        }],
        default: []
      },
      socialPromotionRequested: { type: Boolean, default: false },
      socialPromotionStatus: {
        type: String,
        enum: ["not_requested", "pending", "in_progress", "completed", "rejected"],
        default: "not_requested"
      }
    },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

purchaseRequestSchema.index(
  { draftActionId: 1 },
  { unique: true, partialFilterExpression: { draftActionId: { $type: "objectId" } } }
);
purchaseRequestSchema.index({ status: 1, "campaign.isActive": 1, "campaign.endsAt": 1 });

export default mongoose.model("PurchaseRequest", purchaseRequestSchema);
