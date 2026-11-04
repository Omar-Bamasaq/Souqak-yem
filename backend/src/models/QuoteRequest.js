import mongoose from "mongoose";

const quoteOfferSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["YER_ADEN", "YER_SANAA", "SAR", "USD"], default: "YER_ADEN" },
    availableQuantity: { type: Number, required: true, min: 0 },
    deliveryCost: { type: Number, default: 0, min: 0 },
    validUntil: { type: Date, default: null },
    notes: { type: String, maxlength: 1000, default: "" }
  },
  { timestamps: true }
);

const quoteRequestSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    itemName: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    quantity: { type: Number, required: true, min: 0 },
    governorateId: { type: mongoose.Schema.Types.ObjectId, ref: "Governorate", required: true, index: true },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: "City", required: true, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null, index: true },
    specifications: { type: String, trim: true, maxlength: 2000, default: "" },
    image: { type: String, default: "" },
    status: { type: String, enum: ["open", "closed", "cancelled", "awarded"], default: "open", index: true },
    moderationStatus: { type: String, enum: ["approved", "pending_review", "hidden", "rejected", "deleted"], default: "approved", index: true },
    moderationReason: { type: String, default: "" },
    moderationNotes: { type: String, default: "" },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    moderatedAt: { type: Date, default: null },
    flagged: { type: Boolean, default: false },
    reportCount: { type: Number, default: 0 },
    offers: { type: [quoteOfferSchema], default: [] },
    selectedOfferId: { type: mongoose.Schema.Types.ObjectId, default: null }
  },
  { timestamps: true }
);

quoteRequestSchema.index({ status: 1, createdAt: -1 });
quoteRequestSchema.index({ governorateId: 1, cityId: 1, status: 1, createdAt: -1 });
quoteRequestSchema.index({ categoryId: 1, status: 1, createdAt: -1 });
quoteRequestSchema.index({ "offers.userId": 1, createdAt: -1 });

export default mongoose.models.QuoteRequest || mongoose.model("QuoteRequest", quoteRequestSchema);
