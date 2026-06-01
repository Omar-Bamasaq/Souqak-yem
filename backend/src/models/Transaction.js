import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    type: {
      type: String,
      enum: ["PAYMENT", "FEE", "RELEASE", "WITHDRAWAL", "WITHDRAW_FEE", "REFUND", "ADMIN_ADJUSTMENT"],
      required: true
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "YER" },
    description: { type: String },
    balanceType: { type: String, enum: ["pending", "available"], required: true },

    // Soft Delete Fields (Phase 1)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null },
    status: { 
      type: String, 
      enum: ["PENDING", "COMPLETED", "FAILED", "deleted"], 
      default: "COMPLETED",
      index: true
    }
  },
  { timestamps: true }
);

transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ user: 1 });
transactionSchema.index({ createdAt: 1 });

transactionSchema.plugin(softDeletePlugin);

export default mongoose.model("Transaction", transactionSchema);
