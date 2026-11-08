import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import AuctionBid from "../models/AuctionBid.js";
import User from "../models/User.js";
import {
  AUCTION_EXTENSION_DURATION_MS,
  AUCTION_EXTENSION_WINDOW_MS
} from "../config/auctions.js";
import {
  addAuctionAmounts,
  compareAuctionAmounts,
  parseAuctionAmount
} from "../utils/auctionMoney.js";
import { createAuctionBidEligibilityChecker } from "./auctionBidEligibility.js";
import { AuctionError } from "./auctionErrors.js";
import { createNotification } from "./notificationService.js";
import { isPublicationEligible } from "./auctionPublicationEligibility.js";

const isEligible = createAuctionBidEligibilityChecker({ UserModel: User });

function asObjectId(value, fieldName) {
  if (!mongoose.isValidObjectId(value)) {
    throw new AuctionError("INVALID_ID", `${fieldName} غير صالح.`, 400);
  }
  return new mongoose.Types.ObjectId(value);
}

function serializeBid(bid) {
  return {
    id: String(bid._id),
    auctionId: String(bid.auctionId),
    amount: bid.amount.toString(),
    sequence: bid.sequence,
    auctionEndsAt: bid.auctionEndsAt,
    createdAt: bid.createdAt
  };
}

function emitAuctionUpdate(io, auction) {
  if (!io || !auction) return;
  const payload = {
    auctionId: String(auction._id),
    status: auction.status,
    currentPrice: auction.currentPrice.toString(),
    bidCount: auction.bidCount,
    endAt: auction.endAt
  };
  io.to(`auction:${auction._id}`).emit("auction:updated", payload);
}

async function notifyOutbid(app, bidderId, auctionId, title) {
  if (!bidderId) return;
  const notification = await createNotification(app, {
    userId: bidderId,
    type: "auction",
    title: "تم تجاوز عرضك",
    body: `تم تقديم عرض أعلى في مزاد "${title}".`,
    data: { auctionId: String(auctionId), event: "outbid" }
  });
  if (!notification) {
    console.warn("[Auction] Outbid notification was not stored.", {
      auctionId: String(auctionId),
      userId: String(bidderId)
    });
  }
}

async function notifyAuctionOwner(app, auction, bid) {
  if (!auction?.ownerId) {
    console.warn("[Auction] Cannot notify the owner because the auction has no owner.", {
      auctionId: String(auction?._id || bid.auctionId),
      bidId: String(bid._id)
    });
    return;
  }

  const auctionId = String(auction._id);
  const notification = await createNotification(app, {
    userId: auction.ownerId,
    type: "auction",
    title: "مزايدة جديدة على مزادك",
    body: `وصل عرض جديد بقيمة ${bid.amount.toString()} ${auction.currency} على مزاد "${auction.title}".`,
    eventKey: `auction_bid:${auctionId}:${bid.sequence}`,
    data: {
      auctionId,
      bidId: String(bid._id),
      bidderId: String(bid.bidderId),
      amount: bid.amount.toString(),
      currency: auction.currency,
      sequence: bid.sequence,
      event: "new_bid"
    }
  });
  if (!notification) {
    console.warn("[Auction] Owner bid notification was not stored.", {
      auctionId,
      bidId: String(bid._id),
      userId: String(auction.ownerId)
    });
  }
}

export async function placeAuctionBid({
  auctionId: auctionIdInput,
  bidderId: bidderIdInput,
  amount: amountInput,
  idempotencyKey,
  now = new Date(),
  app
}) {
  const auctionId = asObjectId(auctionIdInput, "المزاد");
  const bidderId = asObjectId(bidderIdInput, "المستخدم");
  const amount = parseAuctionAmount(amountInput, "قيمة العرض");
  if (
    typeof idempotencyKey !== "string" ||
    idempotencyKey.length < 8 ||
    idempotencyKey.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)
  ) {
    throw new AuctionError("INVALID_IDEMPOTENCY_KEY", "مفتاح الطلب غير صالح.", 400);
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError("A valid bid timestamp is required.");
  }

  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const eligibility = await isEligible({ bidderId, session, now });
      if (eligibility === "inactive") {
        throw new AuctionError(
          "ACCOUNT_INACTIVE",
          "لا يمكن لهذا الحساب المشاركة في المزاد.",
          403
        );
      }
      if (eligibility === "verification-required") {
        throw new AuctionError(
          "AUCTION_VERIFICATION_REQUIRED",
          "يجب أن يكون حسابك موثقًا وساري التوثيق للمزايدة.",
          403
        );
      }

      const previousRequest = await AuctionBid.findOne({ auctionId, idempotencyKey })
        .session(session)
        .lean();
      if (previousRequest) {
        if (String(previousRequest.bidderId) !== String(bidderId)) {
          throw new AuctionError(
            "IDEMPOTENCY_KEY_REUSED",
            "مفتاح الطلب مستخدم لعرض آخر.",
            409
          );
        }
        if (compareAuctionAmounts(previousRequest.amount, amount.normalized) !== 0) {
          throw new AuctionError(
            "IDEMPOTENCY_KEY_REUSED",
            "مفتاح الطلب مستخدم لعرض مختلف.",
            409
          );
        }
        result = { bid: previousRequest, replayed: true };
        return;
      }

      const auction = await Auction.findOne({
        _id: auctionId,
        reviewStatus: "approved",
        status: "live"
      })
        .session(session)
        .lean();
      if (!auction) {
        const current = await Auction.findById(auctionId).session(session).lean();
        if (!current || current.reviewStatus !== "approved") {
          throw new AuctionError("AUCTION_NOT_FOUND", "المزاد غير متاح.", 404);
        }
        if (current.status === "scheduled" || now < current.startAt) {
          throw new AuctionError("AUCTION_NOT_LIVE", "لم يبدأ المزاد بعد.", 409);
        }
        if (current.status === "ended" || now >= current.endAt) {
          throw new AuctionError("AUCTION_ENDED", "انتهى وقت المزايدة.", 409);
        }
        throw new AuctionError("AUCTION_NOT_LIVE", "المزاد غير متاح للمزايدة.", 409);
      }
      if (String(auction.ownerId) === String(bidderId)) {
        throw new AuctionError("OWNER_CANNOT_BID", "لا يمكنك المزايدة على مزادك.", 403);
      }
      if (!(await isPublicationEligible(auction, now))) {
        throw new AuctionError(
          "AUCTION_REQUIREMENTS_NOT_MET",
          "المزاد غير متاح للمزايدة قبل استكمال مراجعة متطلبات فئته.",
          409
        );
      }
      if (now < auction.startAt || now >= auction.endAt) {
        throw new AuctionError("AUCTION_NOT_LIVE", "المزاد غير متاح للمزايدة الآن.", 409);
      }

      const nextMinimum = addAuctionAmounts(
        auction.currentPrice,
        auction.minimumIncrement
      );
      if (compareAuctionAmounts(amount.decimal, nextMinimum) < 0) {
        throw new AuctionError(
          "BID_TOO_LOW",
          `يجب أن يكون العرض ${nextMinimum.toString()} ${auction.currency} على الأقل.`,
          409
        );
      }

      const previousHighestBidderId = auction.highestBidderId;
      const bidId = new mongoose.Types.ObjectId();
      let auctionEndsAt = auction.endAt;
      if (
        AUCTION_EXTENSION_WINDOW_MS > 0 &&
        auction.endAt.getTime() - now.getTime() <= AUCTION_EXTENSION_WINDOW_MS
      ) {
        const extensionEnd = new Date(now.getTime() + AUCTION_EXTENSION_DURATION_MS);
        if (extensionEnd > auctionEndsAt) auctionEndsAt = extensionEnd;
      }

      const updatedAuction = await Auction.findOneAndUpdate(
        {
          _id: auctionId,
          ownerId: { $ne: bidderId },
          reviewStatus: "approved",
          status: "live",
          startAt: { $lte: now },
          endAt: { $gt: now },
          currentPrice: auction.currentPrice,
          bidCount: auction.bidCount
        },
        {
          $set: {
            currentPrice: amount.decimal,
            highestBidderId: bidderId,
            highestBidId: bidId,
            endAt: auctionEndsAt
          },
          $inc: { bidCount: 1 }
        },
        { new: true, session, runValidators: true }
      ).lean();

      if (!updatedAuction) {
        throw new AuctionError(
          "BID_RACE",
          "تم تجاوز هذا العرض بعرض آخر، أعد المحاولة.",
          409
        );
      }

      const [createdBid] = await AuctionBid.create(
        [
          {
            _id: bidId,
            auctionId,
            bidderId,
            amount: amount.decimal,
            sequence: auction.bidCount + 1,
            auctionStatusAtAcceptance: "live",
            auctionEndsAt,
            idempotencyKey
          }
        ],
        { session }
      );

      result = { bid: createdBid.toObject(), auction: updatedAuction, replayed: false };
      if (
        previousHighestBidderId &&
        String(previousHighestBidderId) !== String(bidderId)
      ) {
        result.previousHighestBidderId = previousHighestBidderId;
      }
    });
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await AuctionBid.findOne({ auctionId, idempotencyKey }).lean();
      if (
        duplicate &&
        String(duplicate.bidderId) === String(bidderId) &&
        compareAuctionAmounts(duplicate.amount, amount.normalized) === 0
      ) {
        const currentAuction = await Auction.findById(auctionId).lean();
        result = { bid: duplicate, auction: currentAuction, replayed: true };
      } else {
        throw new AuctionError(
          "BID_CONFLICT",
          "تم تجاوز هذا العرض بعرض آخر، أعد المحاولة.",
          409
        );
      }
    } else {
      throw error;
    }
  } finally {
    await session.endSession();
  }

  if (!result?.bid || (!result.replayed && !result.auction)) {
    throw new Error("The bid transaction completed without a result.");
  }

  if (!result.replayed) {
    emitAuctionUpdate(app?.get?.("io"), result.auction);
    await notifyAuctionOwner(app, result.auction, result.bid);
    await notifyOutbid(
      app,
      result.previousHighestBidderId,
      auctionId,
      result.auction.title
    );
  }

  return {
    bid: serializeBid(result.bid),
    auction: {
      id: String(result.bid.auctionId),
      status: result.bid.auctionStatusAtAcceptance,
      currentPrice: result.bid.amount.toString(),
      bidCount: result.bid.sequence,
      endAt: result.bid.auctionEndsAt
    },
    replayed: result.replayed
  };
}
