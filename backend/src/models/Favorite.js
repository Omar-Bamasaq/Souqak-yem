import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    adId: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", required: true, index: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

favoriteSchema.index({ userId: 1, adId: 1 }, { unique: true });

export default mongoose.model("Favorite", favoriteSchema);
