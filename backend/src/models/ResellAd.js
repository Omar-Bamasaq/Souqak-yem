import mongoose from "mongoose";

const ResellAdSchema = new mongoose.Schema(
  {
    originalAdId: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", required: true },
    resellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    marketingType: { type: String, enum: ["resell", "affiliate"], default: "resell" },
    newPrice: { type: Number, required: true },
    customDescription: { type: String },
    status: { type: String, enum: ["active", "sold", "cancelled"], default: "active" },
    viewsCount: { type: Number, default: 0 },
    referralClicks: { type: Number, default: 0 },
    referralSales: { type: Number, default: 0 },

    // Soft Delete Fields
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

ResellAdSchema.index({ originalAdId: 1 });
ResellAdSchema.index({ resellerId: 1 });
ResellAdSchema.index({ status: 1 });

export default mongoose.models.ResellAd || mongoose.model("ResellAd", ResellAdSchema);
