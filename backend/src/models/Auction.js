import mongoose from "mongoose";
import { AUCTION_DURATION_DAYS } from "../config/auctions.js";

const AUCTION_STATUSES = [
  "draft",
  "scheduled",
  "live",
  "ended",
  "cancelled",
  "rejected"
];
const REVIEW_STATUSES = ["draft", "pending", "approved", "rejected"];
const CURRENCIES = ["YER_ADEN", "YER_SANAA", "SAR", "USD"];
const DELIVERY_METHODS = ["delivery", "pickup", "both"];
const SALE_STATUSES = [
  "not_applicable",
  "awaiting_confirmation",
  "completed",
  "disputed"
];
const AUCTION_IMAGE_LABELS = [
  "front",
  "rear",
  "left_side",
  "right_side",
  "interior",
  "dashboard",
  "reported_damage",
  "vin_location",
  "actual_item"
];

const AuctionDocumentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, maxlength: 64 },
    typeLabel: { type: String, default: "", maxlength: 100 },
    policyVersion: { type: Number, default: 0, min: 0 },
    storageKey: { type: String, required: true, immutable: true },
    mimeType: { type: String, required: true, immutable: true },
    size: { type: Number, required: true, immutable: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, immutable: true },
    reviewStatus: {
      type: String,
      enum: ["pending_review", "approved", "rejected"],
      default: "pending_review"
    },
    isCurrent: { type: Boolean, default: true },
    uploadedAt: { type: Date, required: true, immutable: true },
    expiresAt: { type: Date, default: null, immutable: true },
    version: { type: Number, default: 0, min: 0, immutable: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    reviewNotes: { type: String, default: null, maxlength: 1_000 },
    rejectionReason: { type: String, default: null, maxlength: 1_000 }
  },
  { timestamps: false }
);

const SubmissionAcknowledgmentSchema = new mongoose.Schema(
  {
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    acceptedAt: { type: Date, required: true, immutable: true },
    version: { type: String, required: true, immutable: true },
    text: { type: String, required: true, immutable: true }
  },
  { _id: false }
);

const AuctionSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 5_000 },
    itemCondition: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
    defectsNotes: { type: String, required: true, trim: true, minlength: 1, maxlength: 2_000 },
    deliveryMethod: { type: String, enum: DELIVERY_METHODS, required: true },
    deliveryDetails: { type: String, required: true, trim: true, minlength: 3, maxlength: 1_000 },
    images: {
      type: [{ type: String, required: true }],
      validate: {
        validator: (images) => Array.isArray(images) && images.length > 0,
        message: "يجب إضافة صورة واحدة على الأقل."
      }
    },
    imageLabels: {
      type: [{ type: String, enum: AUCTION_IMAGE_LABELS }],
      default: []
    },
    categoryDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    categoryDocuments: { type: [AuctionDocumentSchema], default: [] },
    categoryDocumentStatus: {
      type: String,
      enum: ["missing", "pending_review", "approved", "rejected"],
      default: "missing"
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true
    },
    governorateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Governorate",
      required: true,
      index: true
    },
    cityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "City",
      default: null,
      index: true
    },
    currency: { type: String, enum: CURRENCIES, required: true },
    startingPrice: { type: mongoose.Schema.Types.Decimal128, required: true },
    currentPrice: { type: mongoose.Schema.Types.Decimal128, required: true },
    minimumIncrement: { type: mongoose.Schema.Types.Decimal128, required: true },
    durationDays: { type: Number, enum: AUCTION_DURATION_DAYS, required: true },
    startAt: { type: Date, default: null, index: true },
    endAt: { type: Date, default: null, index: true },
    status: { type: String, enum: AUCTION_STATUSES, default: "draft", index: true },
    reviewStatus: {
      type: String,
      enum: REVIEW_STATUSES,
      default: "draft",
      index: true
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null, maxlength: 1_000 },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancellationReason: { type: String, default: null, maxlength: 1_000 },
    cancelledAt: { type: Date, default: null },
    highestBidderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    highestBidId: { type: mongoose.Schema.Types.ObjectId, ref: "AuctionBid", default: null },
    bidCount: { type: Number, min: 0, default: 0 },
    endedAt: { type: Date, default: null },
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    winningBidId: { type: mongoose.Schema.Types.ObjectId, ref: "AuctionBid", default: null },
    submissionAcknowledgments: {
      type: [SubmissionAcknowledgmentSchema],
      default: []
    },
    saleStatus: {
      type: String,
      enum: SALE_STATUSES,
      default: "not_applicable",
      index: true
    },
    sellerConfirmedAt: { type: Date, default: null },
    winnerConfirmedAt: { type: Date, default: null },
    disputeReportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    disputeReportedAt: { type: Date, default: null },
    disputeReason: { type: String, default: null, maxlength: 1_000 }
  },
  { timestamps: true }
);

AuctionSchema.index({ reviewStatus: 1, status: 1, createdAt: -1 });
AuctionSchema.index({ status: 1, startAt: 1, endAt: 1 });
AuctionSchema.index({ categoryId: 1, status: 1, endAt: 1 });
AuctionSchema.index({ governorateId: 1, status: 1, endAt: 1 });
AuctionSchema.index(
  { status: 1, endAt: 1 },
  { partialFilterExpression: { status: "live" }, name: "live_auction_endAt" }
);

export const Auction = mongoose.models.Auction || mongoose.model("Auction", AuctionSchema);
export { AUCTION_STATUSES, REVIEW_STATUSES, CURRENCIES, DELIVERY_METHODS, SALE_STATUSES };
export default Auction;
