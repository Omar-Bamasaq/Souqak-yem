import mongoose from "mongoose";

export const BOOKING_SERVICE_TYPES = [
  "فندق",
  "استراحة",
  "شاليه",
  "قاعة مناسبات",
  "مخيم",
  "شقة فندقية",
  "منتجع",
  "قاعة اجتماعات",
  "ملعب",
  "مسبح",
  "مطعم",
  "مقهى",
  "خدمات سياحية",
  "سيارة للإيجار",
  "قاعة تدريب",
  "مركز صحي",
  "صالون",
  "خدمات تصوير",
  "أخرى"
];

const bookingServiceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, required: true, enum: BOOKING_SERVICE_TYPES, index: true },
    governorateId: { type: mongoose.Schema.Types.ObjectId, ref: "Governorate", required: true, index: true },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: "City", required: true, index: true },
    location: { type: String, required: true, trim: true, maxlength: 300 },
    lat: { type: Number, min: -90, max: 90, default: null },
    lng: { type: Number, min: -180, max: 180, default: null },
    phones: {
      type: [{
        type: { type: String, enum: ["phone", "whatsapp"], required: true },
        number: { type: String, required: true, trim: true, maxlength: 40 }
      }],
      validate: [(phones) => phones.length > 0 && phones.length <= 10, "أضف رقم تواصل واحدًا على الأقل."]
    },
    mainImage: { type: String, required: true },
    images: { type: [String], default: [], validate: [(images) => images.length <= 4, "الحد الأعلى أربع صور إضافية."] },
    note: { type: String, trim: true, maxlength: 2000, default: "" },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    moderationReason: { type: String, trim: true, maxlength: 1000, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

bookingServiceSchema.index({ status: 1, createdAt: -1 });
bookingServiceSchema.index({ type: 1, governorateId: 1, cityId: 1, status: 1 });

export default mongoose.models.BookingService || mongoose.model("BookingService", bookingServiceSchema);
