import mongoose from "mongoose";

const FollowSchema = new mongoose.Schema(
  {
    followerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

FollowSchema.index({ followerId: 1, sellerId: 1 }, { unique: true });

export default mongoose.model("Follow", FollowSchema);
