import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["verification", "featured"], required: true },
    durationInDays: { type: Number, required: true },
    price: { type: Number, default: 0 },
    currency: { type: String, enum: ["YER_ADEN", "YER_SANAA", "SAR", "USD"], default: "YER_ADEN" },
    isActive: { type: Boolean, default: true },
    
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

export default mongoose.model("Plan", planSchema);
