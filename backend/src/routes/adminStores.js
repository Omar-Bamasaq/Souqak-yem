import { Router } from "express";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import adminAudit from "../middleware/adminAudit.js";
import { requireRole } from "../middleware/roles.js";
import StoreProfile from "../models/StoreProfile.js";
import StoreSubscription from "../models/StoreSubscription.js";
import PurchaseRequest from "../models/PurchaseRequest.js";
import Plan from "../models/Plan.js";
import User from "../models/User.js";
import { createNotification } from "../services/notificationService.js";

const router = Router();
router.use(auth, requireRole(["admin"]), adminAudit());

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.q || "").trim();
    const storeStatus = String(req.query.status || "").trim();
    const subscriptionStatus = String(req.query.subscriptionStatus || "").trim();
    const storeType = String(req.query.storeType || "").trim();

    const validStoreStatuses = ["pending", "active", "suspended", "rejected", "inactive"];
    const validSubscriptionStatuses = ["pending", "active", "expired", "rejected", "cancelled", "inactive"];

    const storeFilter = {};
    if (validStoreStatuses.includes(storeStatus)) storeFilter.status = storeStatus;
    if (storeType === "family-production") storeFilter.storeType = "family-production";
    if (storeType === "store") {
      storeFilter.$or = [{ storeType: "store" }, { storeType: { $exists: false } }];
    }

    let stores = await StoreProfile.find(storeFilter)
      .populate("userId", "name email phone")
      .populate("selectedCategories", "name slug")
      .sort({ updatedAt: -1 })
      .lean();

    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      stores = stores.filter((store) => {
        const owner = store.userId || {};
        return regex.test(String(store.storeName || "")) || regex.test(String(owner.name || "")) || regex.test(String(owner.email || ""));
      });
    }

    const rows = await Promise.all(stores.map(async (store) => {
      const subscription = await StoreSubscription.findOne({ storeId: store._id })
        .populate("planId", "name type durationInDays price currency limits")
        .sort({ createdAt: -1 })
        .lean();

      const computedSubscriptionStatus = subscription ? StoreSubscription.getStoreSubscriptionStatus(subscription) : "inactive";

      return {
        ...store,
        owner: store.userId || null,
        subscription: subscription ? { ...subscription, plan: subscription.planId || null } : null,
        subscriptionStatus: computedSubscriptionStatus,
        plan: subscription?.planId || null,
        startDate: subscription?.startDate || null,
        endDate: subscription?.endDate || null
      };
    }));

    const filteredRows = rows.filter((store) => {
      const matchesSubscription = !subscriptionStatus || subscriptionStatus === store.subscriptionStatus;
      return matchesSubscription;
    });

    const total = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const paginatedRows = filteredRows.slice(skip, skip + limit);

    res.json({
      stores: paginatedRows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error("Admin store directory error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/:storeId/history", async (req, res) => {
  try {
    const { storeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(404).json({ error: "Store profile not found" });
    }

    const store = await StoreProfile.findById(storeId)
      .populate("userId", "name email phone")
      .lean();

    if (!store) {
      return res.status(404).json({ error: "Store profile not found" });
    }

    const [subscriptions, requests] = await Promise.all([
      StoreSubscription.find({ storeId: store._id })
        .populate("planId", "name type durationInDays price currency")
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .lean(),
      PurchaseRequest.find({ storeProfile: store._id })
        .populate("plan", "name type durationInDays price currency")
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .lean()
    ]);

    const requestMap = new Map();
    const uniqueRequests = [];
    for (const request of requests) {
      const key = String(request._id);
      if (requestMap.has(key)) continue;
      requestMap.set(key, request);
      uniqueRequests.push(request);
    }

    const subscriptionHistory = subscriptions.map((subscription) => {
      const request = subscription.purchaseRequestId ? requestMap.get(String(subscription.purchaseRequestId)) || null : null;
      return {
        _id: subscription._id,
        status: StoreSubscription.getStoreSubscriptionStatus(subscription),
        storeStatus: subscription.status || "pending",
        plan: subscription.planId || null,
        price: subscription.price ?? null,
        currency: subscription.currency || null,
        duration: subscription.duration ?? null,
        startDate: subscription.startDate || null,
        endDate: subscription.endDate || null,
        createdAt: subscription.createdAt || null,
        purchaseRequestId: subscription.purchaseRequestId || null,
        request: request ? {
          _id: request._id,
          status: request.status,
          createdAt: request.createdAt || null,
          price: request.price ?? null,
          currency: request.currency || null,
          duration: request.duration ?? null,
          plan: request.plan || null
        } : null
      };
    });

    const requestHistory = uniqueRequests.map((request) => ({
      _id: request._id,
      status: request.status,
      createdAt: request.createdAt || null,
      plan: request.plan || null,
      price: request.price ?? null,
      currency: request.currency || null,
      duration: request.duration ?? null,
      storeName: request.storeName || null,
      businessActivity: request.businessActivity || null,
      user: request.user || null
    }));

    res.json({
      store: {
        _id: store._id,
        storeName: store.storeName,
        storeType: store.storeType || "store",
        deliveryAvailable: !!store.deliveryAvailable,
        status: store.status,
        businessActivity: store.businessActivity,
        owner: store.userId || null
      },
      subscriptions: subscriptionHistory,
      requests: requestHistory,
      hasSubscriptions: subscriptionHistory.length > 0,
      hasRequests: requestHistory.length > 0
    });
  } catch (error) {
    console.error("Admin store history error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/requests", async (req, res) => {
  try {
    const requests = await PurchaseRequest.find({ status: "Pending", storeProfile: { $exists: true, $ne: null } })
      .populate("plan", "name type durationInDays price currency limits features")
      .populate("user", "name email")
      .populate("storeProfile", "storeName storeType businessActivity selectedCategories status deliveryAvailable phone phones whatsapp location governorateId cityId customCityName lat lng")
      .populate("storeProfile.governorateId", "name")
      .populate("storeProfile.cityId", "name")
      .sort({ createdAt: -1 })
      .lean();
    res.json(requests);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/requests/:id", async (req, res) => {
  try {
    const request = await PurchaseRequest.findById(req.params.id)
      .populate("plan", "name type durationInDays price currency limits features")
      .populate("user", "name email")
      .populate("storeProfile", "storeName storeType businessActivity selectedCategories description location phone phones whatsapp email status deliveryAvailable governorateId cityId customCityName lat lng")
      .populate("storeProfile.governorateId", "name")
      .populate("storeProfile.cityId", "name")
      .lean();
    if (!request) return res.status(404).json({ error: "Not found" });
    res.json(request);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/requests/:id/approve", async (req, res) => {
  try {
    const request = await PurchaseRequest.findById(req.params.id).populate("plan").populate("storeProfile").lean();
    if (!request) return res.status(404).json({ error: "Not found" });
    if (request.status === "Approved") {
      const existingSubscription = await StoreSubscription.findOne({ purchaseRequestId: request._id }).lean();
      if (existingSubscription) return res.json({ ok: true, subscription: existingSubscription, alreadyApproved: true });
    }
    if (request.status !== "Pending") return res.status(400).json({ error: "Request is no longer pending" });

    const latestSubscription = await StoreSubscription.findOne({ storeId: request.storeProfile?._id }).sort({ createdAt: -1 }).lean();
    const activeSubscription = latestSubscription?.status === "active"
      ? latestSubscription
      : await StoreSubscription.findOne({ storeId: request.storeProfile?._id, status: "active" }).lean();
    const currentSubscription = activeSubscription || latestSubscription;
    const latestStatus = currentSubscription ? StoreSubscription.getStoreSubscriptionStatus(currentSubscription) : "inactive";
    const isRenewal = !!currentSubscription && ["active", "expired"].includes(latestStatus);

    if (!isRenewal) {
      const existingStoreStatus = latestStatus;
      if (existingStoreStatus === "active") return res.status(409).json({ error: "This store already has an active subscription" });

      const existingActive = await StoreSubscription.findOne({ storeId: request.storeProfile?._id, status: "active" }).lean();
      if (existingActive) return res.status(409).json({ error: "This store already has an active subscription" });
    }

    if (!isRenewal) {
      const duplicateSubscription = await StoreSubscription.findOne({
        storeId: request.storeProfile?._id,
        status: { $in: ["active", "pending"] }
      }).lean();
      if (duplicateSubscription) return res.status(409).json({ error: "Duplicate store subscription is blocked" });
    }

    const plan = request.plan;
    const expectedPlanType = request.storeProfile?.storeType === "family-production" ? "family-production" : "store";
    if (!plan || !plan.isActive || plan.type !== expectedPlanType) {
      return res.status(400).json({ error: "Plan is invalid for this project type or inactive" });
    }
    const requestPrice = Number(request.price ?? plan.price ?? 0);
    const paymentReceipt = typeof request.paymentReceipt === "string" ? request.paymentReceipt.trim() : "";
    if (requestPrice > 0 && !paymentReceipt) {
      return res.status(400).json({ error: "Payment receipt is required for paid store plans" });
    }

    const startDate = isRenewal && latestStatus === "active" && currentSubscription?.endDate
      ? new Date(currentSubscription.endDate)
      : new Date();
    const endDate = new Date(startDate.getTime() + Number(plan.durationInDays || 0) * 24 * 60 * 60 * 1000);

    const existingRequestSubscription = await StoreSubscription.findOne({ purchaseRequestId: request._id }).lean();
    if (existingRequestSubscription) {
      if (existingRequestSubscription.status !== "active") {
        return res.status(409).json({ error: "A subscription already exists for this request and needs review" });
      }

      await StoreProfile.findByIdAndUpdate(request.storeProfile?._id, {
        status: "active",
        approvedAt: existingRequestSubscription.approvedAt || new Date(),
        approvedBy: existingRequestSubscription.approvedBy || req.user.id
      });
      await PurchaseRequest.findByIdAndUpdate(request._id, { status: "Approved" });
      return res.status(200).json({ ok: true, subscription: existingRequestSubscription, renewal: isRenewal, recovered: true });
    }

    if (activeSubscription) {
      await StoreSubscription.findByIdAndUpdate(activeSubscription._id, {
        status: "expired"
      });
    }

    let subscription;
    try {
      subscription = await StoreSubscription.create({
        storeId: request.storeProfile?._id,
        userId: request.user,
        planId: plan._id,
        purchaseRequestId: request._id,
        status: "active",
        price: Number(request.price || plan.price || 0),
        currency: request.currency || plan.currency || "YER_ADEN",
        duration: Number(request.duration ?? plan.durationInDays ?? 0),
        startDate,
        endDate,
        approvedAt: new Date(),
        approvedBy: req.user.id
      });
    } catch (error) {
      if (activeSubscription) {
        try {
          await StoreSubscription.findByIdAndUpdate(activeSubscription._id, { status: "active" });
        } catch (restoreError) {
          console.error("Store renewal subscription restore error:", restoreError);
        }
      }
      throw error;
    }

    await StoreProfile.findByIdAndUpdate(request.storeProfile?._id, {
      status: "active",
      approvedAt: new Date(),
      approvedBy: req.user.id
    });

    await PurchaseRequest.findByIdAndUpdate(request._id, {
      status: "Approved"
    });

    await createNotification(req.app, {
      userId: request.user,
      type: "store_subscription",
      title: "تمت الموافقة على متجرك",
      body: isRenewal ? "تمت الموافقة على تجديد اشتراك متجرك وبات نشطاً مرة أخرى." : "تمت الموافقة على طلب إنشاء متجرك وبات نشطاً الآن.",
      data: {
        storeId: request.storeProfile?._id,
        subscriptionId: subscription._id,
        renewal: isRenewal,
        storeType: request.storeProfile?.storeType || "store"
      }
    });

    res.status(200).json({ ok: true, subscription, renewal: isRenewal });
  } catch (error) {
    console.error("Store approve error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/requests/:id/reject", async (req, res) => {
  try {
    const { rejectionReason } = req.body || {};
    const request = await PurchaseRequest.findById(req.params.id).populate("storeProfile", "storeType").lean();
    if (!request) return res.status(404).json({ error: "Not found" });
    if (request.status !== "Pending") return res.status(400).json({ error: "Request is no longer pending" });

    const storeProfileId = request.storeProfile?._id || request.storeProfile || null;
    const latestSubscription = storeProfileId
      ? await StoreSubscription.findOne({ storeId: storeProfileId }).sort({ createdAt: -1 }).lean()
      : null;
    const latestStatus = latestSubscription ? StoreSubscription.getStoreSubscriptionStatus(latestSubscription) : null;
    const isRenewal = !!latestSubscription && ["active", "expired"].includes(latestStatus);

    const updated = await PurchaseRequest.findByIdAndUpdate(request._id, {
      status: "Rejected",
      rejectionReason: rejectionReason || "",
    }, { new: true }).lean();

    if (storeProfileId) {
      const nextStoreStatus = isRenewal ? (latestStatus === "active" ? "active" : "active") : "rejected";
      await StoreProfile.findByIdAndUpdate(storeProfileId, {
        status: nextStoreStatus,
        rejectedReason: rejectionReason || "",
        rejectedAt: new Date(),
        rejectedBy: req.user.id
      });
    }

    await createNotification(req.app, {
      userId: request.user,
      type: "store_subscription",
      title: isRenewal ? "تم رفض تجديد اشتراك المتجر" : "تم رفض طلب المتجر",
      body: isRenewal ? (rejectionReason || "تم رفض تجديد اشتراك المتجر.") : (rejectionReason || "تم رفض طلب إنشاء المتجر."),
      data: {
        requestId: request._id,
        rejectionReason,
        renewal: isRenewal,
        storeType: request.storeProfile?.storeType || "store"
      }
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/plans", async (req, res) => {
  try {
    const type = req.query.type === "family-production" ? "family-production" : "store";
    const plans = await Plan.find({ type, isActive: true }).sort({ price: 1 }).lean();
    res.json(plans);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
