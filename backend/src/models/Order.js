import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    ad: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", required: true },
    resellAd: { type: mongoose.Schema.Types.ObjectId, ref: "ResellAd" }, // مرجع لإعلان إعادة البيع إذا وجد
    status: {
      type: String,
      enum: [
        "PENDING_SELLER_APPROVAL", // المشتري طلب الشراء، في انتظار موافقة البائع
        "AWAITING_PAYMENT",       // البائع وافق، في انتظار المشتري يحول الفلوس
        "AWAITING_PAYMENT_CONFIRMATION", // المشتري أرسل بيانات التحويل، في انتظار تأكيد الإدارة
        "PAID_CONFIRMED",         // الإدارة أكدت استلام الفلوس
        "SHIPPED",                // البائع شحن المنتج
        "DELIVERED",              // المنتج وصل للمشتري (أو تم التأكيد تلقائياً)
        "COMPLETED",              // تم تحرير الفلوس للبائع نهائياً
        "DISPUTED",               // وجود نزاع
        "CANCELLED"               // تم إلغاء الطلب
      ],
      default: "PENDING_SELLER_APPROVAL"
    },
    amount: { type: Number, required: true }, // سعر المنتج
    shippingFee: { type: Number, default: 0 }, // رسوم التوصيل
    currency: { type: String, default: "YER" }, // عملة المنتج
    shippingCurrency: { type: String, default: "YER" }, // عملة التوصيل
    shippingPayer: { type: String, enum: ["buyer", "seller"], default: "buyer" }, // من يتحمل التوصيل
    
    // بيانات الدفع (التحويل البنكي)
    paymentDetails: {
      bankName: { type: String }, // الكريمي، بن دول، إلخ
      payments: [{
        transactionNumber: { type: String },
        receiptImage: { type: String }
      }],
      submittedAt: { type: Date }
    },
    
    // بيانات الشحن
    shippingDetails: {
      company: { type: String }, // شركة الشحن
      trackingNumber: { type: String }, // رقم التتبع
      shippedAt: { type: Date },
      shippingReceipt: { type: String } // سند الشحن (صورة)
    },

    agreedTerms: { type: Boolean, default: false }, // موافقة المشتري على الشروط
    totalAmount: { type: Number, required: true }, // المبلغ الإجمالي (ما يدفعه المشتري)
    
    // هيكل العمولات الجديد
    buyerServiceFee: { type: Number, default: 0 }, // رسوم حماية المشتري (3% تضاف)
    sellerCommission: { type: Number, default: 0 }, // عمولة بيع البائع (1% تخصم)
    
    platformFee: { type: Number, default: 0 }, // إجمالي ربح المنصة (مجموع العمولات)
    sellerAmount: { type: Number, default: 0 }, // المبلغ الصافي الذي سيصل لمحفظة البائع
    
    notes: { type: String },
    
    // تتبع المسؤول
    verifiedByAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifiedAt: { type: Date },

    // Soft Delete Fields (Phase 1)
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deleteReason: { type: String, default: null }
  },
  { timestamps: true }
);

orderSchema.index({ status: 1 });
orderSchema.index({ seller: 1 });
orderSchema.index({ buyer: 1 });
orderSchema.index({ createdAt: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model("Order", orderSchema);
