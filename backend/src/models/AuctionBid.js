import mongoose from "mongoose";

const AuctionBidSchema = new mongoose.Schema(
  {
    auctionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true
    },
    bidderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true, immutable: true },
    sequence: { type: Number, required: true, min: 1, immutable: true },
    auctionStatusAtAcceptance: {
      type: String,
      enum: ["live"],
      required: true,
      immutable: true
    },
    auctionEndsAt: { type: Date, required: true, immutable: true },
    idempotencyKey: { type: String, required: true, immutable: true },
    createdAt: { type: Date, default: Date.now, immutable: true }
  },
  { versionKey: false, timestamps: false }
);

AuctionBidSchema.index(
  { auctionId: 1, sequence: 1 },
  { unique: true, name: "auction_bid_sequence_unique" }
);
AuctionBidSchema.index({ auctionId: 1, createdAt: -1 });
AuctionBidSchema.index(
  { auctionId: 1, idempotencyKey: 1 },
  { unique: true, name: "auction_bid_idempotency_unique" }
);
AuctionBidSchema.index({ bidderId: 1, createdAt: -1 });

for (const operation of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete"
]) {
  AuctionBidSchema.pre(operation, function rejectBidMutation() {
    throw new Error("Auction bids are immutable.");
  });
}

export const AuctionBid =
  mongoose.models.AuctionBid || mongoose.model("AuctionBid", AuctionBidSchema);
export default AuctionBid;
