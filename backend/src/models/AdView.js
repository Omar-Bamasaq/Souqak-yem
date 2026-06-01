import mongoose from "mongoose";

const AdViewSchema = new mongoose.Schema(
  {
    adId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    ip: { type: String, index: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

AdViewSchema.index({ adId: 1, userId: 1 }, { unique: true, sparse: true });
AdViewSchema.index({ adId: 1, ip: 1 }, { unique: true, sparse: true });

export default mongoose.model("AdView", AdViewSchema);
