import mongoose from "mongoose";

const BlockSchema = new mongoose.Schema(
  {
    blockerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    blockedId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

BlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

export default mongoose.model("Block", BlockSchema);
