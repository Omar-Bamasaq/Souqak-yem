import { Router } from "express";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import VerificationRequest from "../models/VerificationRequest.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { createNotification } from "../services/notificationService.js";
import AdminNotification from "../models/AdminNotification.js";
import { uploadVerificationDocs } from "../middleware/upload.js";
import adminAudit from "../middleware/adminAudit.js";
import { sendEmail } from "../utils/sendEmail.js";

const router = Router();

router.get("/mine", auth, async (req, res) => {
  try {
    const items = await VerificationRequest.find({ user: req.user.id }).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", auth, requireRole(["seller", "user"]), uploadVerificationDocs, async (req, res) => {
  try {
    const { 
      fullName, idNumber, dateOfBirth, country, phone, 
      docType, address, occupation 
    } = req.body || {};

    const frontFile = req.files?.idFrontImage?.[0];
    const backFile = req.files?.idBackImage?.[0];
    const selfieFile = req.files?.selfieImage?.[0];

    if (!fullName || !idNumber || !dateOfBirth || !country || !phone || !frontFile) {
      return res.status(400).json({ error: "البيانات الأساسية وصورة الهوية الأمامية مطلوبة" });
    }

    const vr = await VerificationRequest.create({
      user: req.user.id,
      fullName,
      idNumber,
      dateOfBirth,
      country,
      phone,
      idFrontImage: `ids/${frontFile.filename}`,
      idBackImage: backFile ? `ids/${backFile.filename}` : undefined,
      selfieImage: selfieFile ? `ids/${selfieFile.filename}` : undefined,
      address,
      occupation,
      docType: docType === "passport" ? "passport" : "id_card",
      status: "pending"
    });

    // Update user's temporary phone if not set (optional, based on requirement "phone is mandatory")
    // await User.findByIdAndUpdate(req.user.id, { phone });

    // إنشاء إشعار للأدمن (Realtime)
    try {
      const requester = await User.findById(req.user.id).select("name").lean();
      const adminNotif = await AdminNotification.create({
        type: "verification",
        title: "طلب توثيق جديد (مجاني)",
        message: `طلب توثيق جديد من المستخدم: ${requester?.name || "غير معروف"}`,
        link: "/admin/verification-requests",
        data: { requestId: vr._id }
      });
      const io = req.app.get("io");
      if (io) io.emit("admin_notification:new", adminNotif);
    } catch (err) {
      console.error("فشل إنشاء إشعار الأدمن للتوثيق:", err);
    }

    // إرسال إشعار للأدمن عبر البريد
    User.findById(req.user.id).select("name").lean().then(requester => {
      sendEmail({
        subject: "طلب توثيق جديد",
        html: `
          <div dir="rtl" style="font-family: sans-serif; padding: 20px; background-color: #f9fafb;">
            <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #2563eb; margin-bottom: 20px;">طلب توثيق جديد</h2>
              <p style="font-size: 16px; color: #374151;">وصل طلب توثيق حساب جديد للمنصة (نظام مجاني):</p>
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>اسم المستخدم:</strong> ${requester?.name || "غير متوفر"}</p>
                <p style="margin: 5px 0;"><strong>الاسم في الهوية:</strong> ${fullName}</p>
                <p style="margin: 5px 0;"><strong>رقم الهاتف:</strong> ${phone}</p>
              </div>
              <div style="text-align: center; margin-top: 30px;">
                <a href="http://localhost:5173/admin/verification-requests" style="background-color: #2563eb; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">عرض الطلبات</a>
              </div>
            </div>
          </div>
        `
      });
    }).catch(err => console.error("فشل في جلب بيانات المستخدم للإشعار:", err));

    res.status(201).json(vr);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/admin", auth, requireRole(["admin"]), async (req, res) => {
  try {
    const { status, q, phone } = req.query;
    const filter = {};
    if (status) filter.status = status;
    
    // Search by name or phone if provided
    if (q || phone) {
      const userFilter = {};
      if (q) userFilter.name = { $regex: q, $options: "i" };
      if (phone) userFilter.phone = { $regex: phone, $options: "i" };
      
      const users = await User.find(userFilter).select("_id").lean();
      const userIds = users.map(u => u._id);
      
      filter.$or = [
        { user: { $in: userIds } },
        { fullName: { $regex: q || "", $options: "i" } },
        { phone: { $regex: phone || q || "", $options: "i" } }
      ];
    }

    const items = await VerificationRequest.find(filter)
      .populate("user", "name email verificationStatus verificationDate verificationExpiryDate")
      .sort({ createdAt: -1 })
      .lean();
    res.json(items);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/admin/:id/approve", auth, requireRole(["admin"]), adminAudit(), async (req, res) => {
  try {
    const vr = await VerificationRequest.findById(req.params.id).lean();
    if (!vr) return res.status(404).json({ error: "Not found" });
    if (vr.status !== "pending") return res.status(400).json({ error: "Already processed" });
    
    await VerificationRequest.findByIdAndUpdate(vr._id, { status: "approved" });
    
    const now = new Date();
    const expiryDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    const updates = { 
      verified: true, 
      isVerifiedSeller: true, 
      verificationStatus: "verified",
      verificationDate: now,
      verificationExpiryDate: expiryDate,
      verifiedAt: now, // legacy
      verificationExpiresAt: expiryDate // legacy
    };
    
    await User.findByIdAndUpdate(vr.user, updates);
    
    await createNotification(req.app, {
      userId: vr.user,
      type: "verification_approved",
      title: "تم توثيق حسابك بنجاح",
      body: `مبروك! تم قبول طلب توثيق حسابك. التوثيق صالح لمدة 365 يوم وينتهي في ${expiryDate.toLocaleDateString('ar-YE')}.`,
      data: { requestId: vr._id }
    });
    
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/admin/:id/reject", auth, requireRole(["admin"]), adminAudit(), async (req, res) => {
  try {
    const { rejectionReason } = req.body || {};
    if (!rejectionReason) return res.status(400).json({ error: "يجب إدخال سبب الرفض" });

    const vr = await VerificationRequest.findById(req.params.id).lean();
    if (!vr) return res.status(404).json({ error: "Not found" });
    if (vr.status !== "pending") return res.status(400).json({ error: "Already processed" });
    
    await VerificationRequest.findByIdAndUpdate(vr._id, { 
      status: "rejected", 
      rejectionReason: rejectionReason 
    });
    
    await createNotification(req.app, {
      userId: vr.user,
      type: "verification_rejected",
      title: "تم رفض طلب التوثيق",
      body: `للأسف تم رفض طلب توثيق حسابك. السبب: ${rejectionReason}. يمكنك إعادة التقديم مرة أخرى.`,
      data: { verificationRequestId: vr._id, rejectionReason }
    });
    
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
