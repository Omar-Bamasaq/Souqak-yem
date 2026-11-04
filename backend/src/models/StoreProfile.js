import mongoose from "mongoose";
import { normalizeStoreSlug } from "../utils/storeValidation.js";

const storeBankAccountSchema = new mongoose.Schema({
  bankName: { type: String, required: true, trim: true, maxlength: 120 },
  accountHolderName: { type: String, required: true, trim: true, maxlength: 120 },
  accountNumber: { type: String, required: true, trim: true, maxlength: 80 },
  currency: { type: String, required: true, enum: ["YER", "SAR", "USD"] }
});

const storeProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    draftActionId: { type: mongoose.Schema.Types.ObjectId, ref: "DraftAction", default: null },
    storeName: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, trim: true },
    storeType: { type: String, enum: ["store", "family-production"], default: "store", index: true },
    activityKey: { type: String, trim: true, default: null },
    businessActivity: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    logo: { type: String, default: null },
    cover: { type: String, default: null },
    selectedCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    location: { type: String, default: "" },
    governorateId: { type: mongoose.Schema.Types.ObjectId, ref: "Governorate", default: null },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: "City", default: null },
    customCityName: { type: String, default: "" },
    lat: { type: Number, default: null, min: -90, max: 90 },
    lng: { type: Number, default: null, min: -180, max: 180 },
    phone: { type: String, default: "" },
    phones: [{
      type: { type: String, enum: ["phone", "mobile"], default: "mobile" },
      value: { type: String, default: "" }
    }],
    whatsapp: [{
      type: { type: String, enum: ["whatsapp", "mobile"], default: "whatsapp" },
      value: { type: String, default: "" }
    }],
    email: { type: String, default: "" },
    notificationEmail: { type: String, default: "", select: false },
    social: {
      facebook: { type: String, trim: true, maxlength: 300, default: "" },
      instagram: { type: String, trim: true, maxlength: 300, default: "" },
      tiktok: { type: String, trim: true, maxlength: 300, default: "" },
      youtube: { type: String, trim: true, maxlength: 300, default: "" },
      whatsappChannel: { type: String, trim: true, maxlength: 300, default: "" }
    },
    bankAccounts: { type: [storeBankAccountSchema], default: [], select: false },
    deliveryAvailable: { type: Boolean, default: false },
    primaryColor: { type: String, default: "#0b89ed" },
    advancedCustomization: { type: mongoose.Schema.Types.Mixed, default: undefined },
    legacyListingsCutoffAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["pending", "active", "suspended", "rejected", "inactive"], default: "pending", index: true },
    rejectedReason: { type: String, default: "" },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

storeProfileSchema.index({ userId: 1, status: 1 });
storeProfileSchema.index(
  { userId: 1, storeType: 1 },
  { unique: true, partialFilterExpression: { storeType: { $exists: true } } }
);
storeProfileSchema.index({ slug: 1, status: 1 });
storeProfileSchema.index(
  { draftActionId: 1 },
  { unique: true, partialFilterExpression: { draftActionId: { $type: "objectId" } } }
);

storeProfileSchema.pre("validate", async function (next) {
  if (this.slug || !this.storeName) return next();
  const base = normalizeStoreSlug(this.storeName);
  let candidate = base;
  let counter = 2;
  while (await mongoose.models.StoreProfile?.exists({ slug: candidate, _id: { $ne: this._id } })) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  this.slug = candidate;
  next();
});

export default mongoose.models.StoreProfile || mongoose.model("StoreProfile", storeProfileSchema);
