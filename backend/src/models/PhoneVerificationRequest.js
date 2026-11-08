import mongoose from "mongoose";

const phoneVerificationActionSchema = new mongoose.Schema(
  {
    action: { type: String, enum: ["requested", "approved", "rejected", "code_issued", "verified", "expired"], required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, required: true },
    note: { type: String, default: "" }
  },
  { _id: false }
);

const phoneVerificationRequestSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    phone: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending_admin_review", "code_issued", "rejected", "verified", "expired"],
      default: "pending_admin_review",
      required: true
    },
    codeHash: { type: String, default: null, select: false },
    codeIssuedAt: { type: Date, default: null },
    codeExpiresAt: { type: Date, default: null },
    codeAttempts: { type: Number, default: 0 },
    codeIssueHistory: [{
      issuedAt: { type: Date, required: true },
      issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
    }],
    requestedAt: { type: Date, required: true, default: Date.now },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, default: "" },
    verifiedAt: { type: Date, default: null },
    actions: { type: [phoneVerificationActionSchema], default: [] }
  },
  { timestamps: true }
);

phoneVerificationRequestSchema.index({ status:  1, createdAt: -1 });
phoneVerificationRequestSchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending_admin_review", "code_issued"] } },
    name: "one_active_phone_verification_request_per_user"
  }
);

export default mongoose.model("PhoneVerificationRequest", phoneVerificationRequestSchema);
