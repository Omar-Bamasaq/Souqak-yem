import mongoose from "mongoose";
import Auction from "../models/Auction.js";
import AuctionBid from "../models/AuctionBid.js";
import User from "../models/User.js";
import { AUCTION_LIFECYCLE_POLL_MS } from "../config/auctions.js";
import { createNotification } from "./notificationService.js";

let lifecycleTimer = null;
let lifecycleRunning = false;

function emit(io, auction, event) {
  io?.to(`auction:${auction._id}`).emit(event, {
    auctionId: String(auction._id),
    status: auction.status,
    currentPrice: auction.currentPrice.toString(),
    bidCount: auction.bidCount,
    endAt: auction.endAt,
    endedAt: auction.endedAt
  });
}

async function notifyUser(app, userId, title, body, auctionId, event) {
  if (!userId) return;
  const notification = await createNotification(app, {
    userId,
    type: "auction",
    title,
    body,
    data: { auctionId: String(auctionId), event }
  });
  if (!notification) {
    console.warn("[Auction] Lifecycle notification was not stored.", {
      auctionId: String(auctionId),
      userId: String(userId),
      event
    });
  }
}

async function activateScheduledAuctions(app, now) {
  const candidates = await Auction.find({
    reviewStatus: "approved",
    status: "scheduled",
    startAt: { $lte: now },
    endAt: { $gt: now }
  })
    .select("_id")
    .limit(100)
    .lean();

  for (const candidate of candidates) {
    const auction = await Auction.findOneAndUpdate(
      {
        _id: candidate._id,
        reviewStatus: "approved",
        status: "scheduled",
        startAt: { $lte: now },
        endAt: { $gt: now }
      },
      { $set: { status: "live" } },
      { new: true }
    ).lean();
    if (!auction) continue;
    emit(app?.get?.("io"), auction, "auction:status");
    await notifyUser(
      app,
      auction.ownerId,
      "بدأ مزادك",
      `بدأ المزاد "${auction.title}" ويمكن للمستخدمين المزايدة الآن.`,
      auction._id,
      "started"
    );
  }
}

async function finishAuction(app, auctionId, now) {
  const session = await mongoose.startSession();
  let finished = null;
  try {
    await session.withTransaction(async () => {
      const auction = await Auction.findOne({
        _id: auctionId,
        reviewStatus: "approved",
        status: { $in: ["scheduled", "live"] },
        endAt: { $lte: now }
      })
        .session(session)
        .lean();
      if (!auction) return;

      const winningBid = auction.highestBidId
        ? await AuctionBid.findOne({
            _id: auction.highestBidId,
            auctionId: auction._id
          })
            .session(session)
            .lean()
        : null;

      const updated = await Auction.findOneAndUpdate(
        {
          _id: auction._id,
          status: { $in: ["scheduled", "live"] },
          endAt: { $lte: now }
        },
        {
          $set: {
            status: "ended",
            endedAt: now,
            winnerId: winningBid ? winningBid.bidderId : null,
            winningBidId: winningBid ? winningBid._id : null,
            saleStatus: winningBid ? "awaiting_confirmation" : "not_applicable"
          }
        },
        { new: true, session, runValidators: true }
      ).lean();

      if (updated) finished = updated;
    });
  } finally {
    await session.endSession();
  }

  if (!finished) return;
  emit(app?.get?.("io"), finished, "auction:status");
  await notifyUser(
    app,
    finished.ownerId,
    "انتهى مزادك",
    finished.winnerId
      ? `انتهى المزاد "${finished.title}" وتم تحديد الفائز.`
      : `انتهى المزاد "${finished.title}" دون عروض.`,
    finished._id,
    "ended"
  );

  if (finished.winnerId) {
    const winner = await User.findOne({
      _id: finished.winnerId,
      isDisabled: { $ne: true },
      isDeleted: { $ne: true }
    })
      .select("_id")
      .lean();
    if (winner) {
      await notifyUser(
        app,
        winner._id,
        "فزت بالمزاد",
        `فزت بالمزاد "${finished.title}". تواصل مع البائع لاستكمال الاتفاق.`,
        finished._id,
        "won"
      );
    }
  }
}

export async function runAuctionLifecycleOnce(app, now = new Date()) {
  await activateScheduledAuctions(app, now);
  const dueAuctions = await Auction.find({
    reviewStatus: "approved",
    status: { $in: ["scheduled", "live"] },
    endAt: { $lte: now }
  })
    .select("_id")
    .sort({ endAt: 1 })
    .limit(100)
    .lean();

  for (const auction of dueAuctions) {
    await finishAuction(app, auction._id, now);
  }
}

export function startAuctionLifecycle(app) {
  if (lifecycleTimer) return lifecycleTimer;

  const run = async () => {
    if (lifecycleRunning) return;
    lifecycleRunning = true;
    try {
      await runAuctionLifecycleOnce(app);
    } catch (error) {
      console.error("[Auction] Lifecycle execution failed.", error);
    } finally {
      lifecycleRunning = false;
    }
  };

  void run();
  lifecycleTimer = setInterval(run, AUCTION_LIFECYCLE_POLL_MS);
  lifecycleTimer.unref?.();
  return lifecycleTimer;
}

export function stopAuctionLifecycle() {
  if (!lifecycleTimer) return;
  clearInterval(lifecycleTimer);
  lifecycleTimer = null;
}
