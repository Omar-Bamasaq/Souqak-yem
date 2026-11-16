import mongoose from "mongoose";
import AuthSession from "./AuthSession.js";
import StorePwaHandoff from "./StorePwaHandoff.js";

async function revokeUserAuthState(userIds, reason) {
  const ids = userIds.filter(Boolean);
  if (!ids.length) return;
  const now = new Date();
  await Promise.all([
    AuthSession.updateMany(
      { userId: { $in: ids }, revokedAt: null },
      { $set: { revokedAt: now, revokeReason: reason } }
    ),
    StorePwaHandoff.updateMany(
      { userId: { $in: ids }, consumedAt: null, revokedAt: null },
      { $set: { revokedAt: now } }
    )
  ]);
}

function getSensitiveUpdateReason(update = {}) {
  const changes = {
    ...update,
    ...(update.$set || {}),
    ...(update.$setOnInsert || {})
  };
  if (Object.prototype.hasOwnProperty.call(changes, "password")) return "password_changed";
  if (changes.isDisabled === true) return "account_disabled";
  if (changes.isDeleted === true) return "account_deleted";
  return null;
}

const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true,
      validate: {
        validator: function(v) {
          // Check if it's not purely numeric
          return !/^\d+$/.test(v);
        },
        message: props => `${props.value} لا يمكن أن يكون أرقاماً فقط!`
      }
    },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    avatar: { type: String, default: null }, // User profile image
    role: { type: String, enum: ["admin", "supervisor", "user", "seller", "buyer"], default: "user" },
    isInitialAdmin: { type: Boolean, default: false, select: false },
    ambassadorCommissionRate: { type: Number, min: 0, default: 10 },
    permissions: {
      type: [{ type: String }],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.every((permission) => /^[a-z]+(?:_[a-z]+)*$/.test(permission)),
        message: "Invalid admin permission"
      }
    },
    managedAccount: {
      status: { type: String, enum: ["managed", "claim_pending", "claimed"], default: null },
      createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      createdAt: { type: Date, default: null },
      claimRequestedAt: { type: Date, default: null },
      claimedAt: { type: Date, default: null },
      initialPassword: { type: String, default: null }
    },
    phone: { type: String },
    phoneVerifiedAt: { type: Date, default: null },
    phoneRegistrationMode: { type: String, enum: ["standard", "legacy_trial", "instant"], default: "standard" },
    idDocument: { type: String, default: null },
    identityStatus: { type: String, enum: ["Pending", "Approved", "Rejected"], default: undefined },
    isIdentityVerified: { type: Boolean, default: false },
    isVerifiedSeller: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    verificationStatus: { 
      type: String, 
      enum: ["unverified", "verified", "expired"], 
      default: "unverified" 
    },
    verificationDate: { type: Date },
    verificationExpiryDate: { type: Date },
    verificationExpiresAt: { type: Date }, // Keep for legacy if needed
    verifiedAt: { type: Date }, // Keep for legacy
    emailOTP: { type: String },
    otpExpiresAt: { type: Date },
    isEmailVerified: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },
    socketId: { type: String },
    mustResetPassword: { type: Boolean, default: false },
    temporaryPassword: { type: String, default: null },
    temporaryPasswordExpiresAt: { type: Date, default: null },
    passwordResetRequestedAt: { type: Date, default: null },
    notificationPrefs: {
      type: {
        message: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
            { _id: false }
          ),
          default: () => ({ inApp: true, push: true, email: true })
        },
        comment: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
            { _id: false }
          ),
          default: () => ({ inApp: true, push: true, email: true })
        },
        favorite: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
            { _id: false }
          ),
          default: () => ({ inApp: true, push: true, email: true })
        },
        ad_status: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
            { _id: false }
          ),
          default: () => ({ inApp: true, push: true, email: true })
        },
        order: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
            { _id: false }
          ),
          default: () => ({ inApp: true, push: true, email: true })
        },
        wallet: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
            { _id: false }
          ),
          default: () => ({ inApp: true, push: true, email: true })
        },
        broker_request: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
            { _id: false }
          ),
          default: () => ({ inApp: true, push: true, email: true })
        },
        broker_approved: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
            { _id: false }
          ),
          default: () => ({ inApp: true, push: true, email: true })
        },
        deal_pending: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
            { _id: false }
          ),
          default: () => ({ inApp: true, push: true, email: true })
        },
        deal_confirmed: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
            { _id: false }
          ),
          default: () => ({ inApp: true, push: true, email: true })
        },
        complaint_resolved: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
            { _id: false }
          ),
          default: () => ({ inApp: true, push: true, email: true })
        },
        admin_message: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: false }, push: { type: Boolean, default: true }, email: { type: Boolean, default: false } },
            { _id: false }
          ),
          default: () => ({ inApp: false, push: true, email: false })
        }
      },
      default: () => ({
        message: { inApp: true, push: true, email: true },
        comment: { inApp: true, push: true, email: true },
        favorite: { inApp: true, push: true, email: true },
        ad_status: { inApp: true, push: true, email: true },
        order: { inApp: true, push: true, email: true },
        wallet: { inApp: true, push: true, email: true },
        broker_request: { inApp: true, push: true, email: true },
        broker_approved: { inApp: true, push: true, email: true },
        deal_pending: { inApp: true, push: true, email: true },
        deal_confirmed: { inApp: true, push: true, email: true },
        complaint_resolved: { inApp: true, push: true, email: true },
        admin_message: { inApp: false, push: true, email: false }
      })
    },
    isDisabled: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletionRequestedAt: { type: Date },
    devices: {
      android: { type: Number, default: 0 },
      ios: { type: Number, default: 0 },
      windows: { type: Number, default: 0 },
      macos: { type: Number, default: 0 }
    },
    phoneTrial: { type: Boolean, default: false },
    phoneTrialStatus: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
    hasSeenNotificationPrompt: { type: Boolean, default: true },
    
    // Welcome Promotion
    hasUsedWelcomePromotion: { type: Boolean, default: false },
    welcomePromotionUsedAt: { type: Date, default: null },

    refreshToken: { type: String }, // Legacy refresh token retained for transition compatibility
    legacyRefreshTokenDisabledAt: { type: Date, default: null },
    legacyAccessTokensRevokedAt: { type: Date, default: null },
    authVersion: { type: Number, default: 0 },

    // Security & Account Lockout
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    lastLoginAt: { type: Date },
    lastLoginIp: { type: String },
    deviceFingerprint: { type: String },

    // Seller specific fields (Cumulative)
    sellerRating: { type: Number, default: 0 },
    sellerReviewsCount: { type: Number, default: 0 },
    
    // Web Push Subscriptions
    pushSubscriptions: [
      {
        endpoint: { type: String, required: true },
        keys: {
          p256dh: { type: String, required: true },
          auth: { type: String, required: true }
        },
        deviceType: { type: String }, // 'mobile', 'desktop'
        userAgent: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (this.isNew) return;
  let reason = null;
  if (this.isModified("password")) reason = "password_changed";
  else if (this.isModified("isDisabled") && this.isDisabled) reason = "account_disabled";
  else if (this.isModified("isDeleted") && this.isDeleted) reason = "account_deleted";
  if (reason) {
    if (!this.legacyRefreshTokenDisabledAt) this.legacyRefreshTokenDisabledAt = new Date();
    this.legacyAccessTokensRevokedAt = new Date();
    this.set("refreshToken", undefined);
    this.$inc("authVersion", 1);
    this.$locals.authStateRevocationReason = reason;
  }
});

for (const operation of ["findOneAndUpdate", "updateOne", "updateMany"]) {
  userSchema.pre(operation, async function () {
    const reason = getSensitiveUpdateReason(this.getUpdate());
    if (!reason) return;
    const update = this.getUpdate() || {};
    const now = new Date();
    const set = {
      ...(update.$set || {}),
      legacyRefreshTokenDisabledAt: now,
      legacyAccessTokensRevokedAt: now
    };
    const unset = { ...(update.$unset || {}), refreshToken: 1 };
    delete set.refreshToken;
    const increment = { ...(update.$inc || {}), authVersion: 1 };
    for (const [key, value] of Object.entries(update)) {
      if (!key.startsWith("$")) {
        set[key] = value;
        delete update[key];
      }
    }
    delete set.refreshToken;
    update.$set = set;
    update.$unset = unset;
    update.$inc = increment;
    this.setUpdate(update);
    const users = await this.model.find(this.getFilter()).select("_id").lean();
    this._authStateRevocation = { userIds: users.map((user) => user._id), reason };
  });

  userSchema.post(operation, async function (result) {
    const state = this._authStateRevocation;
    delete this._authStateRevocation;
    if (!state || !state.userIds.length) return;
    const didUpdate = operation === "findOneAndUpdate"
      ? Boolean(result)
      : Number(result?.matchedCount ?? result?.n ?? 0) > 0;
    if (didUpdate) await revokeUserAuthState(state.userIds, state.reason);
  });
}

userSchema.post("save", async function () {
  const reason = this.$locals.authStateRevocationReason;
  delete this.$locals.authStateRevocationReason;
  if (reason) await revokeUserAuthState([this._id], reason);
});

userSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
userSchema.index(
  { isInitialAdmin: 1 },
  { unique: true, partialFilterExpression: { isInitialAdmin: true } }
);
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string", $gt: "" } } }
);
userSchema.index({ role: 1, createdAt: -1 });

export default mongoose.model("User", userSchema);
