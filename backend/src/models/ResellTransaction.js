import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const ResellTransactionSchema = new mongoose.Schema(
  {
    originalAdId: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", required: true },
    resellAdId: { type: mongoose.Schema.Types.ObjectId, ref: "ResellAd" },
    resellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Original seller
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" }, // Link to chat
    originalPrice: { type: Number, required: true },
    finalPrice: { type: Number, required: true },
    platformFee: { type: Number, required: true }, // 1% of originalPrice
    resellerProfit: { type: Number, required: true },
    status: { type: String, enum: ["completed", "pending_payment", "pending_seller_confirmation", "pending_reseller_confirmation", "cancelled"], default: "pending_seller_confirmation" },
    confirmedBySeller: { type: Boolean, default: false },
    confirmedByReseller: { type: Boolean, default: false },
    confirmationAttempts: { type: Number, default: 0 },

    // Soft Delete Fields (Phase 1)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

ResellTransactionSchema.index({ resellerId: 1 });
ResellTransactionSchema.index({ sellerId: 1 });
ResellTransactionSchema.index({ originalAdId: 1 });
ResellTransactionSchema.index({ chatId: 1 });
ResellTransactionSchema.index({ createdAt: 1 });

ResellTransactionSchema.plugin(softDeletePlugin);

export default mongoose.models.ResellTransaction || mongoose.model("ResellTransaction", ResellTransactionSchema);
