import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderType: { type: String, enum: ["secure", "store"], default: "secure", index: true },
    storeProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProfile", default: null, index: true },
    storeOwnerEmailNotificationAttemptedAt: { type: Date, default: null, select: false },
    storeOwnerEmailNotificationSentAt: { type: Date, default: null, select: false },
    ad: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", default: null },
    items: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Ad", default: null },
      title: { type: String, required: true },
      originalPrice: { type: Number, min: 0 },
      discountType: { type: String, enum: ["percentage", "fixed"] },
      discountValue: { type: Number, min: 0, default: 0 },
      unitPrice: { type: Number, min: 0 },
      price: { type: Number, required: true, min: 0 },
      currency: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      subtotal: { type: Number, required: true, min: 0 },
      isAvailableForDelivery: { type: Boolean, default: false },
      inventoryEnabled: { type: Boolean, default: false },
      stockQuantityAtPurchase: { type: Number, min: 0, default: null }
    }],
    total: { type: Number, min: 0 },
    status: {
      type: String,
      enum: [
        "new",
        "processing",
        "completed",
        "cancelled",
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
    storePaymentDetails: {
      bankAccountId: { type: mongoose.Schema.Types.ObjectId },
      bankName: { type: String },
      accountHolderName: { type: String },
      accountNumber: { type: String },
      currency: { type: String, enum: ["YER", "SAR", "USD"] },
      receiptImage: { type: String },
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
orderSchema.index({ createdAt: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model("Order", orderSchema);
