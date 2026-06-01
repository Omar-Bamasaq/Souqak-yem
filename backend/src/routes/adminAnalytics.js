import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import Order from "../models/Order.js";
import Transaction from "../models/Transaction.js";
import Ad from "../models/Ad.js";
import User from "../models/User.js";
import Dispute from "../models/Dispute.js";
import Commission from "../models/Commission.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import dayjs from "dayjs";

const router = Router();

// Middleware: Admin only
router.use(auth, requireRole(["admin"]));

/**
 * GET /api/admin/analytics/overview
 * Smart Analytics Dashboard API
 */
router.get("/overview", async (req, res) => {
  try {
    const { range = "month" } = req.query; // day, week, month, year
    
    const now = dayjs();
    let startDate;
    
    if (range === "day") startDate = now.startOf("day");
    else if (range === "week") startDate = now.subtract(7, "days").startOf("day");
    else if (range === "year") startDate = now.subtract(1, "year").startOf("day");
    else startDate = now.subtract(30, "days").startOf("day"); // default month

    const dateFilter = { createdAt: { $gte: startDate.toDate() } };

    // 1. Revenue & Earnings (Multi-source Aggregation)
    
    // A. Revenue from Escrow (Orders platformFee)
    const escrowRevenue = await Order.aggregate([
      { 
        $match: { 
          status: { $in: ["COMPLETED", "DELIVERED", "PAID_CONFIRMED", "SHIPPED"] },
          createdAt: { $gte: startDate.toDate() }
        } 
      },
      {
        $group: {
          _id: "$currency",
          total: { $sum: "$platformFee" }
        }
      }
    ]);

    // B. Revenue from Withdrawal Fees (1%)
    const withdrawRevenue = await Transaction.aggregate([
      { 
        $match: { 
          type: "WITHDRAW_FEE",
          status: "COMPLETED",
          createdAt: { $gte: startDate.toDate() }
        } 
      },
      {
        $group: {
          _id: "$currency",
          total: { $sum: { $abs: "$amount" } }
        }
      }
    ]);

    // C. Revenue from Plans (Featured/Verification)
    const planRevenue = await PurchaseRequest.aggregate([
      { 
        $match: { 
          status: "Approved",
          createdAt: { $gte: startDate.toDate() }
        } 
      },
      {
        $lookup: {
          from: "plans",
          localField: "plan",
          foreignField: "_id",
          as: "planDetails"
        }
      },
      { $unwind: "$planDetails" },
      {
        $group: {
          _id: { type: "$planDetails.type", currency: "$planDetails.currency" },
          total: { $sum: "$planDetails.price" }
        }
      }
    ]);

    // D. Revenue from Direct Commissions (Manual Sales)
    const commissionRevenue = await Commission.aggregate([
      { 
        $match: { 
          status: "paid",
          paidAt: { $gte: startDate.toDate() }
        } 
      },
      {
        $group: {
          _id: "$currency",
          total: { $sum: "$commissionAmount" }
        }
      }
    ]);

    // Format revenue sources with multiple currencies
    const earnings = {
      escrowFees: {}, 
      withdrawFees: {},
      featuredAdsRevenue: {},
      verificationRevenue: {},
      commissionRevenue: {},
      totalRevenue: {}
    };

    // Populate Escrow
    escrowRevenue.forEach(r => {
      const curr = r._id || "YER";
      earnings.escrowFees[curr] = r.total;
      earnings.totalRevenue[curr] = (earnings.totalRevenue[curr] || 0) + r.total;
    });

    // Populate Withdrawal Fees
    withdrawRevenue.forEach(r => {
      const curr = r._id || "YER";
      earnings.withdrawFees[curr] = r.total;
      earnings.totalRevenue[curr] = (earnings.totalRevenue[curr] || 0) + r.total;
    });

    // Populate Plans
    planRevenue.forEach(r => {
      const curr = r._id.currency || "YER";
      const type = r._id.type;
      if (type === "featured") {
        earnings.featuredAdsRevenue[curr] = (earnings.featuredAdsRevenue[curr] || 0) + r.total;
      } else if (type === "verification") {
        earnings.verificationRevenue[curr] = (earnings.verificationRevenue[curr] || 0) + r.total;
      }
      earnings.totalRevenue[curr] = (earnings.totalRevenue[curr] || 0) + r.total;
    });

    // Populate Direct Commissions
    commissionRevenue.forEach(r => {
      const curr = r._id || "YER";
      earnings.commissionRevenue[curr] = r.total;
      earnings.totalRevenue[curr] = (earnings.totalRevenue[curr] || 0) + r.total;
    });

    // 2. Secure Purchase (Orders) Stats
    const totalOrders = await Order.countDocuments();
    const rangeOrders = await Order.countDocuments(dateFilter);
    const completedOrders = await Order.countDocuments({ status: "COMPLETED" });
    const disputesCount = await Dispute.countDocuments();

    // 3. Featured Ads Stats
    const totalFeaturedAds = await Ad.countDocuments({ featured: true });
    const rangeFeaturedAds = await Ad.countDocuments({ featured: true, ...dateFilter });

    // 4. User & Verification Stats
    const totalUsers = await User.countDocuments();
    const newUsersInRange = await User.countDocuments(dateFilter);
    const verifiedUsers = await User.countDocuments({ verified: true });
    const verificationRate = totalUsers > 0 ? (verifiedUsers / totalUsers) * 100 : 0;

    // 5. Listing Stats
    const totalListings = await Ad.countDocuments();
    const dailyListings = await Ad.countDocuments({ 
      createdAt: { $gte: dayjs().startOf("day").toDate() } 
    });

    // 6. Calculated Metrics
    const conversionRate = totalListings > 0 ? (completedOrders / totalListings) * 100 : 0;
    const securePurchaseRate = totalListings > 0 ? (totalOrders / totalListings) * 100 : 0;
    
    const revenuePerUser = {};
    if (totalUsers > 0) {
      Object.entries(earnings.totalRevenue).forEach(([curr, val]) => {
        revenuePerUser[curr] = (val / totalUsers).toFixed(2);
      });
    }

    // 7. Time-series Data for Charts (Last 7 days/months depending on range)
    const timeSeriesData = await Order.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: range === "year" ? "%Y-%m" : "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 },
          amount: { $sum: "$totalAmount" }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // 8. Top Categories (Listing Distribution)
    const topCategories = await Ad.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" },
      {
        $project: {
          name: "$category.name",
          count: 1
        }
      }
    ]);

    // 9. Activity by Governorate
    const topGovernorates = await Ad.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: "$governorateId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "governorates",
          localField: "_id",
          foreignField: "_id",
          as: "gov"
        }
      },
      { $unwind: "$gov" },
      {
        $project: {
          name: "$gov.name",
          count: 1
        }
      }
    ]);

    // 10. Recent Orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("buyer", "name")
      .populate("seller", "name")
      .populate("ad", "title")
      .lean();

    res.json({
      earnings,
      orders: {
        total: totalOrders,
        rangeCount: rangeOrders,
        completed: completedOrders,
        disputes: disputesCount
      },
      featured: {
        total: totalFeaturedAds,
        rangeCount: rangeFeaturedAds
      },
      users: {
        total: totalUsers,
        newInRange: newUsersInRange,
        verified: verifiedUsers,
        verificationRate: verificationRate.toFixed(2)
      },
      listings: {
        total: totalListings,
        daily: dailyListings
      },
      metrics: {
        conversionRate: conversionRate.toFixed(2),
        securePurchaseRate: securePurchaseRate.toFixed(2),
        revenuePerUser: revenuePerUser
      },
      charts: timeSeriesData,
      topCategories,
      topGovernorates,
      recentOrders
    });

  } catch (err) {
    console.error("Analytics Error:", err);
    res.status(500).json({ error: "فشل تحميل الإحصائيات" });
  }
});

export default router;
