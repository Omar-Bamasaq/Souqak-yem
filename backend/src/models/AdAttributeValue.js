import mongoose from "mongoose";

const AdAttributeValueSchema = new mongoose.Schema(
  {
    adId: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", required: true },
    attributeId: { type: mongoose.Schema.Types.ObjectId, ref: "Attribute", required: true },
    value: { type: String, required: true }
  },
  { timestamps: true }
);

AdAttributeValueSchema.index({ attributeId: 1, value: 1 });
AdAttributeValueSchema.index({ adId: 1, attributeId: 1 });

export default mongoose.models.AdAttributeValue || mongoose.model("AdAttributeValue", AdAttributeValueSchema);
