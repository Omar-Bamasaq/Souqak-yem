import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const CommissionSchema = new mongoose.Schema(
  {
    adId: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", default: null },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    price: { type: Number, required: true },
    currency: { type: String, required: true },
    soldAt: { type: Date, default: Date.now },
    commissionAmount: { type: Number, required: true },
    status: { 
      type: String, 
      enum: ["unpaid", "paid", "overdue", "Pending", "Rejected"], 
      default: "unpaid" 
    },
    commissionStatus: {
      type: String,
      enum: ["pending_payment", "pending_review", "approved", "rejected"],
      default: "pending_payment"
    },
    paymentReceipt: { type: String },
    adImage: { type: String },
    paidAt: { type: Date },
    rejectReason: { type: String },
    notes: { type: String },
    
    // Explicit fields for payer info
    payerName: { type: String },
    payerPhone: { type: String },

    // Soft Delete Fields (Phase 1)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null },
    commissionStatus: {
      type: String,
      enum: ["pending_payment", "pending_review", "approved", "rejected", "deleted"],
      default: "pending_payment",
      index: true
    }
  },
  { timestamps: true }
);

CommissionSchema.index({ sellerId: 1, status: 1 });
CommissionSchema.index({ status: 1, createdAt: -1 });
CommissionSchema.index({ createdAt: 1 });
CommissionSchema.index({ soldAt: 1 });

CommissionSchema.plugin(softDeletePlugin);

export default mongoose.models.Commission || mongoose.model("Commission", CommissionSchema);
