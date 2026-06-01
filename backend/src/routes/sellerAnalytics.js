import { Router } from "express";
import mongoose from "mongoose";
import Ad from "../models/Ad.js";
import Order from "../models/Order.js";
import Follow from "../models/Follow.js";
import Wallet from "../models/Wallet.js";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";

const router = Router();

router.get("/overview", auth, requireRole(["seller", "user", "admin"]), async (req, res) => {
  try {
    const sellerId = req.user.id;

    // 1. Ads Summary
    const adsStats = await Ad.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(sellerId) } },
      { $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalViews: { $sum: "$viewCount" }
      }}
    ]);

    const adsBreakdown = {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      sold: 0,
      totalViews: 0
    };

    adsStats.forEach(stat => {
      adsBreakdown.total += stat.count;
      adsBreakdown.totalViews += stat.totalViews;
      if (stat._id === "approved") adsBreakdown.approved = stat.count;
      if (stat._id === "pending") adsBreakdown.pending = stat.count;
      if (stat._id === "rejected") adsBreakdown.rejected = stat.count;
    });
    
    // Count sold ads separately if status is not 'sold' but 'sold' field is true
    const soldCount = await Ad.countDocuments({ userId: sellerId, sold: true });
    adsBreakdown.sold = soldCount;

    // 2. Orders Summary & Revenue
    const ordersStats = await Order.aggregate([
      { $match: { seller: new mongoose.Types.ObjectId(sellerId) } },
      { $group: {
        _id: "$status",
        count: { $sum: 1 },
        revenue: { $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, "$sellerAmount", 0] } },
        pendingRevenue: { $sum: { $cond: [{ $in: ["$status", ["PAID_CONFIRMED", "SHIPPED"]] }, "$sellerAmount", 0] } }
      }}
    ]);

    const ordersBreakdown = {
      total: 0,
      completed: 0,
      pending: 0, // Awaiting approval/payment
      escrow: 0, // Paid but not released
      delivered: 0, // Delivered but not completed
      cancelled: 0,
      revenue: 0,
      pendingRevenue: 0
    };

    ordersStats.forEach(stat => {
      ordersBreakdown.total += stat.count;
      if (stat._id === "COMPLETED") {
        ordersBreakdown.completed = stat.count;
        ordersBreakdown.revenue += stat.revenue;
      } else if (["PAID_CONFIRMED", "SHIPPED"].includes(stat._id)) {
        ordersBreakdown.escrow += stat.count;
        ordersBreakdown.pendingRevenue += stat.pendingRevenue;
      } else if (stat._id === "DELIVERED") {
        ordersBreakdown.delivered = stat.count;
      } else if (["PENDING_SELLER_APPROVAL", "AWAITING_PAYMENT", "AWAITING_PAYMENT_CONFIRMATION"].includes(stat._id)) {
        ordersBreakdown.pending += stat.count;
      } else if (stat._id === "CANCELLED") {
        ordersBreakdown.cancelled = stat.count;
      }
    });

    // 3. Followers
    const followerCount = await Follow.countDocuments({ sellerId });

    // 4. Wallet Info
    const wallet = await Wallet.findOne({ user: new mongoose.Types.ObjectId(sellerId) });
    
    // تصحيح الرصيد المعلق تلقائياً في حال وجود اختلاف (Self-healing logic)
    if (wallet && wallet.balances) {
      let walletModified = false;
      for (const balance of wallet.balances) {
        // حساب الرصيد المعلق الفعلي من الطلبات الحالية
        const actualPendingStats = await Order.aggregate([
          { $match: { 
            seller: new mongoose.Types.ObjectId(sellerId), 
            currency: balance.currency,
            status: { $in: ["PAID_CONFIRMED", "SHIPPED"] } 
          }},
          { $group: {
            _id: null,
            total: { $sum: "$sellerAmount" },
            shipping: { $sum: { $cond: [
              { $and: [
                { $gt: ["$shippingFee", 0] },
                { $eq: ["$shippingPayer", "buyer"] },
                { $eq: [{ $ifNull: ["$shippingCurrency", "$currency"] }, balance.currency] }
              ]},
              "$shippingFee",
              0
            ]}}
          }}
        ]);

        const actualPending = actualPendingStats.length > 0 ? (actualPendingStats[0].total + actualPendingStats[0].shipping) : 0;
        
        if (Math.abs(balance.pendingBalance - actualPending) > 0.01) {
          console.log(`[WALLET_FIX] Correcting pending balance for user ${sellerId} (${balance.currency}): ${balance.pendingBalance} -> ${actualPending}`);
          balance.pendingBalance = actualPending;
          walletModified = true;
        }
      }
      if (walletModified) {
        await wallet.save();
      }
    }
    
    // Get the most relevant balance:
    // 1. Prefer the one with actual money (availableBalance > 0)
    // 2. Otherwise prefer the currency used in the last completed order
    const lastOrder = await Order.findOne({ seller: sellerId, status: "COMPLETED" }).sort({ updatedAt: -1 }).lean();
    const preferredCurrency = lastOrder?.currency || "YER_ADEN";

    let selectedBalance = wallet?.balances?.find(b => b.availableBalance > 0) || 
                          wallet?.balances?.find(b => b.currency === preferredCurrency) ||
                          wallet?.balances?.find(b => b.currency === "YER_ADEN") || 
                          wallet?.balances?.find(b => b.currency === "YER") || 
                          wallet?.balances?.[0];

    // Calculate revenue per currency for accuracy
    const revenuePerCurrency = {};
    ordersStats.forEach(stat => {
      if (stat._id === "COMPLETED") {
        // Note: aggregation doesn't split by currency, so we need a separate aggregate for that if we want perfect accuracy
      }
    });

    res.json({
      ads: adsBreakdown,
      orders: ordersBreakdown,
      followers: followerCount,
      wallet: {
        availableBalance: selectedBalance?.availableBalance || 0,
        pendingBalance: selectedBalance?.pendingBalance || 0,
        currency: selectedBalance?.currency || preferredCurrency,
        allBalances: wallet?.balances || []
      }
    });
  } catch (error) {
    console.error("Seller analytics error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
