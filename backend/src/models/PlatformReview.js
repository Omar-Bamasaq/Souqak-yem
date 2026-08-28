import mongoose from "mongoose";

const PlatformReviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000 },
    category: { 
      type: String, 
      enum: ["GENERAL", "UI_UX", "PERFORMANCE", "FEATURE_REQUEST", "BUG_REPORT", "SUPPORT"],
      default: "GENERAL"
    },
    platform: { type: String, enum: ["web", "mobile", "other"], default: "web" },
    isAnonymous: { type: Boolean, default: false }, // الخصوصية: إخفاء الهوية في العرض العام
    isPublic: { type: Boolean, default: false }, // هل يظهر في حائط الآراء العام
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED", "ARCHIVED"], default: "PENDING", index: true },

    // Admin Reply Fields
    adminReply: { type: String, trim: true, maxlength: 1000, default: null },
    adminReplyAt: { type: Date, default: null },
    adminRepliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

// الفهارس لسرعة البحث
PlatformReviewSchema.index({ userId: 1, createdAt: -1 });
PlatformReviewSchema.index({ createdAt: -1 });
PlatformReviewSchema.index({ rating: 1 });
PlatformReviewSchema.index({ status: 1 });

export default mongoose.models.PlatformReview || mongoose.model("PlatformReview", PlatformReviewSchema);
