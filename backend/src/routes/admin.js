import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import Ad from "../models/Ad.js";
import User from "../models/User.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import fs from "fs";
import path from "path";
import Notification from "../models/Notification.js";
import AdReport from "../models/AdReport.js";
import SellerReport from "../models/SellerReport.js";
import adminAudit from "../middleware/adminAudit.js";
import AdminAuditLog from "../models/AdminAuditLog.js";
import AdminNotification from "../models/AdminNotification.js";
import Commission from "../models/Commission.js";
import SoldListing from "../models/SoldListing.js";
import Order from "../models/Order.js";
import Wallet from "../models/Wallet.js";
import Transaction from "../models/Transaction.js";
import Withdrawal from "../models/Withdrawal.js";
import Dispute from "../models/Dispute.js";
import ActivityLog from "../models/ActivityLog.js";
import VerificationRequest from "../models/VerificationRequest.js";
import SupportConversation from "../models/SupportConversation.js";
import SupportMessage from "../models/SupportMessage.js";
import Conversation from "../models/Conversation.js";
import ConversationMessage from "../models/ConversationMessage.js";
import Review from "../models/Review.js";
import Joi from "joi";
import { validateQuery } from "../middleware/validate.js";

import { createNotification } from "../services/notificationService.js";
import { logActivity } from "../services/activityLogService.js";

import processImages from "../middleware/processImages.js";

const router = Router();

router.use(auth, requireRole(["admin"]), adminAudit());

router.get("/stats", async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      activeCount,
      activeToday,
      activeWeek,
      expiredCount,
      lastAd,
      featuredCount,
      totalCount,
      verifiedCount,
      verifiedWeek,
      totalUsers,
      totalAds,
      pendingAds
    ] = await Promise.all([
      Ad.countDocuments({ status: "approved", isArchived: false, sold: false }),
      Ad.countDocuments({ status: "approved", isArchived: false, sold: false, publishedAt: { $gte: todayStart } }),
      Ad.countDocuments({ status: "approved", isArchived: false, sold: false, publishedAt: { $gte: weekStart } }),
      Ad.countDocuments({ status: "expired" }),
      Ad.findOne().sort({ updatedAt: -1 }).select("updatedAt"),
      Ad.countDocuments({ featured: true, status: "approved" }),
      Ad.countDocuments({ status: "approved" }),
      User.countDocuments({ isVerifiedSeller: true }),
      User.countDocuments({ isVerifiedSeller: true, verifiedAt: { $gte: weekStart } }),
      User.countDocuments(),
      Ad.countDocuments(),
      Ad.countDocuments({ status: "pending" })
    ]);

    // Calculate growth/ratios
    const featuredRatio = totalCount > 0 ? ((featuredCount / totalCount) * 100).toFixed(1) : 0;
    const verifiedGrowth = verifiedCount > 0 ? ((verifiedWeek / verifiedCount) * 100).toFixed(1) : 0;

    res.json({
      totalUsers,
      totalAds,
      pendingAds,
      active: {
        count: activeCount,
        today: activeToday,
        week: activeWeek,
        change: activeWeek
      },
      expired: {
        count: expiredCount,
        lastUpdate: lastAd?.updatedAt || now
      },
      featured: {
        count: featuredCount,
        ratio: featuredRatio
      },
      verified: {
        count: verifiedCount,
        growth: verifiedGrowth
      }
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "حدث خطأ في الخادم أثناء جلب الإحصائيات." });
  }
});

// --- Recycle Bin System ---

router.get("/recycle-bin", async (req, res) => {
  try {
    const { type = "Ad", page = 1, limit = 20 } = req.query;
    const p = Math.max(1, parseInt(page));
    const l = Math.max(1, Math.min(100, parseInt(limit)));
    
    let items, total;

    if (type === "Conversation") {
      [items, total] = await Promise.all([
        Conversation.find({ isDeletedByAdmin: true })
          .populate("participants", "name avatar phone")
          .sort({ deletedByAdminAt: -1 })
          .skip((p - 1) * l)
          .limit(l)
          .lean(),
        Conversation.countDocuments({ isDeletedByAdmin: true })
      ]);
      // Standardize fields for frontend
      items = items.map(item => ({
        ...item,
        deletedAt: item.deletedByAdminAt,
        details: item.participants?.map(p => p.name).join(" & ") || "محادثة"
      }));
    } else if (type === "Support") {
      [items, total] = await Promise.all([
        SupportConversation.find({ deletedByAdmin: true })
          .populate("userId", "name avatar phone")
          .sort({ deletedByAdminAt: -1 })
          .skip((p - 1) * l)
          .limit(l)
          .lean(),
        SupportConversation.countDocuments({ deletedByAdmin: true })
      ]);
      items = items.map(item => ({
        ...item,
        deletedAt: item.deletedByAdminAt,
        details: `دعم: ${item.userId?.name || "مستخدم"}`
      }));
    } else {
      let model;
      switch (type) {
        case "Ad": model = Ad; break;
        case "Review": model = Review; break;
        case "AdReport": model = AdReport; break;
        case "VerificationRequest": model = VerificationRequest; break;
        default: return res.status(400).json({ error: "Invalid entity type" });
      }

      [items, total] = await Promise.all([
        model.find({ isDeleted: true })
          .sort({ deletedAt: -1 })
          .skip((p - 1) * l)
          .limit(l)
          .lean(),
        model.countDocuments({ isDeleted: true })
      ]);
    }

    res.json({ items, total, pages: Math.ceil(total / l) });
  } catch (error) {
    console.error("Recycle bin error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/permanent-delete/:entityType/:id", async (req, res) => {
  try {
    const { entityType, id } = req.params;
    let model;
    
    if (entityType === "Support") {
      const conv = await SupportConversation.findById(id);
      if (!conv) return res.status(404).json({ error: "Conversation not found" });
      await SupportMessage.deleteMany({ conversationId: conv._id });
      await SupportConversation.findByIdAndDelete(conv._id);
    } else {
      switch (entityType) {
        case "Ad": model = Ad; break;
        case "Conversation": model = Conversation; break;
        case "Review": model = Review; break;
        case "AdReport": model = AdReport; break;
        case "VerificationRequest": model = VerificationRequest; break;
        default: return res.status(400).json({ error: "Cannot delete this entity type" });
      }

      const item = await model.findById(id);
      if (!item) return res.status(404).json({ error: "Item not found" });

      if (entityType === "Conversation") {
        await ConversationMessage.deleteMany({ conversationId: item._id });
        await Conversation.findByIdAndDelete(item._id);
      } else {
        await model.findByIdAndDelete(id);
      }
    }

    await logActivity({
      action: `PERMANENT_DELETE_${entityType.toUpperCase()}`,
      entityType,
      entityId: id,
      performedBy: req.user.id,
      metadata: { deletedAt: new Date() },
      req
    });

    res.json({ ok: true, message: "تم الحذف النهائي بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/restore/:entityType/:id", async (req, res) => {
  try {
    const { entityType, id } = req.params;
    
    if (entityType === "Support") {
      const conv = await SupportConversation.findById(id);
      if (!conv) return res.status(404).json({ error: "Item not found" });
      conv.deletedByAdmin = false;
      conv.deletedByAdminAt = null;
      conv.deletedByAdminId = null;
      await conv.save();
    } else {
      let model;
      switch (entityType) {
        case "Ad": model = Ad; break;
        case "Conversation": model = Conversation; break;
        case "Review": model = Review; break;
        case "AdReport": model = AdReport; break;
        case "VerificationRequest": model = VerificationRequest; break;
        default: return res.status(400).json({ error: "Cannot restore this entity type" });
      }

      let query = { _id: id };
      if (entityType === "Conversation") {
        query.isDeletedByAdmin = true;
      } else {
        query.isDeleted = true;
      }

      const item = await model.findOne(query);
      if (!item) return res.status(404).json({ error: "Item not found or already restored" });

      if (entityType === "Conversation") {
        if (!item.isDeletedByAdmin) return res.status(400).json({ error: "Conversation is not in trash" });
        item.isDeletedByAdmin = false;
        item.deletedByAdminAt = null;
        item.deletedByAdminId = null;
      } else {
        item.isDeleted = false;
        item.deletedAt = null;
      }
      await item.save();
    }

    await logActivity({
      action: `RESTORE_${entityType.toUpperCase()}`,
      entityType,
      entityId: id,
      performedBy: req.user.id,
      metadata: { restoredAt: new Date() },
      req
    });

    res.json({ ok: true, message: "تمت استعادة العنصر بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// --- Activity Logs System ---

router.get("/activity-logs", async (req, res) => {
  try {
    const { action, performedBy, entityType, startDate, endDate, page = 1, limit = 20 } = req.query;
    const filter = {};
    
    if (action) filter.action = action;
    if (performedBy) filter.performedBy = performedBy;
    if (entityType) filter.entityType = entityType;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const p = parseInt(page);
    const l = parseInt(limit);

    const [items, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate("performedBy", "name role")
        .populate("targetUser", "name")
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      ActivityLog.countDocuments(filter)
    ]);

    res.json({ items, total, pages: Math.ceil(total / l) });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// --- System Health Monitoring ---

router.get("/system-health", async (req, res) => {
  try {
    let dbStats = { dataSize: 0, collections: 0, objects: 0 };
    try {
      if (mongoose.connection && mongoose.connection.db) {
        dbStats = await mongoose.connection.db.stats();
      }
    } catch (dbErr) {
      console.warn("Could not fetch DB stats:", dbErr.message);
    }

    const [
      adCount,
      deletedAdCount,
      archivedAdCount,
      userCount,
      msgCount,
      financialOpsCount,
      commissionCount
    ] = await Promise.all([
      Ad.countDocuments({ isDeleted: { $ne: true } }),
      Ad.countDocuments({ isDeleted: true }),
      Ad.countDocuments({ isArchived: true, isDeleted: { $ne: true } }),
      User.countDocuments(),
      Conversation.countDocuments({ isDeleted: { $ne: true } }),
      Transaction.countDocuments({ isDeleted: { $ne: true } }),
      Commission.countDocuments({ isDeleted: { $ne: true } })
    ]);

    res.json({
      database: {
        size: dbStats.dataSize ? (dbStats.dataSize / (1024 * 1024)).toFixed(2) + " MB" : "N/A",
        collections: dbStats.collections || 0,
        objects: dbStats.objects || 0
      },
      counts: {
        ads: adCount,
        deletedAds: deletedAdCount,
        archivedAds: archivedAdCount,
        users: userCount,
        conversations: msgCount,
        financialOperations: financialOpsCount,
        commissions: commissionCount
      },
      timestamp: new Date()
    });
  } catch (error) {
    console.error("System health error:", error);
    res.status(500).json({ error: "Failed to fetch system health" });
  }
});

router.get("/financial-stats", async (req, res) => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      commissions,
      pendingWithdrawals,
      monthlyTransactions
    ] = await Promise.all([
      Commission.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { 
          $group: { 
            _id: "$status", 
            total: { $sum: "$commissionAmount" },
            count: { $sum: 1 }
          } 
        }
      ]),
      Withdrawal.countDocuments({ status: "pending", isDeleted: { $ne: true } }),
      Transaction.aggregate([
        { 
          $match: { 
            createdAt: { $gte: firstDayOfMonth },
            type: { $in: ["FEE", "WITHDRAW_FEE"] },
            isDeleted: { $ne: true }
          } 
        },
        { $group: { _id: null, totalProfit: { $sum: "$amount" } } }
      ])
    ]);

    // Format commission stats
    const commStats = {
      total: 0,
      paid: 0,
      unpaid: 0,
      overdue: 0,
      pending_review: 0
    };

    commissions.forEach(c => {
      commStats.total += c.total;
      if (c._id === "paid") commStats.paid = c.total;
      if (c._id === "unpaid") commStats.unpaid = c.total;
      if (c._id === "overdue") commStats.overdue = c.total;
      if (c._id === "pending_review") commStats.pending_review = c.total;
    });

    res.json({
      commissions: commStats,
      pendingWithdrawals,
      monthlyProfits: monthlyTransactions[0]?.totalProfit || 0,
      timestamp: now
    });
  } catch (error) {
    console.error("Financial stats error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/audit-logs",
  validateQuery(
    Joi.object({
      adminId: Joi.string().length(24).hex().optional(),
      method: Joi.string().valid("POST", "PUT", "PATCH", "DELETE").optional(),
      route: Joi.string().trim().max(200).optional(),
      from: Joi.date().iso().optional(),
      to: Joi.date().iso().optional(),
      page: Joi.number().min(1).default(1),
      limit: Joi.number().min(1).max(100).default(20)
    })
  ),
  async (req, res) => {
    try {
      const { adminId, method, route, from, to, page, limit } = req.query;
      const filter = {};
      if (adminId) filter.adminId = adminId;
      if (method) filter.method = method;
      if (route) filter.route = { $regex: String(route), $options: "i" };
      if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
      }
      const p = Math.max(parseInt(page, 10) || 1, 1);
      const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const [items, total] = await Promise.all([
        AdminAuditLog.find(filter)
          .populate("adminId", "name email")
          .sort({ createdAt: -1 })
          .skip((p - 1) * l)
          .limit(l)
          .lean(),
        AdminAuditLog.countDocuments(filter)
      ]);
      res.json({ items, page: p, limit: l, total, pages: Math.ceil(total / l) });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  }
);

router.get("/products", async (req, res) => {
  try {
    const { status, sellerId, cityId, q } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (sellerId) filter.userId = sellerId;
    if (cityId) filter.cityId = cityId;
    if (q) filter.title = { $regex: String(q), $options: "i" };
    const products = await Ad.find(filter)
      .populate({ path: "userId", select: "name email" })
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .sort({ createdAt: -1 })
      .lean();
    res.json(products);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/products/bulk-status", async (req, res) => {
  try {
    const { ids, status } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "IDs required" });
    if (!["approved", "rejected", "pending"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const result = await Ad.updateMany({ _id: { $in: ids } }, { $set: { status } });
    res.json({ ok: true, matched: result.matchedCount || result.n, modified: result.modifiedCount || result.nModified });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/products/:id/history", async (req, res) => {
  try {
    const logs = await AdminAuditLog.find({ route: { $regex: new RegExp(`${req.params.id}`) } })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(logs);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/products/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: "Not found" });
    ad.status = status;
    if (status === "approved") {
      const now = new Date();
      ad.publishedAt = now;
      ad.expiresAt = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000);
      ad.expireReminderSent = false;
    }
    await ad.save();
    const updated = ad.toObject();
    if (updated.userId && status !== "pending") {
      try {
        const statusTranslations = {
          approved: "مقبول",
          rejected: "مرفوض",
          expired: "منتهي",
          sold: "مباع"
        };
        const statusArabic = statusTranslations[status] || status;
        await createNotification(req.app, {
          userId: updated.userId,
          type: "ad_status",
          title: "تحديث حالة إعلانك",
          body: `${updated.title} • ${statusArabic}`,
          data: { adId: updated._id, status }
        });
      } catch {}
    }
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const ad = await Ad.findByIdAndDelete(req.params.id).lean();
    if (!ad) return res.status(404).json({ error: "Not found" });
    const uploadDir = path.join(process.cwd(), "uploads");
    (ad.images || []).forEach((filename) => {
      const filePath = path.join(uploadDir, filename);
      fs.promises
        .unlink(filePath)
        .catch(() => {});
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/users", async (req, res) => {
  try {
    const { q, role, disabled, deleted, sort = "createdAt", order = "desc" } = req.query || {};
    const filter = {
      phoneTrialStatus: { $ne: "Rejected" } // Hide rejected phone users from main list
    };
    if (role) filter.role = role;
    if (typeof disabled !== "undefined" && disabled !== "") filter.isDisabled = disabled === "true";
    if (typeof deleted !== "undefined" && deleted !== "") filter.isDeleted = deleted === "true";
    if (q) {
      const regex = new RegExp(String(q), "i");
      filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
    }
    const sortSpec = { [sort]: order === "asc" ? 1 : -1 };
    const users = await User.find(filter)
      .select("name email phone phoneTrial phoneTrialStatus role createdAt isDisabled")
      .sort(sortSpec)
      .lean();
    const mapped = users.map((u) => {
      const byPhone = !!(u.phoneTrial || (u.email && /@trial\.local$/i.test(u.email)));
      return {
        ...u,
        phoneDisplay: byPhone ? (u.phone || "—") : "—",
        emailDisplay: byPhone ? "—" : (u.email || "—"),
      };
    });
    res.json(mapped);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body || {};
    if (!["admin", "user"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    const updated = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("name email role isDisabled").lean();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/users/:id/disable", async (req, res) => {
  try {
    const { disabled } = req.body || {};
    const updated = await User.findByIdAndUpdate(req.params.id, { isDisabled: !!disabled }, { new: true }).select("name email role isDisabled").lean();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    console.log(`[DEBUG] Attempting to delete user with ID: ${req.params.id}`);
    const u = await User.findByIdAndDelete(req.params.id).lean();
    if (!u) {
      console.log(`[DEBUG] User with ID ${req.params.id} not found.`);
      return res.status(404).json({ error: "Not found" });
    }
    console.log(`[DEBUG] Successfully deleted user with ID: ${req.params.id}`);
    res.json({ ok: true });
  } catch (error) {
    console.error(`[DEBUG] Error deleting user with ID: ${req.params.id}`, error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/stats/devices/reset", async (req, res) => {
  try {
    await User.updateMany({}, { 
      $set: { 
        "devices.android": 0, 
        "devices.ios": 0, 
        "devices.windows": 0, 
        "devices.macos": 0 
      } 
    });
    res.json({ message: "تم تصفير إحصائيات الأجهزة بنجاح" });
  } catch (error) {
    console.error("Reset device stats error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/stats/devices", async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          android: { $sum: { $cond: [{ $gt: ["$devices.android", 0] }, 1, 0] } },
          ios: { $sum: { $cond: [{ $gt: ["$devices.ios", 0] }, 1, 0] } },
          windows: { $sum: { $cond: [{ $gt: ["$devices.windows", 0] }, 1, 0] } },
          macos: { $sum: { $cond: [{ $gt: ["$devices.macos", 0] }, 1, 0] } }
        }
      }
    ]);

    const result = stats[0] || { android: 0, ios: 0, windows: 0, macos: 0 };
    delete result._id;
    res.json(result);
  } catch (error) {
    console.error("Device stats error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/stats/overview", async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 6); // last 7 days
    start.setHours(0, 0, 0, 0);
    const dayBuckets = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const end = new Date(d);
      end.setDate(d.getDate() + 1);
      dayBuckets.push([d, end]);
    }
    const newAdsSeries = await Promise.all(
      dayBuckets.map(([d, e]) => Ad.countDocuments({ createdAt: { $gte: d, $lt: e } }))
    );
    const AdReport = (await import("../models/AdReport.js")).default;
    const newReportsSeries = await Promise.all(
      dayBuckets.map(([d, e]) => AdReport.countDocuments({ createdAt: { $gte: d, $lt: e } }))
    );
    const ConversationMessage = (await import("../models/ConversationMessage.js")).default;
    const activeUsersSeries = await Promise.all(
      dayBuckets.map(async ([d, e]) => {
        const [adsUsers, msgUsers] = await Promise.all([
          Ad.distinct("userId", { createdAt: { $gte: d, $lt: e } }),
          ConversationMessage.distinct("senderId", { createdAt: { $gte: d, $lt: e } })
        ]);
        const set = new Set([...adsUsers.map(String), ...msgUsers.map(String)]);
        return set.size;
      })
    );
    const todayIdx = 6;
    const daily = {
      newAds: newAdsSeries[todayIdx],
      newReports: newReportsSeries[todayIdx],
      activeUsers: activeUsersSeries[todayIdx]
    };
    // last 7 days stats (no categories)
    const top = [];
    const topCategories = [];
    res.json({
      daily,
      weeklySeries: {
        dates: dayBuckets.map(([d]) => d.toISOString()),
        newAds: newAdsSeries,
        newReports: newReportsSeries,
        activeUsers: activeUsersSeries
      },
      topCategories
    });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/commissions", async (req, res) => {
  try {
    const { includeDeleted } = req.query || {};
    const filter = {};
    if (includeDeleted !== "true") {
      filter.isDeleted = { $ne: true };
    }
    const items = await Commission.find(filter)
      .populate("sellerId", "name phone email")
      .populate("adId", "title")
      .sort({ createdAt: -1 })
      .lean();
    res.json(items);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/commissions/:id/status", async (req, res) => {
  try {
    const { status, reason } = req.body;
    const commission = await Commission.findById(req.params.id);
    if (!commission) return res.status(404).json({ error: "Commission not found" });

    commission.status = status;
    if (status === "paid") {
      commission.paidAt = new Date();
      commission.commissionStatus = "approved";
      
      // Cleanup: if this was for a specific ad, find and delete any other 
      // unpaid/overdue/Pending records for the SAME ad to prevent duplicates in seller's view
      if (commission.adId) {
        await Commission.deleteMany({
          _id: { $ne: commission._id },
          adId: commission.adId,
          status: { $in: ["unpaid", "overdue", "Pending", "Rejected"] }
        });
      }
    } else if (status === "Rejected") {
      commission.rejectReason = reason;
      commission.commissionStatus = "rejected";
    }
    await commission.save();

    // Send notification to seller
    const title = status === "paid" ? "تم قبول عمولة الموقع" : "تم رفض عمولة الموقع";
    const body = status === "paid" 
      ? `تم قبول سداد العمولة بمبلغ ${commission.commissionAmount} ${commission.currency} بنجاح.` 
      : `تم رفض سداد العمولة. السبب: ${reason || "غير محدد"}`;

    await createNotification(req.app, {
      userId: commission.sellerId,
      type: status === "paid" ? "purchase_approved" : "purchase_rejected",
      title,
      body,
      data: { commissionId: commission._id, status, reason }
    });

    res.json(commission);
  } catch (error) {
    console.error("Update commission status error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/commissions/:id/remind", async (req, res) => {
  try {
    const commission = await Commission.findById(req.params.id);
    if (!commission) return res.status(404).json({ error: "Commission not found" });

    await Notification.create({
      userId: commission.sellerId,
      type: "commission_reminder",
      title: "تذكير بدفع عمولة الموقع",
      body: `يرجى سداد عمولة الموقع للإعلان المباع بقيمة ${commission.commissionAmount} ${commission.currency} لتجنب تعليق الحساب.`,
      data: { commissionId: commission._id }
    });

    res.json({ ok: true, message: "تم إرسال التذكير بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/sold-listings", async (req, res) => {
  try {
    const { status, isDeleted, page = 1, limit = 20 } = req.query || {};
    const filter = {};
    
    if (status) filter.commissionStatus = status;
    if (isDeleted === "true") filter.isOriginalAdDeleted = true;
    else if (isDeleted === "false") filter.isOriginalAdDeleted = false;

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const [items, total] = await Promise.all([
      SoldListing.find(filter)
        .populate("sellerId", "name phone email")
        .populate("buyerId", "name")
        .populate("adId", "isDeleted deletedAt")
        .sort({ soldAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      SoldListing.countDocuments(filter)
    ]);

    // Calculate delay duration for each item
    const enrichedItems = items.map(item => {
      const soldDate = new Date(item.soldAt);
      const now = new Date();
      const delayDays = Math.floor((now - soldDate) / (1000 * 60 * 60 * 24));
      return { ...item, delayDays };
    });

    res.json({ items: enrichedItems, page: p, limit: l, total, pages: Math.ceil(total / l) });
  } catch (error) {
    console.error("Get sold listings error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/sold-listings/:id/remind", async (req, res) => {
  try {
    const soldListing = await SoldListing.findById(req.params.id);
    if (!soldListing) return res.status(404).json({ error: "Sold listing not found" });

    await createNotification(req.app, {
      userId: soldListing.sellerId,
      type: "commission_reminder",
      title: "تذكير بمتابعة عمولة الإعلان المباع",
      body: `نود تذكيركم بسداد عمولة الإعلان "${soldListing.title}" المباع بتاريخ ${new Date(soldListing.soldAt).toLocaleDateString("ar-EG")}. سدادكم للعمولة يدعم استمرارية المنصة.`,
      data: { soldListingId: soldListing._id, adId: soldListing.adId }
    });

    soldListing.lastReminderSentAt = new Date();
    soldListing.reminderCount = (soldListing.reminderCount || 0) + 1;
    await soldListing.save();

    res.json({ ok: true, message: "تم إرسال التذكير بنجاح" });
  } catch (error) {
    console.error("Remind sold listing error:", error);
    res.status(500).json({ error: "Server error" });
  }
});
router.get("/identities", async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { role: "seller" };
    if (status) filter.identityStatus = status;
    const sellers = await User.find(filter).select("name email phone idDocument isIdentityVerified identityStatus").sort({ createdAt: -1 }).lean();
    res.json(sellers);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/identities/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Approved", "Rejected", "Pending"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const isIdentityVerified = status === "Approved";
    const updated = await User.findByIdAndUpdate(req.params.id, { identityStatus: status, isIdentityVerified }, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Get Deleted Ads for Admin
router.get("/deleted-ads", async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query || {};
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const [items, total] = await Promise.all([
      Ad.find({ isDeleted: true })
        .populate("userId", "name email phone")
        .populate("governorateId", "name")
        .populate("cityId", "name")
        .sort({ deletedAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      Ad.countDocuments({ isDeleted: true })
    ]);

    // Fetch commission status for each ad
    const enrichedItems = await Promise.all(items.map(async (ad) => {
      const commission = await Commission.findOne({ adId: ad._id }).select("status").lean();
      return {
        ...ad,
        commissionStatus: commission ? commission.status : "unpaid"
      };
    }));

    res.json({
      items: enrichedItems,
      total,
      page: p,
      limit: l,
      pages: Math.ceil(total / l)
    });
  } catch (error) {
    console.error("Get deleted ads error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get Archived Ads for Admin
router.get("/archived-ads", async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query || {};
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const [items, total] = await Promise.all([
      Ad.find({ isArchived: true, isDeleted: { $ne: true } })
        .populate("userId", "name email phone")
        .populate("governorateId", "name")
        .populate("cityId", "name")
        .sort({ updatedAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      Ad.countDocuments({ isArchived: true, isDeleted: { $ne: true } })
    ]);

    res.json({
      items,
      total,
      page: p,
      limit: l,
      pages: Math.ceil(total / l)
    });
  } catch (error) {
    console.error("Get archived ads error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/purchase-requests", async (req, res) => {
  try {
    const prs = await PurchaseRequest.find()
      .populate("user", "name email isVerifiedSeller verified verifiedAt verificationExpiresAt")
      .populate("plan", "name type durationInDays price")
      .populate("product", "title featured featuredUntil featuredAt featuredExpiresAt")
      .sort({ createdAt: -1 })
      .lean();
    const enriched = prs.map((r) => {
      const base = { ...r };
      if (r.plan?.type === "verification") {
        base.verification = {
          verifiedAt: r.user?.verifiedAt || null,
          verified: !!r.user?.verified,
          verificationExpiresAt: r.user?.verificationExpiresAt || null
        };
      } else if (r.plan?.type === "featured" && r.product) {
        // Fallbacks when product doesn't yet have dates (legacy records)
        const featuredAt = r.product?.featuredAt || (r.status === "Approved" ? r.updatedAt : null);
        let featuredExpiresAt = r.product?.featuredExpiresAt || r.product?.featuredUntil || null;
        if (!featuredExpiresAt && featuredAt && r.plan?.durationInDays) {
          featuredExpiresAt = new Date(new Date(featuredAt).getTime() + r.plan.durationInDays * 24 * 60 * 60 * 1000);
        }
        base.featured = {
          featuredAt,
          featuredExpiresAt,
          featured: !!r.product?.featured
        };
      }
      return base;
    });
    res.json(enriched);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/reports", async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query || {};
    const filter = {};
    if (status) filter.status = status;
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const [list, total] = await Promise.all([
      AdReport.find(filter)
        .populate({
          path: "adId",
          select: "title userId",
          populate: { path: "userId", select: "name email" }
        })
        .populate("reporterId", "name email")
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      AdReport.countDocuments(filter)
    ]);
    res.json({ items: list, page: p, limit: l, total, pages: Math.ceil(total / l) });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/reports/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["open", "reviewed", "dismissed"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const updated = await AdReport.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/reports/:id", async (req, res) => {
  try {
    const r = await AdReport.findByIdAndDelete(req.params.id).lean();
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/seller-reports", async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query || {};
    const filter = {};
    if (status) filter.status = status;
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const [list, total] = await Promise.all([
      SellerReport.find(filter)
        .populate("sellerId", "name email")
        .populate("reporterId", "name email")
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      SellerReport.countDocuments(filter)
    ]);
    res.json({ items: list, page: p, limit: l, total, pages: Math.ceil(total / l) });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/seller-reports/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["open", "reviewed", "dismissed"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const updated = await SellerReport.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Admin Notifications Routes
router.get("/notifications", async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const p = Math.max(1, parseInt(page));
    const l = Math.max(1, Math.min(100, parseInt(limit)));

    const [items, total] = await Promise.all([
      AdminNotification.find()
        .sort({ createdAt: -1 })
        .skip((p - 1) * l)
        .limit(l)
        .lean(),
      AdminNotification.countDocuments()
    ]);

    res.json({
      items,
      total,
      page: p,
      limit: l,
      pages: Math.ceil(total / l)
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/notifications", async (req, res) => {
  try {
    await AdminNotification.deleteMany({});
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/notifications/:id", async (req, res) => {
  try {
    const n = await AdminNotification.findByIdAndDelete(req.params.id).lean();
    if (!n) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/notifications/unread-count", async (req, res) => {
  try {
    const count = await AdminNotification.countDocuments({ isRead: false });
    res.json({ count });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/notifications/:id/read", async (req, res) => {
  try {
    const updated = await AdminNotification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/notifications/read-all", async (req, res) => {
  try {
    await AdminNotification.updateMany({ isRead: false }, { isRead: true });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/seller-reports/:id", async (req, res) => {
  try {
    const r = await SellerReport.findByIdAndDelete(req.params.id).lean();
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/phone-users", async (req, res) => {
  try {
    console.log("Admin hit: /phone-users request received");
    const { q } = req.query || {};
    // Show users who are in "Pending" status for phone verification
    // OR users who have a phone but no status yet (legacy support)
    // We also include Approved/Rejected but the UI will filter or show status
    const filter = { 
      phone: { $exists: true, $ne: "" }
    };
    if (q) {
      const rx = new RegExp(String(q), "i");
      filter.$or = [{ name: rx }, { phone: rx }];
    }
    console.log("Filter used:", JSON.stringify(filter));
    const users = await User.find(filter).select("_id name phone role phoneTrialStatus createdAt").sort({ createdAt: -1 }).lean();
    console.log("Found users:", users.length);
    res.json(users);
  } catch (err) {
    console.error("Admin phone users fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/phone-users/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    console.log(`Admin status update request for user ${req.params.id} with status: ${status}`);
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    
    if (status === "rejected") {
      // Set status to Rejected and DISABLE the account so they appear as disabled and can't login
      const updated = await User.findByIdAndUpdate(req.params.id, { 
        phoneTrialStatus: "Rejected",
        isDisabled: true 
      }, { new: true });
      if (!updated) return res.status(404).json({ error: "User not found" });
      return res.json({ ok: true, message: "User status updated to Rejected and Disabled" });
    }

    const update = { phoneTrial: true, phoneTrialStatus: "Approved", isDisabled: false };
    const updated = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select("name phone role phoneTrial phoneTrialStatus").lean();
    console.log("User approval result:", updated ? "Approved" : "Not Found");
    if (!updated) return res.status(404).json({ error: "User not found for approval" });
    res.json(updated);
  } catch (err) {
    console.error("Admin phone status update error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Reset System API
router.post("/reset-system", async (req, res) => {
  const { confirmCode } = req.body;
  if (confirmCode !== "RESET") {
    return res.status(400).json({ error: "رمز التأكيد غير صحيح" });
  }

  try {
    console.log("Starting System Reset...");

    // 1. Delete Users (except admins)
    const usersRes = await User.deleteMany({ role: { $ne: "admin" } });
    console.log(`- Deleted ${usersRes.deletedCount} users (non-admins)`);

    // 2. Delete Ads and related
    const adsRes = await Ad.deleteMany({});
    console.log(`- Deleted ${adsRes.deletedCount} ads`);
    
    const adAttrRes = await (await import("../models/AdAttributeValue.js")).default.deleteMany({});
    console.log(`- Deleted ${adAttrRes.deletedCount} ad attribute values`);
    
    const adViewRes = await (await import("../models/AdView.js")).default.deleteMany({});
    console.log(`- Deleted ${adViewRes.deletedCount} ad views`);

    // 3. Delete Conversations and Messages
    const convRes = await (await import("../models/Conversation.js")).default.deleteMany({});
    console.log(`- Deleted ${convRes.deletedCount} conversations`);
    
    const msgRes = await (await import("../models/ConversationMessage.js")).default.deleteMany({});
    console.log(`- Deleted ${msgRes.deletedCount} messages`);

    // 4. Delete Reports
    const adReportsRes = await AdReport.deleteMany({});
    console.log(`- Deleted ${adReportsRes.deletedCount} ad reports`);
    
    const sellerReportsRes = await SellerReport.deleteMany({});
    console.log(`- Deleted ${sellerReportsRes.deletedCount} seller reports`);

    // 5. Delete Verification and Featured Requests
    const verRes = await (await import("../models/VerificationRequest.js")).default.deleteMany({});
    console.log(`- Deleted ${verRes.deletedCount} verification requests`);
    
    const purchaseRes = await PurchaseRequest.deleteMany({});
    console.log(`- Deleted ${purchaseRes.deletedCount} purchase requests`);

    // 6. Delete Commissions and Escrow Data
    const commRes = await Commission.deleteMany({});
    console.log(`- Deleted ${commRes.deletedCount} commissions`);

    const orderRes = await Order.deleteMany({});
    console.log(`- Deleted ${orderRes.deletedCount} orders`);

    const walletRes = await Wallet.deleteMany({});
    console.log(`- Deleted ${walletRes.deletedCount} wallets`);

    const transRes = await Transaction.deleteMany({});
    console.log(`- Deleted ${transRes.deletedCount} transactions`);

    const withRes = await Withdrawal.deleteMany({});
    console.log(`- Deleted ${withRes.deletedCount} withdrawals`);

    const disputeRes = await Dispute.deleteMany({});
    console.log(`- Deleted ${disputeRes.deletedCount} disputes`);

    // 7. Delete Notifications
    const notifRes = await Notification.deleteMany({});
    console.log(`- Deleted ${notifRes.deletedCount} user notifications`);
    
    const adminNotifRes = await AdminNotification.deleteMany({});
    console.log(`- Deleted ${adminNotifRes.deletedCount} admin notifications`);

    // 8. Delete Other leftovers
    const favRes = await (await import("../models/Favorite.js")).default.deleteMany({});
    console.log(`- Deleted ${favRes.deletedCount} favorites`);
    
    const followRes = await (await import("../models/Follow.js")).default.deleteMany({});
    console.log(`- Deleted ${followRes.deletedCount} follows`);

    const commentRes = await (await import("../models/Comment.js")).default.deleteMany({});
    console.log(`- Deleted ${commentRes.deletedCount} comments`);

    // 9. Delete Admin Audit Logs
    const auditRes = await AdminAuditLog.deleteMany({});
    console.log(`- Deleted ${auditRes.deletedCount} admin audit logs`);

    console.log("System Reset Completed Successfully.");
    res.json({ ok: true, message: "تمت إعادة تهيئة الموقع بنجاح" });
  } catch (error) {
    console.error("System Reset Failed:", error);
    res.status(500).json({ error: "فشلت عملية إعادة التهيئة" });
  }
});

export default router;
