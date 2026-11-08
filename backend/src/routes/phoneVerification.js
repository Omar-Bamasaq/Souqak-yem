import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import adminAudit from "../middleware/adminAudit.js";
import User from "../models/User.js";
import PhoneVerificationRequest from "../models/PhoneVerificationRequest.js";
import { createAdminNotification, createNotification } from "../services/notificationService.js";
import {
  buildPhoneVerificationWhatsAppLink,
  generatePhoneVerificationCode,
  hashPhoneVerificationCode,
  phoneVerificationCodeMatches,
  PHONE_VERIFICATION_CODE_TTL_MS
} from "../services/phoneVerification.js";
import { isValidPhoneNumber, normalizePhone } from "../utils/securityRules.js";

const router = Router();
const ACTIVE_STATUSES = ["pending_admin_review", "code_issued"];
const DAY_MS = 24 * 60 * 60 * 1000;
const REJECTION_COOLDOWN_MS = 15 * 60 * 1000;
const ISSUE_COOLDOWN_MS = 60 * 1000;
const MAX_REQUESTS_PER_DAY = 3;
const MAX_CODES_PER_DAY = 3;
const MAX_CODE_ATTEMPTS = 5;

const requestIpLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "تجاوزت عدد طلبات التوثيق المسموح. حاول لاحقًا." }
});
const verifyIpLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "تجاوزت عدد محاولات التحقق المسموح. حاول لاحقًا." }
});
const adminIpLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "تجاوزت عدد إجراءات الإدارة المسموح. حاول لاحقًا." }
});

function safeRequest(request, includeAdminHistory = false) {
  if (!request) return null;
  const result = {
    id: String(request._id),
    phone: request.phone,
    status: request.status,
    requestedAt: request.requestedAt,
    codeIssuedAt: request.codeIssuedAt,
    codeExpiresAt: request.codeExpiresAt,
    codeAttempts: request.codeAttempts,
    reviewedAt: request.reviewedAt,
    rejectionReason: request.rejectionReason || "",
    verifiedAt: request.verifiedAt
  };
  if (includeAdminHistory) {
    result.user = request.user;
    result.actions = request.actions || [];
  }
  return result;
}

async function recentCodeIssueCount(userId, since) {
  const result = await PhoneVerificationRequest.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    { $unwind: "$codeIssueHistory" },
    { $match: { "codeIssueHistory.issuedAt": { $gte: since } } },
    { $count: "count" }
  ]);
  return result[0]?.count || 0;
}

async function latestCodeIssue(userId) {
  const result = await PhoneVerificationRequest.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    { $unwind: "$codeIssueHistory" },
    { $sort: { "codeIssueHistory.issuedAt": -1 } },
    { $limit: 1 },
    { $project: { _id: 0, issuedAt: "$codeIssueHistory.issuedAt" } }
  ]);
  return result[0]?.issuedAt || null;
}

function sendError(res, error) {
  if (error?.code === "PHONE_VERIFICATION_SECRET_MISSING") {
    return res.status(503).json({ error: "خدمة توثيق الهاتف غير مهيأة حاليًا." });
  }
  console.error("Phone verification request failed:", error);
  return res.status(500).json({ error: "حدث خطأ في الخادم." });
}

router.get("/mine", auth, async (req, res) => {
  try {
    const [user, request] = await Promise.all([
      User.findById(req.user.id).select("phone phoneVerifiedAt").lean(),
      PhoneVerificationRequest.findOne({ user: req.user.id }).sort({ createdAt: -1 }).lean()
    ]);
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود." });
    res.json({
      phone: user.phone || "",
      phoneVerifiedAt: user.phoneVerifiedAt || null,
      request: safeRequest(request)
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.post("/request", auth, requestIpLimit, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("name phone phoneVerifiedAt").lean();
    if (!user) return res.status(404).json({ error: "المستخدم غير موجود." });
    if (user.phoneVerifiedAt) return res.status(409).json({ error: "رقم الهاتف موثّق بالفعل." });

    const phone = normalizePhone(user.phone);
    if (!isValidPhoneNumber(phone)) {
      return res.status(400).json({ error: "أضف رقم هاتف صالحًا إلى ملفك الشخصي أولًا." });
    }

    let active = await PhoneVerificationRequest.findOne({
      user: user._id,
      status: { $in: ACTIVE_STATUSES }
    });
    const now = new Date();
    if (active?.status === "pending_admin_review") {
      return res.json({ request: safeRequest(active), existing: true });
    }
    if (active?.status === "code_issued" && active.codeExpiresAt > now) {
      return res.json({ request: safeRequest(active), existing: true });
    }
    if (active?.status === "code_issued") {
      await PhoneVerificationRequest.updateOne(
        { _id: active._id, status: "code_issued", codeExpiresAt: { $lte: now } },
        {
          $set: { status: "expired" },
          $unset: { codeHash: 1 },
          $push: { actions: { action: "expired", at: now, actor: null, note: "انتهت صلاحية الرمز" } }
        }
      );
    }

    const lastRejected = await PhoneVerificationRequest.findOne({
      user: user._id,
      status: "rejected"
    }).sort({ reviewedAt: -1 }).select("reviewedAt").lean();
    const cooldownEndsAt = lastRejected?.reviewedAt
      ? new Date(lastRejected.reviewedAt.getTime() + REJECTION_COOLDOWN_MS)
      : null;
    if (cooldownEndsAt && cooldownEndsAt > now) {
      return res.status(429).json({
        error: "يمكنك إعادة الطلب بعد انتهاء مهلة الرفض.",
        retryAfter: Math.ceil((cooldownEndsAt - now) / 1000)
      });
    }

    const requestsToday = await PhoneVerificationRequest.countDocuments({
      user: user._id,
      createdAt: { $gte: new Date(now.getTime() - DAY_MS) }
    });
    if (requestsToday >= MAX_REQUESTS_PER_DAY) {
      return res.status(429).json({ error: "وصلت إلى الحد اليومي لطلبات التوثيق." });
    }

    const request = await PhoneVerificationRequest.create({
      user: user._id,
      phone,
      status: "pending_admin_review",
      requestedAt: now,
      actions: [{ action: "requested", actor: user._id, at: now }]
    });
    await createAdminNotification(req.app, {
      type: "phone_verification_request",
      title: "طلب توثيق رقم هاتف جديد",
      message: `أرسل ${user.name || "مستخدم"} طلبًا جديدًا لتوثيق رقم هاتفه.`,
      link: "/admin/phone-verification",
      data: { requestId: String(request._id), userId: String(user._id) }
    });
    res.status(201).json({ request: safeRequest(request), existing: false });
  } catch (error) {
    if (error?.code === 11000) {
      const active = await PhoneVerificationRequest.findOne({
        user: req.user.id,
        status: { $in: ACTIVE_STATUSES }
      });
      if (active) return res.json({ request: safeRequest(active), existing: true });
    }
    sendError(res, error);
  }
});

router.post("/verify", auth, verifyIpLimit, async (req, res) => {
  const code = String(req.body?.code || "");
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "أدخل رمزًا مكوّنًا من 6 أرقام." });
  }

  const session = await mongoose.startSession();
  let failure = null;
  try {
    const request = await PhoneVerificationRequest.findOne({
      user: req.user.id,
      status: "code_issued"
    }).select("+codeHash");
    if (!request || !request.codeHash) {
      return res.status(400).json({ error: "رمز التحقق غير صالح أو منتهي أو لم يعد فعالًا." });
    }

    const now = new Date();
    if (request.codeExpiresAt <= now) {
      await PhoneVerificationRequest.updateOne(
        { _id: request._id, status: "code_issued", codeHash: request.codeHash, codeExpiresAt: { $lte: now } },
        {
          $set: { status: "expired" },
          $unset: { codeHash: 1 },
          $push: { actions: { action: "expired", at: now, actor: null, note: "انتهت صلاحية الرمز" } }
        }
      );
      return res.status(400).json({ error: "انتهت صلاحية الرمز. أرسل طلب توثيق جديدًا." });
    }

    const identity = {
      requestId: request._id,
      userId: request.user,
      phone: request.phone
    };
    if (!phoneVerificationCodeMatches(code, request.codeHash, identity)) {
      const incremented = await PhoneVerificationRequest.findOneAndUpdate(
        {
          _id: request._id,
          user: req.user.id,
          status: "code_issued",
          codeHash: request.codeHash,
          codeExpiresAt: { $gt: now },
          codeAttempts: { $lt: MAX_CODE_ATTEMPTS }
        },
        { $inc: { codeAttempts: 1 } },
        { new: true }
      );
      if (incremented && incremented.codeAttempts >= MAX_CODE_ATTEMPTS) {
        await PhoneVerificationRequest.updateOne(
          { _id: request._id, status: "code_issued", codeAttempts: { $gte: MAX_CODE_ATTEMPTS } },
          {
            $set: { status: "expired" },
            $unset: { codeHash: 1 },
            $push: { actions: { action: "expired", at: now, actor: null, note: "استُنفدت محاولات الرمز" } }
          }
        );
      }
      return res.status(400).json({ error: "رمز التحقق غير صالح أو منتهي أو لم يعد فعالًا." });
    }

    await session.withTransaction(async () => {
      const consumed = await PhoneVerificationRequest.updateOne(
        {
          _id: request._id,
          user: req.user.id,
          status: "code_issued",
          codeHash: request.codeHash,
          codeAttempts: { $lt: MAX_CODE_ATTEMPTS },
          codeExpiresAt: { $gt: now }
        },
        {
          $set: { status: "verified", verifiedAt: now },
          $unset: { codeHash: 1 },
          $push: { actions: { action: "verified", actor: request.user, at: now } }
        },
        { session }
      );
      if (consumed.modifiedCount !== 1) {
        failure = "invalid";
        throw new Error("Phone verification code was consumed concurrently");
      }

      const currentUser = await User.findById(request.user).select("phone").session(session).lean();
      if (!currentUser || normalizePhone(currentUser.phone) !== request.phone) {
        failure = "phone-changed";
        throw new Error("Phone number changed while verifying");
      }
      const userUpdate = await User.updateOne(
        { _id: request.user, phone: currentUser.phone, phoneVerifiedAt: null },
        { $set: { phoneVerifiedAt: now } },
        { session }
      );
      if (userUpdate.modifiedCount !== 1) {
        failure = "phone-changed";
        throw new Error("Phone number changed while verifying");
      }
    });

    return res.json({ ok: true, phoneVerifiedAt: now });
  } catch (error) {
    if (failure) {
      return res.status(400).json({ error: "رمز التحقق غير صالح أو منتهي أو لم يعد فعالًا." });
    }
    return sendError(res, error);
  } finally {
    await session.endSession();
  }
});

router.get("/admin", auth, requireRole(["admin"]), adminIpLimit, adminAudit(), async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = String(req.query.status);
    const requests = await PhoneVerificationRequest.find(filter)
      .populate("user", "name")
      .populate("actions.actor", "name role")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json(requests.map((request) => safeRequest(request, true)));
  } catch (error) {
    sendError(res, error);
  }
});

async function issueCode(req, res, { reissue = false } = {}) {
  let request;
  try {
    request = await PhoneVerificationRequest.findById(req.params.id).select("+codeHash");
    if (!request) return res.status(404).json({ error: "الطلب غير موجود." });
    const user = await User.findById(request.user)
      .select("name phone phoneVerifiedAt isDisabled isDeleted")
      .lean();
    if (!user || user.isDisabled || user.isDeleted
      || user.phoneVerifiedAt
      || normalizePhone(user.phone) !== request.phone) {
      return res.status(409).json({ error: "تغيرت بيانات الحساب أو لم يعد الطلب صالحًا؛ أعد تقديم طلب توثيق." });
    }
    const now = new Date();
    const allowed = reissue
      ? request.status === "code_issued"
      : request.status === "pending_admin_review";
    if (!allowed) {
      return res.status(409).json({ error: "حالة الطلب لا تسمح بإصدار رمز." });
    }
    if (reissue && request.codeIssuedAt && now - request.codeIssuedAt < ISSUE_COOLDOWN_MS) {
      return res.status(429).json({ error: "انتظر دقيقة قبل إصدار رمز بديل." });
    }

    const since = new Date(now.getTime() - DAY_MS);
    if (await recentCodeIssueCount(request.user, since) >= MAX_CODES_PER_DAY) {
      return res.status(429).json({ error: "وصلت إلى الحد اليومي لإصدار الرموز." });
    }
    const lastIssue = await latestCodeIssue(request.user);
    if (lastIssue && now - lastIssue < ISSUE_COOLDOWN_MS) {
      return res.status(429).json({ error: "انتظر دقيقة قبل إصدار رمز جديد." });
    }

    const code = generatePhoneVerificationCode();
    const expiresAt = new Date(now.getTime() + PHONE_VERIFICATION_CODE_TTL_MS);
    const codeHash = hashPhoneVerificationCode({
      requestId: request._id,
      userId: request.user,
      phone: request.phone,
      code
    });
    const expectedHash = request.codeHash;
    const filter = reissue
      ? {
          _id: request._id,
          status: "code_issued",
          codeHash: expectedHash,
          codeIssuedAt: request.codeIssuedAt
        }
      : { _id: request._id, status: "pending_admin_review" };
    const updated = await PhoneVerificationRequest.findOneAndUpdate(
      filter,
      {
        $set: {
          status: "code_issued",
          codeHash,
          codeIssuedAt: now,
          codeExpiresAt: expiresAt,
          codeAttempts: 0,
          reviewedBy: req.user.id,
          reviewedAt: now,
          rejectionReason: ""
        },
        $push: {
          codeIssueHistory: { issuedAt: now, issuedBy: req.user.id },
          actions: { action: reissue ? "code_issued" : "approved", actor: req.user.id, at: now }
        }
      },
      { new: true }
    ).lean();
    if (!updated) return res.status(409).json({ error: "تمت معالجة الطلب من مشرف آخر." });

    const waLink = buildPhoneVerificationWhatsAppLink(updated.phone, code);
    await createNotification(req.app, {
      userId: updated.user,
      type: "system",
      title: "تحديث طلب توثيق الهاتف",
      body: "راجع حالة طلب توثيق رقمك. إذا استلمت رمز التحقق من الإدارة عبر واتساب، أدخله في صفحة التوثيق.",
      push: false
    });
    return res.json({
      request: safeRequest({ ...updated, user: { name: user.name } }, true),
      code,
      waLink,
      manualSendRequired: true
    });
  } catch (error) {
    return sendError(res, error);
  }
}

router.patch("/admin/:id/approve", auth, requireRole(["admin"]), adminIpLimit, adminAudit(), (req, res) =>
  issueCode(req, res)
);

router.patch("/admin/:id/reissue", auth, requireRole(["admin"]), adminIpLimit, adminAudit(), (req, res) =>
  issueCode(req, res, { reissue: true })
);

router.patch("/admin/:id/reject", auth, requireRole(["admin"]), adminIpLimit, adminAudit(), async (req, res) => {
  try {
    const reason = String(req.body?.rejectionReason || "").trim().slice(0, 500);
    const request = await PhoneVerificationRequest.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ACTIVE_STATUSES } },
      {
        $set: {
          status: "rejected",
          codeHash: null,
          codeExpiresAt: null,
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
          rejectionReason: reason
        },
        $push: { actions: { action: "rejected", actor: req.user.id, at: new Date(), note: reason } }
      },
      { new: true }
    );
    if (!request) {
      const exists = await PhoneVerificationRequest.exists({ _id: req.params.id });
      return res.status(exists ? 409 : 404).json({
        error: exists ? "تمت معالجة الطلب من قبل." : "الطلب غير موجود."
      });
    }

    await createNotification(req.app, {
      userId: request.user,
      type: "system",
      title: "تم رفض طلب توثيق الهاتف",
      body: reason ? `تم رفض طلب توثيق رقم الهاتف. السبب: ${reason}` : "تم رفض طلب توثيق رقم الهاتف. يمكنك إعادة الطلب بعد المهلة المحددة.",
      push: false
    });
    return res.json({ request: safeRequest(request) });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
