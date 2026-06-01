import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      unique: true,
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
    role: { type: String, enum: ["admin", "user", "seller", "buyer"], default: "user" },
    phone: { type: String },
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
    notificationPrefs: {
      type: {
        message: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: false } },
            { _id: false }
          ),
          default: undefined
        },
        comment: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: false } },
            { _id: false }
          ),
          default: undefined
        },
        ad_status: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: false } },
            { _id: false }
          ),
          default: undefined
        },
        order: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
            { _id: false }
          ),
          default: undefined
        },
        wallet: {
          type: new mongoose.Schema(
            { inApp: { type: Boolean, default: true }, push: { type: Boolean, default: true }, email: { type: Boolean, default: true } },
            { _id: false }
          ),
          default: undefined
        }
      },
      default: {}
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
    hasSeenNotificationPrompt: { type: Boolean, default: false },

    // Seller specific fields (Cumulative)
    sellerRating: { type: Number, default: 0 },
    sellerReviewsCount: { type: Number, default: 0 },

    // Reseller specific fields
    resellerRating: { type: Number, default: 0 },
    resellerSalesCount: { type: Number, default: 0 },
    resellerCancellationsCount: { type: Number, default: 0 }, // Added to track failures
    resellerCompletionRate: { type: Number, default: 0 },
    resellerResponseTime: { type: Number, default: 0 }, // Average response time in minutes
    resellerLevel: { type: String, enum: ["Beginner", "Active", "Pro", "VIP"], default: "Beginner" },
    isTrustedReseller: { type: Boolean, default: false },
    
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

userSchema.index({ email: 1 });
userSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
userSchema.index({ role: 1, createdAt: -1 });

export default mongoose.model("User", userSchema);
