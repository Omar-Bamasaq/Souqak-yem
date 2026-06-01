import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const ReviewSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }, // Optional for manual sales
    adId: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    
    // Ratings for specific criteria
    reliability: { type: Number, required: true, min: 1, max: 5 }, // المصداقية (مطابقة الوصف)
    communication: { type: Number, required: true, min: 1, max: 5 }, // التواصل
    deliverySpeed: { type: Number, required: true, min: 1, max: 5 }, // سرعة التسليم/التجاوب
    
    rating: { type: Number, required: true, min: 1, max: 5 }, // Overall average rating
    comment: { type: String, required: true, minlength: 10 },
    images: [{ type: String }],
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED", "deleted"], default: "APPROVED", index: true },
    isVerifiedPurchase: { type: Boolean, default: true },

    // Soft Delete Fields (Phase 1)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

// Indexing for fast retrieval
ReviewSchema.index({ orderId: 1 }, { unique: true, sparse: true });
ReviewSchema.index({ sellerId: 1 });
ReviewSchema.index({ buyerId: 1 });
ReviewSchema.index({ createdAt: 1 });

ReviewSchema.plugin(softDeletePlugin);

export default mongoose.models.Review || mongoose.model("Review", ReviewSchema);
