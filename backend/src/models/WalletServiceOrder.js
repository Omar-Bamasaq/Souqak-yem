import mongoose from "mongoose";

const previousPaymentReceiptSchema = new mongoose.Schema({
  path: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now }
}, { _id: false });

const walletServiceOrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    draftActionId: { type: mongoose.Schema.Types.ObjectId, ref: "DraftAction", default: null },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "WalletService", default: null },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "DigitalServiceCategory", default: null },
    categoryName: { type: String, default: "", maxlength: 120 },
    orderType: { type: String, enum: ["catalog", "custom"], required: true },
    idempotencyKey: { type: String, default: null, maxlength: 128 },
    idempotencyPayloadHash: { type: String, default: null, maxlength: 64 },
    status: {
      type: String,
      enum: ["CUSTOM_QUOTE_PENDING", "QUOTE_OFFERED", "AWAITING_PAYMENT", "PAYMENT_REVIEW", "PAYMENT_NEEDS_CORRECTION", "IN_PROGRESS", "COMPLETED", "REJECTED"],
      default: "AWAITING_PAYMENT",
      index: true
    },
    serviceName: { type: String, required: true, trim: true, maxlength: 160 },
    serviceType: { type: String, default: "", maxlength: 40 },
    serviceVersion: { type: Number, default: null, min: 1 },
    formSchemaVersion: { type: Number, default: null, min: 1 },
    serviceUrl: { type: String, default: "", maxlength: 2048 },
    serviceUrlSafety: { type: String, enum: ["web_risk_clean", "cloudflare_unlisted_clean"], default: null },
    serviceUrlCheckedAt: { type: Date, default: null },
    sectionName: { type: String, default: "" },
    packageId: { type: String, default: "", maxlength: 50 },
    packageName: { type: String, default: "", maxlength: 120 },
    pricingType: { type: String, enum: ["FIXED", "UNIT", "PACKAGE", null], default: null },
    quantity: { type: Number, default: 1, min: 1 },
    customerInfoLabel: { type: String, default: "" },
    customerInfo: { type: String, default: "", maxlength: 300 },
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
    formSchemaSnapshot: { type: mongoose.Schema.Types.Mixed, default: [] },
    whatsappNumber: { type: String, required: true, match: /^\d{9}$/ },
    customerNotes: { type: String, default: "", maxlength: 1000 },
    currency: { type: String, enum: ["USD", "SAR", "YER_ADEN", "YER_SANAA"], default: "USD" },
    unitPrice: { type: Number, min: 0 },
    serviceAmount: { type: Number, min: 0 },
    platformFee: { type: Number, min: 0 },
    buyerServiceFee: { type: Number, min: 0 },
    totalAmount: { type: Number, min: 0 },
    pricingSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    paymentReceipt: { type: String, default: "" },
    previousPaymentReceipts: { type: [previousPaymentReceiptSchema], default: [] },
    quoteNote: { type: String, default: "", maxlength: 1000 },
    completionNote: { type: String, default: "", maxlength: 1000 },
    rejectionReason: { type: String, default: "", maxlength: 1000 },
    paymentCorrectionReason: { type: String, default: "", maxlength: 1000 },
    statusHistory: [{
      status: { type: String, required: true },
      note: { type: String, default: "", maxlength: 1000 },
      actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      actorRole: { type: String, default: "system" },
      createdAt: { type: Date, default: Date.now }
    }],
    quotedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    paymentReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    quoteAcceptedAt: { type: Date, default: null },
    paymentSubmittedAt: { type: Date, default: null },
    paymentReviewedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

walletServiceOrderSchema.index({ user: 1, createdAt: -1 });
walletServiceOrderSchema.index({ status: 1, createdAt: -1 });
walletServiceOrderSchema.index({ "previousPaymentReceipts.path": 1 });
walletServiceOrderSchema.index(
  { draftActionId: 1 },
  { unique: true, partialFilterExpression: { draftActionId: { $type: "objectId" } } }
);
walletServiceOrderSchema.index(
  { user: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } }
  }
);

export default mongoose.model("WalletServiceOrder", walletServiceOrderSchema);
