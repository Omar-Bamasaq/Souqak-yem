import mongoose from "mongoose";

const StoreFollowSchema = new mongoose.Schema(
  {
    followerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    storeProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProfile", required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

StoreFollowSchema.index({ followerId: 1, storeProfileId: 1 }, { unique: true });

export default mongoose.models.StoreFollow || mongoose.model("StoreFollow", StoreFollowSchema);
