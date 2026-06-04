import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const AdSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    price: { type: Number, required: true },
    currency: { type: String, enum: ["YER_ADEN", "YER_SANAA", "SAR", "USD"], default: "YER_ADEN" },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null, index: true },
    governorateId: { type: mongoose.Schema.Types.ObjectId, ref: "Governorate" },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: "City" },
    location: {
      type: {
        type: String,
        enum: ["Point"]
      },
      coordinates: {
        type: [Number]
      }
    },
    
    // Status & Visibility
    status: { 
      type: String, 
      enum: ["pending", "approved", "rejected", "expired", "sold", "AVAILABLE", "SOLD", "archived", "deleted", "blocked", "reported"], 
      default: "pending",
      index: true
    },
    isVisible: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date },
    scheduledPublishAt: { type: Date, index: true },
    
    // Featured Status
    featured: { type: Boolean, default: false },
    featuredUntil: { type: Date },
    featuredAt: { type: Date },
    featuredExpiresAt: { type: Date },
    
    // Stats
    viewCount: { type: Number, default: 0 },
    contactsCount: { type: Number, default: 0 },
    
    // Sale Info
    sold: { type: Boolean, default: false, index: true },
    soldAt: { type: Date },
    lastSoldReminderAt: { type: Date },
    soldReminderCount: { type: Number, default: 0 },
    lastFollowUpAt: { type: Date },
    followUpStatus: { type: String, enum: ["none", "sent", "responded"], default: "none" },
    
    // Archiving & Expiry
    isArchived: { type: Boolean, default: false, index: true },
    expiresAt: { type: Date },
    expireReminderSent: { type: Boolean, default: false },
    
    // Media & Ownership
    images: [{ type: String }],
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],
    tagNames: [{ type: String }],
    
    // Contact Info
    contactInfo: {
      showPhone: { type: Boolean, default: false },
      phone: { type: String },
      showWhatsApp: { type: Boolean, default: false },
      whatsapp: { type: String }
    },
    
    // Details
    condition: { type: String, enum: ["new", "used", "like_new"], default: "used" },
    negotiable: { type: Boolean, default: false },
    priceOnContact: { type: Boolean, default: false },
    adType: { type: String, enum: ["sell", "order"], default: "sell", index: true },
    
    // Performance Tracking
    whatsappClicks: { type: Number, default: 0 },
    phoneClicks: { type: Number, default: 0 },
    
    // Welcome Promotion Fields
    isWelcomePromoted: { type: Boolean, default: false, index: true },
    welcomePromotionStartDate: { type: Date, default: null },
    welcomePromotionEndDate: { type: Date, default: null },
    freePromotionSummaryShown: { type: Boolean, default: false },
    promotionStats: {
      views: { type: Number, default: 0 },
      profileVisits: { type: Number, default: 0 },
      messages: { type: Number, default: 0 },
      phoneClicks: { type: Number, default: 0 },
      whatsappClicks: { type: Number, default: 0 },
      favorites: { type: Number, default: 0 }
    },

    // Resell (Affiliate Marketing) Fields
    isResellEnabled: { type: Boolean, default: false },
    commissionType: { type: String, enum: ["fixed", "percentage"], default: "percentage" },
    commissionValue: { type: Number, default: 0 },
    maxResellPrice: { type: Number },
    allowAutoApproval: { type: Boolean, default: true },
    maxResellers: { type: Number, default: 5 },

    // Buyer Information
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    buyerType: { type: String, enum: ["DIRECT", "SECURE"], default: null },
    reviewId: { type: mongoose.Schema.Types.ObjectId, ref: "Review", default: null },

    // Soft Delete Fields (Phase 1)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedByUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

AdSchema.index({ title: "text", description: "text", tagNames: "text" }, { default_language: "arabic", weights: { title: 10, tagNames: 5, description: 1 } });
AdSchema.index({ status: 1, governorateId: 1, cityId: 1, isVisible: 1, isArchived: 1, sold: 1, isDeleted: 1 });
AdSchema.index({ userId: 1, createdAt: -1 });
AdSchema.index({ categoryId: 1, status: 1 });
AdSchema.index({ price: 1 });
AdSchema.index({ publishedAt: -1 });
AdSchema.index({ location: "2dsphere" });
AdSchema.index({ status: 1, createdAt: -1 }, { partialFilterExpression: { status: "approved", isArchived: false, sold: false, isDeleted: false } });
AdSchema.index({ tags: 1 });
AdSchema.index({ tagNames: 1 });
AdSchema.index({ sellerId: 1 }); // User mentioned seller index
AdSchema.index({ createdAt: 1 });
AdSchema.index({ soldAt: 1 });
AdSchema.index({ featured: -1, createdAt: -1 });
AdSchema.index({ isResellEnabled: 1 }, { partialFilterExpression: { isResellEnabled: true } });

AdSchema.plugin(softDeletePlugin);

export default mongoose.models.Ad || mongoose.model("Ad", AdSchema);
