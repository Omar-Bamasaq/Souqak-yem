import mongoose from "mongoose";

const storeCartSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    storeProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProfile", required: true },
    items: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", required: true },
      quantity: { type: Number, required: true, min: 1 }
    }]
  },
  { timestamps: true }
);

storeCartSchema.index({ buyer: 1 }, { unique: true });

export default mongoose.models.StoreCart || mongoose.model("StoreCart", storeCartSchema);
