import mongoose from "mongoose";

const SystemSettingsSchema = new mongoose.Schema(
  {
    adReviewMode: {
      type: String,
      enum: ["manual", "auto"],
      default: "manual"
    },
    adReviewDelayMinutes: {
      type: Number,
      enum: [0, 5, 10, 15, -1], // -1 for random (5, 10, or 15)
      default: 0
    },
    prohibitedKeywords: {
      type: [String],
      default: [
        "سلاح", "أسلحة", "مخدرات", "حبوب", "ترامادول", "شراب", "خمر", "كحول",
        "قنبلة", "متفجرات", "رصاص", "مسدس", "بندقية", "كلاشنكوف",
        "weapon", "weapons", "drugs", "alcohol", "bomb", "explosives", "bullet", "gun", "pistol", "rifle"
      ]
    },
    withdrawalIdentityThresholdUsd: {
      type: Number,
      default: 250 // الحد الأدنى لطلب الهوية بالدولار
    },
    exchangeRates: {
      USD: { type: Number, default: 1 },
      SAR: { type: Number, default: 3.75 },
      YER: { type: Number, default: 530 }, // سعر تقريبي (صنعاء)
      YER_ADEN: { type: Number, default: 1600 } // سعر تقريبي (عدن)
    },
    welcomePromotion: {
      enabled: { type: Boolean, default: true },
      durationHours: { type: Number, default: 6 },
      maxBeneficiaries: { type: Number, default: 100 },
      usedCount: { type: Number, default: 0 },
      endDate: { type: Date, default: null },
      stats: {
        summaryShownCount: { type: Number, default: 0 },
        promoteClickCount: { type: Number, default: 0 },
        totalConversions: { type: Number, default: 0 },
        purchasedAfterTrialCount: { type: Number, default: 0 }
      }
    },
    brokerageEnabled: {
      type: Boolean,
      default: true
    },
    referralProgram: {
      programEnabled: { type: Boolean, default: true },
      defaultReferralRate: { type: Number, min: 0, max: 100, default: 10 },
      saleReferralRate: { type: Number, min: 0, max: 100, default: 10 },
      safePurchaseReferralRate: { type: Number, min: 0, max: 100, default: 10 },
      promotionReferralRate: { type: Number, min: 0, max: 100, default: 10 },
      minimumWithdrawal: {
        YER: { type: Number, default: 1000 },
        YER_ADEN: { type: Number, default: 1000 },
        YER_SANAA: { type: Number, default: 1000 },
        SAR: { type: Number, default: 2.5 },
        USD: { type: Number, default: 1 }
      },
      pendingPeriod: { type: Number, min: 0, default: 7 },
      maxDailyReferralRewards: { type: Number, min: 0, default: 0 },
      maxDailyWithdrawals: { type: Number, min: 0, default: 0 },
      fraudReviewEnabled: { type: Boolean, default: true }
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

// Ensure only one settings document exists
SystemSettingsSchema.statics.getSettings = async function() {
  return this.findOneAndUpdate(
    {},
    { $setOnInsert: {} },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

export default mongoose.models.SystemSettings || mongoose.model("SystemSettings", SystemSettingsSchema);
