import mongoose from "mongoose";

const storePwaHandoffSchema = new mongoose.Schema(
  {
    grantHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetStoreId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProfile", required: true, index: true },
    sourceSessionId: { type: String, default: null, index: true },
    sourceAccessTokenHash: { type: String, default: null, index: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

storePwaHandoffSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("StorePwaHandoff", storePwaHandoffSchema);
