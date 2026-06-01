import mongoose from "mongoose";

const purchaseRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    plan: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Ad" },
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending", index: true },
    paymentReceipt: { type: String },
    rejectionReason: { type: String },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model("PurchaseRequest", purchaseRequestSchema);
