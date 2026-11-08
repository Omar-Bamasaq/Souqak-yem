import mongoose from "mongoose";

export const STORE_PLAN_FEATURE_DEFAULTS = {
  dynamicAttributes: false,
  cart: false,
  orders: false,
  whatsappOrdering: false,
  delivery: false,
  discounts: false,
  inventory: false,
  customization: false,
  advancedCustomization: false,
  pwa: false,
  analytics: false,
  notifications: false,
  multipleContacts: false
};

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, trim: true, maxlength: 1000, default: "" },
    type: { type: String, enum: ["verification", "featured", "store", "family-production"], required: true },
    adServiceType: { type: String, enum: ["featured", "placement", "interstitial"], default: "featured" },
    adPositions: {
      type: [{ type: String, enum: ["home", "between_ads", "category"] }],
      default: []
    },
    rotationIntervalSeconds: { type: Number, min: 1, max: 60, default: 5 },
    interstitialDelaySeconds: { type: Number, min: 0, max: 120, default: 8 },
    frequencyCapHours: { type: Number, min: 1, max: 720, default: 24 },
    socialPromotionIncluded: { type: Boolean, default: false },
    socialPromotionPrice: { type: Number, min: 0, default: 0 },
    durationInDays: { type: Number, required: true },
    price: { type: Number, default: 0 },
    currency: { type: String, enum: ["YER_ADEN", "YER_SANAA", "SAR", "USD"], default: "YER_ADEN" },
    isActive: { type: Boolean, default: true },
    features: { type: mongoose.Schema.Types.Mixed, default: [] },
    legacyFeatures: { type: [String], default: [] },
    designStyle: {
      type: String,
      enum: ["free", "normal", "business", "professional"],
      default: "normal"
    },
    cardTagline: { type: String, trim: true, maxlength: 240, default: "" },
    cardHighlights: { type: [String], default: [] },
    isMostPopular: { type: Boolean, default: false },
    limits: {
      maxCategories: { type: Number, default: 0 },
      maxProducts: { type: Number, default: 0 }
    },
    
    // Offers & Discounts
    discountType: { 
      type: String, 
      enum: ['percentage', 'fixed'], 
      default: 'percentage' 
    },
    discountValue: { 
      type: Number, 
      default: 0 
    },
    isSaleActive: { 
      type: Boolean, 
      default: false 
    },
    saleStartDate: { 
      type: Date, 
      default: null 
    },
    saleEndDate: { 
      type: Date, 
      default: null 
    },
    saleLabel: { 
      type: String, 
      default: '' 
    },
    saleType: { 
      type: String, 
      enum: [ 
        'flash_sale', 
        'eid_offer', 
        'ramadan_offer', 
        'special_offer', 
        'opening_offer' 
      ], 
      default: 'special_offer' 
    },
    applyToAllPlans: { 
      type: Boolean, 
      default: false 
    },
    remainingSlots: { 
      type: Number, 
      default: 0 
    },
    isPopularOffer: { 
      type: Boolean, 
      default: false 
    }
  },
  { timestamps: true }
);

planSchema.index({ type: 1 }, {
  unique: true,
  partialFilterExpression: { isMostPopular: true }
});

export default mongoose.model("Plan", planSchema);
