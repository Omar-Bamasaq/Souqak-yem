import { Router } from "express";
import mongoose from "mongoose";
import BookingService, { BOOKING_SERVICE_TYPES } from "../models/BookingService.js";
import BookingServiceRating from "../models/BookingServiceRating.js";
import Governorate from "../models/Governorate.js";
import City from "../models/City.js";
import auth from "../middleware/auth.js";
import { requireRole } from "../middleware/roles.js";
import { uploadImages } from "../middleware/upload.js";
import { createAdminNotification, createNotification } from "../services/notificationService.js";

const router = Router();
const validId = (value) => mongoose.Types.ObjectId.isValid(value);

function cleanText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function parseContactList(value, type) {
  let contacts = value;
  if (typeof contacts === "string") {
    try {
      contacts = JSON.parse(contacts);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(contacts) || contacts.length > 5) return null;
  return contacts
    .map((entry) => ({ type, number: cleanText(entry?.value ?? entry?.number, 40) }))
    .filter((entry) => entry.number);
}

function parsePhones(phonesValue, whatsappValue) {
  const phones = parseContactList(phonesValue, "phone");
  const whatsapp = parseContactList(whatsappValue, "whatsapp");
  if (!phones || !whatsapp) return null;
  const normalized = [...phones, ...whatsapp];
  return normalized.length >= 1 && normalized.length <= 10 ? normalized : null;
}

async function validatePayload(body, files) {
  const name = cleanText(body.name, 120);
  const type = cleanText(body.type, 80);
  const governorateId = String(body.governorateId || "");
  const cityId = String(body.cityId || "");
  const location = cleanText(body.location, 300);
  const hasLat = body.lat !== undefined && body.lat !== null && String(body.lat).trim() !== "";
  const hasLng = body.lng !== undefined && body.lng !== null && String(body.lng).trim() !== "";
  const lat = hasLat ? Number(body.lat) : null;
  const lng = hasLng ? Number(body.lng) : null;
  const note = cleanText(body.note, 2000);
  const phones = parsePhones(body.phones, body.whatsapp);
  const images = files || [];

  if (!name || !BOOKING_SERVICE_TYPES.includes(type) || !location || !phones) {
    return { error: "أكمل اسم الخدمة ونوعها وموقعها وأضف رقم تواصل." };
  }
  if (hasLat !== hasLng) {
    return { error: "يجب إدخال إحداثيي الموقع معًا." };
  }
  if (!validId(governorateId) || !validId(cityId)) {
    return { error: "اختر المحافظة والمدينة بشكل صحيح." };
  }
  if (images.length < 1 || images.length > 5) {
    return { error: "أرفق صورة رئيسية، ويمكن إضافة أربع صور فرعية كحد أقصى." };
  }
  if (hasLat && (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180)) {
    return { error: "إحداثيات موقع الخدمة غير صالحة." };
  }

  const [governorate, city] = await Promise.all([
    Governorate.findOne({ _id: governorateId, isActive: true }).select("_id").lean(),
    City.findOne({ _id: cityId, governorateId, isActive: true }).select("_id").lean()
  ]);
  if (!governorate || !city) return { error: "المحافظة أو المدينة المحددة غير متاحة." };

  return {
    data: {
      name,
      type,
      governorateId,
      cityId,
      location,
      lat,
      lng,
      phones,
      mainImage: `/uploads/${images[0].filename}`,
      images: images.slice(1).map((file) => `/uploads/${file.filename}`),
      note
    }
  };
}

async function addRatings(items) {
  if (!items.length) return items;
  const ids = items.map((item) => item._id);
  const ratings = await BookingServiceRating.aggregate([
    { $match: { bookingServiceId: { $in: ids } } },
    { $group: { _id: "$bookingServiceId", average: { $avg: "$stars" }, count: { $sum: 1 } } }
  ]);
  const byId = new Map(ratings.map((rating) => [String(rating._id), rating]));
  return items.map((item) => {
    const rating = byId.get(String(item._id));
    return { ...item, ratingAverage: rating ? Math.round(rating.average * 10) / 10 : 0, ratingCount: rating?.count || 0 };
  });
}

router.get("/types", (_req, res) => res.json(BOOKING_SERVICE_TYPES));

router.get("/", async (req, res) => {
  try {
    const filter = { status: "approved" };
    if (req.query.type && BOOKING_SERVICE_TYPES.includes(String(req.query.type))) filter.type = String(req.query.type);
    for (const key of ["governorateId", "cityId"]) {
      if (req.query[key]) {
        if (!validId(req.query[key])) return res.status(400).json({ error: "قيمة التصفية غير صحيحة." });
        filter[key] = req.query[key];
      }
    }
    const items = await BookingService.find(filter)
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .populate("ownerId", "name")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    let withRatings = await addRatings(items);
    if (req.query.minRating) {
      const minRating = Number(req.query.minRating);
      if (!Number.isFinite(minRating) || minRating < 0 || minRating > 5) {
        return res.status(400).json({ error: "التقييم المحدد غير صحيح." });
      }
      withRatings = withRatings.filter((item) => item.ratingAverage >= minRating);
    }
    if (req.query.sort === "rating") {
      withRatings.sort((a, b) => b.ratingAverage - a.ratingAverage || b.ratingCount - a.ratingCount);
    }
    res.json(withRatings);
  } catch (error) {
    console.error("Booking services list failed:", error);
    res.status(500).json({ error: "تعذر تحميل خدمات الحجوزات." });
  }
});

router.get("/mine", auth, async (req, res) => {
  try {
    const items = await BookingService.find({ ownerId: req.user.id })
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .sort({ createdAt: -1 })
      .lean();
    res.json(items);
  } catch (error) {
    console.error("My booking service requests failed:", error);
    res.status(500).json({ error: "تعذر تحميل طلباتك." });
  }
});

router.get("/my-ratings", auth, async (req, res) => {
  try {
    const ratings = await BookingServiceRating.find({ userId: req.user.id })
      .select("bookingServiceId stars")
      .lean();
    res.json(ratings);
  } catch (error) {
    console.error("My booking service ratings failed:", error);
    res.status(500).json({ error: "تعذر تحميل تقييماتك." });
  }
});

router.post("/", auth, uploadImages.array("images", 5), async (req, res) => {
  try {
    const result = await validatePayload(req.body, req.files);
    if (result.error) return res.status(400).json({ error: result.error });
    const item = await BookingService.create({ ...result.data, ownerId: req.user.id, status: "pending" });
    await createAdminNotification(req.app, {
      type: "booking_submission",
      title: "طلب خدمة حجز جديد",
      message: `طلب اعتماد خدمة "${item.name}"`,
      link: "/admin/bookings",
      data: { bookingServiceId: String(item._id) }
    });
    res.status(201).json({ item, message: "تم إرسال طلبك، وسيتم مراجعة الطلب من قبل الإدارة لاعتماده." });
  } catch (error) {
    console.error("Booking service submission failed:", error);
    res.status(500).json({ error: "تعذر إرسال طلب الخدمة." });
  }
});

router.post("/:id/rating", auth, async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: "الخدمة غير موجودة." });
    const stars = Number(req.body.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ error: "اختر تقييمًا من نجمة إلى خمس نجوم." });
    }
    const service = await BookingService.findOne({ _id: req.params.id, status: "approved" }).select("_id").lean();
    if (!service) return res.status(404).json({ error: "الخدمة غير موجودة." });
    await BookingServiceRating.create({ bookingServiceId: service._id, userId: req.user.id, stars });
    res.status(201).json({ ok: true, stars });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: "سبق أن قيّمت هذه الخدمة. لا يمكن تعديل التقييم أو حذفه." });
    console.error("Booking service rating failed:", error);
    res.status(500).json({ error: "تعذر حفظ التقييم." });
  }
});

router.get("/admin", auth, requireRole(["admin"]), async (_req, res) => {
  try {
    const items = await BookingService.find()
      .populate("governorateId", "name")
      .populate("cityId", "name")
      .populate("ownerId", "name phone")
      .sort({ status: 1, createdAt: -1 })
      .lean();
    res.json(await addRatings(items));
  } catch (error) {
    console.error("Admin booking services list failed:", error);
    res.status(500).json({ error: "تعذر تحميل طلبات وخدمات الحجوزات." });
  }
});

router.post("/admin", auth, requireRole(["admin"]), uploadImages.array("images", 5), async (req, res) => {
  try {
    const result = await validatePayload(req.body, req.files);
    if (result.error) return res.status(400).json({ error: result.error });
    const item = await BookingService.create({
      ...result.data,
      ownerId: null,
      status: "approved",
      reviewedBy: req.user.id,
      reviewedAt: new Date()
    });
    res.status(201).json(item);
  } catch (error) {
    console.error("Admin booking service creation failed:", error);
    res.status(500).json({ error: "تعذر إنشاء خدمة الحجز." });
  }
});

router.patch("/admin/:id/review", auth, requireRole(["admin"]), async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: "الطلب غير موجود." });
    const status = req.body.status;
    const moderationReason = cleanText(req.body.reason, 1000);
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "قرار المراجعة غير صحيح." });
    if (status === "rejected" && !moderationReason) return res.status(400).json({ error: "اكتب سبب الرفض." });

    const item = await BookingService.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { $set: { status, moderationReason: status === "rejected" ? moderationReason : "", reviewedBy: req.user.id, reviewedAt: new Date() } },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: "الطلب غير موجود أو تمت مراجعته مسبقًا." });
    if (item.ownerId) {
      await createNotification(req.app, {
        userId: String(item.ownerId),
        type: "booking_status",
        title: status === "approved" ? "تم اعتماد خدمة الحجز" : "تم رفض طلب خدمة الحجز",
        body: status === "approved" ? `تم اعتماد خدمة "${item.name}" وأصبحت ظاهرة للمستخدمين.` : `تم رفض خدمة "${item.name}". السبب: ${moderationReason}`,
        data: { bookingServiceId: String(item._id), status, reason: moderationReason }
      });
    }
    res.json(item);
  } catch (error) {
    console.error("Booking service review failed:", error);
    res.status(500).json({ error: "تعذر حفظ قرار المراجعة." });
  }
});

export default router;
