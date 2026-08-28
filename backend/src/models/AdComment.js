import mongoose from "mongoose";

const AdCommentSchema = new mongoose.Schema(
  {
    adId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Ad", index: true },
    adModel: { type: String, enum: ["Ad"], default: "Ad", index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

AdCommentSchema.index({ adId: 1, adModel: 1, createdAt: -1 });

export default mongoose.model("AdComment", AdCommentSchema);
