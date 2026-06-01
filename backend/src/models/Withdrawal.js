import mongoose from "mongoose";
import { softDeletePlugin } from "../lib/softDelete.js";

const withdrawalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true }, // المبلغ المطلوب سحبه
    feeAmount: { type: Number, default: 0 }, // عمولة السحب (1%)
    finalAmount: { type: Number, default: 0 }, // المبلغ الصافي بعد خصم العمولة
    currency: { type: String, default: "YER" },
    phoneNumber: { type: String, required: true }, // رقم الهاتف للتواصل بخصوص السحب
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "REJECTED"],
      default: "PENDING"
    },
    bankDetails: {
      receiptType: { type: String, enum: ["bank_account", "exchange_transfer"], default: "bank_account" },
      bankName: { type: String, required: true },
      accountName: { type: String, required: true },
      accountNumber: { type: String }, // رقم الحساب (للحساب البنكي)
      accountCurrency: { type: String }, // عملة الحساب المستلم
      governorateId: { type: mongoose.Schema.Types.ObjectId, ref: "Governorate" }, // للمحافظة (للحوالة)
      cityId: { type: mongoose.Schema.Types.ObjectId, ref: "City" }, // للمدينة (للحوالة)
      identityImage: { type: String } // صورة الهوية (للحوالة)
    },
    transactionProof: { type: String }, // صورة إثبات التحويل من الإدارة للبائع
    adminNotes: { type: String },
    processedAt: { type: Date },

    // Soft Delete Fields (Phase 1)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

withdrawalSchema.index({ status: 1 });
withdrawalSchema.index({ createdAt: -1 });
withdrawalSchema.index({ user: 1 });
withdrawalSchema.index({ createdAt: 1 });

withdrawalSchema.plugin(softDeletePlugin);

export default mongoose.model("Withdrawal", withdrawalSchema);
