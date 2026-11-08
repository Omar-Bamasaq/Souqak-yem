import mongoose from "mongoose";

const ALLOWED_DATA_KEYS = {
  store_creation: [
    "storeName", "activityKey", "description", "governorateId", "cityId",
    "customCityName", "location", "phone", "phones", "whatsapp", "email",
    "selectedCategories"
  ],
  family_production_registration: [
    "storeName", "activityKey", "description", "governorateId", "cityId",
    "customCityName", "location", "phone", "phones", "whatsapp", "email",
    "selectedCategories"
  ],
  featured_ad_upgrade: [],
  wallet_service_catalog: [
    "quantity", "whatsappNumber", "packageId", "serviceVersion",
    "formSchemaVersion", "answers"
  ]
};

const draftActionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["store_creation", "family_production_registration", "featured_ad_upgrade", "wallet_service_catalog"],
      required: true
    },
    status: { type: String, enum: ["incomplete", "completed"], default: "incomplete", required: true },
    currentStep: { type: Number, required: true, min: 1, max: 4 },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      validate: {
        validator(value) {
          if (!value || typeof value !== "object" || Array.isArray(value)) return false;
          const actionType = this.type
            || this.getUpdate?.().$set?.type
            || this.getQuery?.().type;
          const allowedKeys = ALLOWED_DATA_KEYS[actionType] || [];
          return Object.keys(value).every((key) => allowedKeys.includes(key));
        },
        message: "Draft data contains fields that are not allowed for this action type."
      }
    },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
    adId: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", default: null },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "WalletService", default: null },
    sectionId: { type: mongoose.Schema.Types.ObjectId, default: null },
    resultId: { type: mongoose.Schema.Types.ObjectId, default: null },
    resultStoreId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProfile", default: null },
    resultType: { type: String, enum: ["store", "purchase_request", "wallet_service_order"], default: null },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true, autoIndex: false }
);

draftActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
draftActionSchema.index(
  { userId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "incomplete",
      type: { $in: ["store_creation", "family_production_registration", "featured_ad_upgrade"] }
    },
    name: "one_incomplete_non_wallet_draft_per_user_type"
  }
);
draftActionSchema.index(
  { userId: 1, type: 1, serviceId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "incomplete",
      type: "wallet_service_catalog",
      serviceId: { $type: "objectId" }
    },
    name: "one_incomplete_wallet_service_draft_per_service"
  }
);
draftActionSchema.index({ userId: 1, status: 1, updatedAt: -1 });

export default mongoose.model("DraftAction", draftActionSchema);
