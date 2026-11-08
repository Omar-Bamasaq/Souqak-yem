import mongoose from "mongoose";

const storeAnalyticsDailySchema = new mongoose.Schema(
  {
    storeProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProfile", required: true },
    dateKey: { type: String, required: true },
    type: { type: String, enum: ["store_view", "product_view"], required: true },
    adId: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", default: null },
    views: { type: Number, min: 1, default: 0 }
  },
  { timestamps: true }
);

storeAnalyticsDailySchema.index(
  { storeProfileId: 1, dateKey: 1, type: 1, adId: 1 },
  { unique: true }
);
storeAnalyticsDailySchema.index({ createdAt: 1 }, { expireAfterSeconds: 400 * 24 * 60 * 60 });

export default mongoose.models.StoreAnalyticsDaily
  || mongoose.model("StoreAnalyticsDaily", storeAnalyticsDailySchema);
