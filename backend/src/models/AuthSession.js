import mongoose from "mongoose";

const authSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    authVersion: { type: Number, default: 0 },
    appType: { type: String, enum: ["main", "store-pwa"], required: true },
    storeProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProfile", default: null },
    initialRefreshTokenHash: { type: String, required: true, unique: true },
    currentRefreshTokenHash: { type: String, required: true, index: true },
    usedRefreshTokenHashes: { type: [String], default: [] },
    previousRefreshTokenHash: { type: String, default: null },
    previousTokenValidUntil: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    revokeReason: { type: String, default: null },
    sourceSessionId: { type: String, default: null, index: true },
    sourceAccessTokenHash: { type: String, default: null },
    legacyMigrated: { type: Boolean, default: false },
    legacyAccessSource: { type: Boolean, default: false },
    lastUsedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authSessionSchema.index({ userId: 1, appType: 1, storeProfileId: 1, revokedAt: 1 });
authSessionSchema.index(
  { sourceAccessTokenHash: 1 },
  { unique: true, partialFilterExpression: { legacyAccessSource: true } }
);

export default mongoose.model("AuthSession", authSessionSchema);
