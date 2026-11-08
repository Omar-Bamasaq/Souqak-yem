import mongoose from "mongoose";
import {
  WALLET_SERVICE_PRICING_TYPES,
  WALLET_SERVICE_TYPES,
  normalizeFormSchema
} from "../utils/walletServiceDynamicConfig.js";

const serviceSectionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  unitPrice: { type: Number, required: true, min: 0 }
});

const servicePackageSchema = new mongoose.Schema({
  id: { type: String, required: true, trim: true, maxlength: 50 },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: "", maxlength: 500 },
  price: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: ["USD", "SAR", "YER_ADEN", "YER_SANAA"], required: true },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { _id: false });

const serviceVersionSchema = new mongoose.Schema({
  version: { type: Number, required: true, min: 1 },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { _id: false });

const walletServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 1000 },
    image: { type: String, default: "" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "DigitalServiceCategory", default: null, index: true },
    serviceType: { type: String, enum: WALLET_SERVICE_TYPES, default: "OTHER" },
    pricingType: { type: String, enum: WALLET_SERVICE_PRICING_TYPES, default: null },
    formSchema: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
      validate: {
        validator(value) {
          try {
            normalizeFormSchema(value);
            return true;
          } catch {
            return false;
          }
        },
        message: "مخطط نموذج الخدمة غير صالح."
      }
    },
    formSchemaVersion: { type: Number, default: 1, min: 1 },
    serviceVersion: { type: Number, default: 1, min: 1 },
    orderCreationRevision: { type: Number, default: 0, min: 0 },
    versionHistory: { type: [serviceVersionSchema], default: [] },
    packages: {
      type: [servicePackageSchema],
      default: [],
      validate: {
        validator(value) {
          const ids = new Set();
          return value.every((item) => {
            if (!item.id || ids.has(item.id) || item.currency !== this.currency) return false;
            ids.add(item.id);
            return true;
          });
        },
        message: "معرفات الباقات فريدة ويجب أن تتوافق عملتها مع الخدمة."
      }
    },
    currency: { type: String, enum: ["USD", "SAR", "YER_ADEN", "YER_SANAA"], default: "USD" },
    unitLabel: { type: String, default: "وحدة", trim: true, maxlength: 40 },
    unitPrice: { type: Number, min: 0 },
    minimumQuantityEnabled: { type: Boolean, default: true },
    maximumQuantityEnabled: { type: Boolean, default: true },
    minimumQuantity: { type: Number, default: 1, min: 1 },
    maximumQuantity: { type: Number, default: 50000, min: 1 },
    customerInfoLabel: { type: String, default: "", trim: true, maxlength: 100 },
    sections: { type: [serviceSectionSchema], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    isArchived: { type: Boolean, default: false, index: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true }
);

walletServiceSchema.index({ isActive: 1, sortOrder: 1, createdAt: 1 });
walletServiceSchema.index({ categoryId: 1, isActive: 1, isArchived: 1, sortOrder: 1 });

export default mongoose.model("WalletService", walletServiceSchema);
