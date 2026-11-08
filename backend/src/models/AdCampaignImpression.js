import mongoose from "mongoose";

const adCampaignImpressionSchema = new mongoose.Schema(
  {
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: "PurchaseRequest", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    nextEligibleAt: { type: Date, required: true }
  },
  { timestamps: true }
);

adCampaignImpressionSchema.index({ campaignId: 1, userId: 1 }, { unique: true });
adCampaignImpressionSchema.index({ nextEligibleAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.AdCampaignImpression
  || mongoose.model("AdCampaignImpression", adCampaignImpressionSchema);
