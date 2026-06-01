import mongoose from "mongoose";

const adminEscrowLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actionType: { 
      type: String, 
      enum: [
        "CONFIRM_PAYMENT", 
        "START_WITHDRAWAL_PROCESSING", 
        "COMPLETE_WITHDRAWAL", 
        "REJECT_WITHDRAWAL", 
        "RESOLVE_DISPUTE", 
        "MANUAL_ADJUSTMENT"
      ], 
      required: true 
    },
    targetType: { type: String, enum: ["Order", "Withdrawal", "Dispute", "User"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    details: { type: Object }, // أي بيانات إضافية للتوثيق
    ipAddress: { type: String }
  },
  { timestamps: true }
);

adminEscrowLogSchema.index({ createdAt: -1 });

export default mongoose.model("AdminEscrowLog", adminEscrowLogSchema);
