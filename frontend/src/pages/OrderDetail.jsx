import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { useAuth } from "../store/AuthContext.jsx";
import { uploadsUrl } from "../lib/uploads.js";
import BankAccountsDisplay from "../components/BankAccountsDisplay.jsx";
import MobileSelect from "../components/MobileSelect.jsx";

export default function OrderDetail() {
  const { id } = useParams();
  const api = useApi();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [convOpening, setConvOpening] = useState(false);

  // Payment Form State
  const [bankName, setBankName] = useState("");
  const [otherBankName, setOtherBankName] = useState("");
  const [transactionNumbers, setTransactionNumbers] = useState(["", ""]);
  const [receiptFiles, setReceiptFiles] = useState([null, null]);
  const [banks, setBanks] = useState([]);

  // Shipping Form State
  const [shippingCompany, setShippingCompany] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippingReceipt, setShippingReceipt] = useState(null);

  // Dispute Form State
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDetails, setDisputeDetails] = useState("");
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [isReviewed, setIsReviewed] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({
    reliability: 5,
    communication: 5,
    deliverySpeed: 5,
    comment: "",
    images: []
  });

  const handlePostReview = async () => {
    if (reviewData.comment.length < 10) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "التعليق يجب أن يكون 10 أحرف على الأقل", type: "error" } }));
      return;
    }
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("reliability", reviewData.reliability);
      formData.append("communication", reviewData.communication);
      formData.append("deliverySpeed", reviewData.deliverySpeed);
      formData.append("comment", reviewData.comment);
      reviewData.images.forEach(img => formData.append("images", img));

      await api.post(`/reviews/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setIsReviewed(true);
      setShowReviewModal(false);
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: "تم إرسال تقييمك بنجاح", type: "success" } }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent("admin:toast", { detail: { message: err.response?.data?.error || "تعذر إرسال التقييم", type: "error" } }));
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (order?.status === 'COMPLETED' || order?.status === 'DELIVERED') {
      // Check if already reviewed
      api.get('/reviews/pending').then(res => {
        const isPending = res.data.some(o => o._id === id);
        setIsReviewed(!isPending);
      }).catch(() => {});
    }
  }, [order?.status, id]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data);
      
      // تحميل الحسابات البنكية إذا كان الطلب في حالة انتظار الدفع
      if (res.data.status === "AWAITING_PAYMENT") {
        try {
          const banksRes = await api.get("/bank-accounts");
          setBanks(banksRes.data || []);
        } catch (e) {
          console.error("Failed to load bank accounts", e);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || "تعذر تحميل تفاصيل الطلب");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [id]);

  const handleApprove = async () => {
    if (!confirm("هل أنت متأكد من الموافقة على طلب الشراء؟")) return;
    try {
      setSubmitting(true);
      await api.patch(`/orders/${id}/approve`);
      loadOrder();
    } catch (err) {
      alert(err.response?.data?.error || "حدث خطأ ما");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt("يرجى كتابة سبب الرفض:");
    if (reason === null) return;
    try {
      setSubmitting(true);
      await api.patch(`/orders/${id}/reject`, { reason });
      loadOrder();
    } catch (err) {
      alert(err.response?.data?.error || "حدث خطأ ما");
    } finally {
      setSubmitting(false);
    }
  };

    const handlePay = async () => {
      // فحص دقيق للبيانات قبل الإرسال
      const finalBankName = bankName === "other" ? otherBankName.trim() : bankName;
      if (!finalBankName) return alert("يرجى اختيار أو كتابة البنك المستخدم");
      
      if (!transactionNumbers[0] || !receiptFiles[0]) {
        return alert("يجب إكمال بيانات الحوالة الأولى (الرقم والسند) على الأقل");
      }

      // التأكد من أن السند الثاني (إذا وجد) له رقم عملية
      if (receiptFiles[1] && !transactionNumbers[1]) {
        return alert("يرجى إدخال رقم العملية للسند الثاني");
      }
      if (!receiptFiles[1] && transactionNumbers[1]) {
        return alert("يرجى إرفاق صورة السند الثاني لرقم العملية المدخل");
      }

      try {
        setSubmitting(true);
        const formData = new FormData();
        formData.append("bankName", finalBankName);
        
        // إرسال البيانات بترتيب دقيق لضمان مطابقتها في الخلفية
        receiptFiles.forEach((file, idx) => {
          if (file && transactionNumbers[idx]) {
            formData.append("paymentReceipt", file);
            formData.append("transactionNumber", transactionNumbers[idx].trim());
          }
        });
        
        await api.patch(`/orders/${id}/pay`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        loadOrder();
      } catch (err) {
        console.error("Payment submission error:", err);
        alert(err.response?.data?.error || err.response?.data?.message || "حدث خطأ أثناء إرسال بيانات الدفع");
      } finally {
        setSubmitting(false);
      }
    };

  const handleShip = async () => {
    if (!shippingCompany || !trackingNumber) return alert("يرجى إدخال بيانات الشحن");
    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("company", shippingCompany);
      formData.append("trackingNumber", trackingNumber);
      if (shippingReceipt) {
        formData.append("paymentReceipt", shippingReceipt); // backend expects paymentReceipt from uploadReceipt middleware
      }
      
      await api.patch(`/orders/${id}/ship`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      loadOrder();
    } catch (err) {
      alert(err.response?.data?.error || "حدث خطأ ما");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!confirm("تأكيد استلام المنتج؟ سيتم تحويل المبلغ للبائع فوراً.")) return;
    try {
      setSubmitting(true);
      await api.patch(`/orders/${id}/confirm-delivery`);
      loadOrder();
    } catch (err) {
      alert(err.response?.data?.error || "حدث خطأ ما");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason) return alert("يرجى تحديد سبب النزاع");
    try {
      setSubmitting(true);
      await api.post(`/orders/${id}/dispute`, { reason: disputeReason, details: disputeDetails });
      setShowDisputeModal(false);
      loadOrder();
    } catch (err) {
      alert(err.response?.data?.error || "حدث خطأ ما");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="py-20 flex justify-center"><LoadingSpinner size="lg" /></div>;
  if (error) return <div className="py-20 text-center text-red-500 font-bold">{error}</div>;
  if (!order) return null;

  const formatCurrency = (currency) => {
    const map = {
      "YER": "ريال (صنعاء)",
      "YER_ADEN": "ريال (عدن)",
      "SAR": "ريال سعودي",
      "USD": "دولار أمريكي"
    };
    return map[currency] || currency;
  };

  const isBuyer = String(user?.id || user?._id) === String(order.buyer?._id || order.buyer);
  const isSeller = String(user?.id || user?._id) === String(order.seller?._id || order.seller);

  const openChatWithOtherParty = async () => {
    if (!order.ad?._id) return;
    try {
      setConvOpening(true);
      const otherPartyId = isBuyer ? (order.seller?._id || order.seller) : (order.buyer?._id || order.buyer);
      const r = await api.post("/conversations/open", { 
        adId: order.ad._id,
        participantId: otherPartyId
      });
      if (r.data?._id) {
        navigate(`/messages?c=${r.data._id}&direct=1`);
      }
    } catch (err) {
      console.error("Chat error:", err);
      alert("تعذر فتح المحادثة");
    } finally {
      setConvOpening(false);
    }
  };

  const statusMap = {
    PENDING_SELLER_APPROVAL: { label: "بانتظار موافقة البائع", color: "bg-amber-100 text-amber-700", step: 1 },
    AWAITING_PAYMENT: { label: "بانتظار الدفع", color: "bg-blue-100 text-blue-700", step: 2 },
    AWAITING_PAYMENT_CONFIRMATION: { label: "بانتظار تأكيد الإدارة", color: "bg-purple-100 text-purple-700", step: 2 },
    PAID_CONFIRMED: { label: "تم تأكيد الدفع", color: "bg-emerald-100 text-emerald-700", step: 3 },
    SHIPPED: { label: "تم الشحن", color: "bg-indigo-100 text-indigo-700", step: 4 },
    DELIVERED: { label: "تم الاستلام", color: "bg-green-100 text-green-700", step: 5 },
    COMPLETED: { label: "مكتمل", color: "bg-gray-100 text-gray-700", step: 5 },
    DISPUTED: { label: "نزاع مفتوح", color: "bg-red-100 text-red-700", step: 0 },
    CANCELLED: { label: "ملغي", color: "bg-red-50 text-red-400", step: 0 }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-12 space-y-6 sm:space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border-2 border-gray-50 dark:border-slate-800 shadow-xl shadow-gray-50 dark:shadow-none">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xl shadow-blue-100 dark:shadow-none shrink-0">
              <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white truncate">طلب #{order._id.slice(-6).toUpperCase()}</h1>
            <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">{new Date(order.createdAt).toLocaleString("ar-EG")}</p>
          </div>
        </div>
        <div className={`w-full sm:w-auto text-center px-6 py-2.5 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest ${statusMap[order.status].color}`}>
          {statusMap[order.status].label}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-10">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-10">
          {/* Progress Steps */}
          {order.status !== 'DISPUTED' && order.status !== 'CANCELLED' && (
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border-2 border-gray-50 dark:border-slate-800 shadow-lg shadow-gray-50 dark:shadow-none overflow-x-auto no-scrollbar">
              <div className="flex justify-between items-center min-w-[320px] sm:min-w-[450px] px-2">
                {[
                  { id: 1, label: "الطلب" },
                  { id: 2, label: "الدفع" },
                  { id: 3, label: "التأكيد" },
                  { id: 4, label: "الشحن" },
                  { id: 5, label: "الاستلام" }
                ].map((s, i) => (
                  <React.Fragment key={s.id}>
                    <div className="flex flex-col items-center gap-2 sm:gap-3">
                      <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-black transition-all duration-500 ${
                        statusMap[order.status].step >= s.id 
                          ? "bg-blue-600 text-white shadow-xl shadow-blue-100" 
                          : "bg-gray-100 dark:bg-slate-800 text-gray-400"
                      }`}>
                        {statusMap[order.status].step > s.id ? "✓" : s.id}
                      </div>
                      <span className={`text-[8px] sm:text-[10px] font-black uppercase tracking-tighter ${statusMap[order.status].step >= s.id ? "text-blue-600" : "text-gray-400"}`}>{s.label}</span>
                    </div>
                    {i < 4 && (
                      <div className={`h-0.5 sm:h-1 flex-1 mx-1 sm:mx-2 rounded-full transition-all duration-700 ${statusMap[order.status].step > s.id ? "bg-blue-600" : "bg-gray-100 dark:bg-slate-800"}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Product Info */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border-2 border-gray-50 dark:border-slate-800 shadow-lg shadow-gray-50 dark:shadow-none space-y-6">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] px-1">تفاصيل المنتج والأسعار</h3>
            <div className="flex gap-4 sm:gap-5 p-4 sm:p-5 bg-gray-50 dark:bg-slate-800/50 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-100 dark:border-slate-800">
              <div className="h-16 w-20 sm:h-24 sm:w-32 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800 overflow-hidden flex-shrink-0 shadow-sm border border-gray-100 dark:border-slate-700">
                <img 
                  src={order.ad?.images?.[0] ? uploadsUrl(order.ad.images[0]) : "/placeholder.png"} 
                  alt="" 
                  className="h-full w-full object-cover" 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/placeholder.png";
                  }}
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 sm:gap-1">
                <Link to={`/ad/${order.ad?._id}`} className="text-sm sm:text-lg font-black text-gray-900 dark:text-white hover:text-blue-600 transition-colors line-clamp-1 sm:line-clamp-2 leading-tight">{order.ad?.title}</Link>
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 font-black text-base sm:text-lg">{order.amount?.toLocaleString()}</span>
                  <span className="text-[10px] font-black px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg uppercase tracking-wider">{formatCurrency(order.currency)}</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="p-4 sm:p-5 rounded-2xl border-2 border-gray-50 dark:border-slate-800 flex justify-between items-center sm:flex-col sm:items-start sm:gap-1">
                <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">رسوم الشحن</span>
                <span className="font-black text-gray-900 dark:text-white text-sm sm:text-base">{order.shippingFee?.toLocaleString()} {formatCurrency(order.shippingCurrency || order.currency)}</span>
              </div>
              <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/30 dark:bg-blue-900/10 border-2 border-blue-50 dark:border-blue-900/20 flex justify-between items-center sm:flex-col sm:items-start sm:gap-1">
                <span className="text-[9px] sm:text-[10px] font-black text-blue-400 uppercase tracking-widest">
                  {isSeller ? "إجمالي مستحقاتك" : "المبلغ الإجمالي"}
                </span>
                <span className="text-lg sm:text-xl font-black text-blue-600">
                  {order.currency === (order.shippingCurrency || order.currency) ? (
                    `${(isSeller ? (order.amount + (order.shippingPayer === 'buyer' && order.shippingCurrency === order.currency ? order.shippingFee : 0)) : order.totalAmount)?.toLocaleString()} ${formatCurrency(order.currency)}`
                  ) : (
                    <div className="flex flex-col items-end sm:items-start leading-tight">
                      <span>{(order.amount + (isSeller ? 0 : (order.buyerServiceFee || 0))).toLocaleString()} {formatCurrency(order.currency)}</span>
                      <span className="text-[10px] text-blue-400 font-bold mt-1">
                        + {order.shippingFee?.toLocaleString()} {formatCurrency(order.shippingCurrency)} (شحن)
                      </span>
                    </div>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Action Section */}
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] border-2 border-blue-100 dark:border-blue-900/30 shadow-2xl shadow-blue-50 dark:shadow-none space-y-6 sm:space-y-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
            
            <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-3 relative z-10">
              <div className="w-2.5 h-8 bg-blue-600 rounded-full shadow-lg shadow-blue-200"></div>
              الإجراء المطلوب
            </h3>

            <div className="relative z-10">
              {/* Seller Approval */}
              {order.status === 'PENDING_SELLER_APPROVAL' && isSeller && (
                <div className="space-y-6">
                  <div className="bg-gray-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-gray-100 dark:border-slate-800 space-y-3">
                    <p className="text-sm font-black text-gray-900 dark:text-white">معلومات المشتري وتفاصيل التوصيل:</p>
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold">
                      <div className="text-gray-400">من يتحمل التوصيل:</div>
                      <div className="text-gray-900 dark:text-white">{order.shippingPayer === 'buyer' ? 'المشتري' : 'البائع'}</div>
                      <div className="text-gray-400">رسوم التوصيل:</div>
                      <div className="text-gray-900 dark:text-white">{order.shippingFee} {formatCurrency(order.shippingCurrency || order.currency)}</div>
                      {!isSeller && (
                        <>
                          <div className="text-emerald-600">رسوم الحماية (3%):</div>
                          <div className="text-emerald-600">{order.buyerServiceFee?.toLocaleString()} {formatCurrency(order.currency)}</div>
                        </>
                      )}
                      {order.notes && (
                        <>
                          <div className="text-gray-400">ملاحظات:</div>
                          <div className="text-gray-900 dark:text-white col-span-2 mt-1 bg-white dark:bg-slate-900 p-2 rounded-lg">{order.notes}</div>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-bold text-gray-500 leading-relaxed">هل توافق على إتمام عملية البيع بناءً على التفاصيل أعلاه؟</p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={handleApprove} disabled={submitting} className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.98]">
                      {submitting ? "جاري الحفظ..." : "موافقة وتأكيد البيع"}
                    </button>
                    <button onClick={handleReject} disabled={submitting} className="flex-1 py-5 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-2xl font-black hover:bg-red-100 transition-all border border-red-100 dark:border-red-900/20">
                      {submitting ? "..." : "رفض الطلب"}
                    </button>
                  </div>
                </div>
              )}

              {/* Buyer Payment */}
              {order.status === 'AWAITING_PAYMENT' && isBuyer && (
                <div className="space-y-8">
                  <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border-2 border-amber-100 dark:border-amber-900/20 rounded-3xl">
                    <div className="space-y-4">
                      <p className="text-sm font-black text-amber-900 dark:text-amber-400 leading-relaxed mb-4">
                        يرجى تحويل المبالغ التالية إلى أحد حسابات المنصة المعتمدة:
                      </p>
                      
                      <div className="space-y-3 bg-white/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-amber-200/50 dark:border-amber-900/30 shadow-sm">
                        <div className="flex justify-between items-center pb-2 border-b border-amber-100 dark:border-amber-900/20">
                          <span className="text-xs font-bold text-gray-500">سعر المنتج:</span>
                          <span className="text-sm font-black text-gray-900 dark:text-white">
                            {order.amount?.toLocaleString()} {formatCurrency(order.currency)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-amber-100 dark:border-amber-900/20">
                          <span className="text-xs font-bold text-emerald-600">رسوم حماية المشتري (3%):</span>
                          <span className="text-sm font-black text-emerald-600">
                            +{order.buyerServiceFee?.toLocaleString()} {formatCurrency(order.currency)}
                          </span>
                        </div>
                        {order.shippingPayer === 'buyer' && order.shippingFee > 0 && (
                          <div className="flex justify-between items-center pb-2 border-b border-amber-100 dark:border-amber-900/20 animate-in fade-in slide-in-from-left duration-500">
                            <span className="text-xs font-bold text-blue-600">رسوم التوصيل:</span>
                            <span className="text-sm font-black text-blue-600">
                              +{order.shippingFee?.toLocaleString()} {formatCurrency(order.shippingCurrency || order.currency)}
                            </span>
                          </div>
                        )}
                        
                        <div className="pt-2 mt-2">
                          <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">إجمالي المطلوب تحويله:</span>
                          <div className="bg-blue-600 text-white p-4 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none">
                            {order.currency === (order.shippingCurrency || order.currency) ? (
                              <div className="text-2xl font-black text-center">
                                {order.totalAmount?.toLocaleString()} {formatCurrency(order.currency)}
                              </div>
                            ) : (
                              <div className="space-y-1 text-center">
                                <div className="text-xl font-black">
                                  {(order.amount + order.buyerServiceFee).toLocaleString()} {formatCurrency(order.currency)}
                                </div>
                                <div className="text-sm font-bold text-blue-100">
                                  + {order.shippingFee?.toLocaleString()} {formatCurrency(order.shippingCurrency)}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <p className="text-[10px] font-bold text-amber-700/70 dark:text-amber-500/70 text-center">
                        أدخل بيانات الحوالة أدناه بعد إتمام عملية التحويل للتأكيد.
                      </p>
                    </div>
                  </div>

                  {banks.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">حسابات المنصة المعتمدة</h4>
                      <BankAccountsDisplay banks={banks} />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-4">
                      <MobileSelect
                        label="البنك / الصراف المستخدم"
                        value={bankName}
                        onChange={e => setBankName(e.target.value)}
                        options={[
                          ...banks.map(bank => ({ value: bank.bankName, label: bank.bankName })),
                          { value: "other", label: "🏢 أخرى (بنك أو صراف غير مدرج)" }
                        ]}
                        placeholder="اختر البنك..."
                      />
                      
                      {bankName === "other" && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-1">اسم البنك أو الصراف الجديد</label>
                          <input 
                            value={otherBankName}
                            onChange={e => setOtherBankName(e.target.value)}
                            className="w-full mt-1.5 rounded-xl border-2 border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/5 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-all" 
                            placeholder="اكتب اسم البنك أو شركة الصرافة هنا..."
                          />
                        </div>
                      )}
                    </div>
                    <div className="sm:col-span-2 space-y-4">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">تفاصيل الدفع (سندين كحد أقصى)</label>
                      <div className="grid grid-cols-1 gap-6">
                        {[0, 1].map(idx => (
                          <div key={idx} className={`p-4 rounded-3xl border-2 transition-all ${receiptFiles[idx] ? 'border-blue-100 bg-blue-50/30' : 'border-gray-50 bg-gray-50/50'}`}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">رقم العملية {idx + 1} {idx === 1 && "(اختياري)"}</label>
                                <input 
                                  value={transactionNumbers[idx]} 
                                  onChange={e => {
                                    const newNums = [...transactionNumbers];
                                    newNums[idx] = e.target.value;
                                    setTransactionNumbers(newNums);
                                  }} 
                                  className="w-full rounded-xl border-2 border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-bold outline-none focus:border-blue-500 transition-all" 
                                  placeholder={`أدخل رقم العملية ${idx + 1}...`} 
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">سند الدفع {idx + 1} {idx === 1 && "(اختياري)"}</label>
                                <div className="relative group">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={e => {
                                      const newFiles = [...receiptFiles];
                                      newFiles[idx] = e.target.files?.[0] || null;
                                      setReceiptFiles(newFiles);
                                    }}
                                    className="hidden"
                                    id={`receipt-upload-${idx}`}
                                  />
                                  <label
                                    htmlFor={`receipt-upload-${idx}`}
                                    className="flex items-center justify-center w-full py-3 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-white dark:hover:bg-slate-800/50 transition-all"
                                  >
                                    {receiptFiles[idx] ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xl">📄</span>
                                        <span className="text-[10px] font-bold text-gray-700 truncate max-w-[120px]">{receiptFiles[idx].name}</span>
                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const newFiles = [...receiptFiles];
                                            newFiles[idx] = null;
                                            setReceiptFiles(newFiles);
                                          }}
                                          className="text-red-500 hover:text-red-700"
                                        >
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 text-gray-400">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span className="text-[10px] font-black uppercase tracking-widest">إرفاق السند {idx + 1}</span>
                                      </div>
                                    )}
                                  </label>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {order.paymentDetails?.payments?.length > 0 && (
                        <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-slate-800 space-y-3">
                          <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-widest px-1">الحوالات المرسلة سابقاً:</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {order.paymentDetails.payments.map((p, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800">
                                <div className="min-w-0">
                                  <p className="text-[9px] text-gray-400 font-bold uppercase leading-none mb-1">حوالة #{idx + 1}</p>
                                  <p className="text-xs font-black text-gray-900 dark:text-white truncate">رقم: {p.transactionNumber}</p>
                                </div>
                                <a
                                  href={uploadsUrl(p.receiptImage)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-all"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={handlePay} disabled={submitting} className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-lg shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.98]">
                    {submitting ? "جاري الإرسال..." : "تأكيد إرسال بيانات الدفع"}
                  </button>
                </div>
              )}

              {/* Payment Wait */}
              {order.status === 'AWAITING_PAYMENT_CONFIRMATION' && (
                <div className="text-center py-10 space-y-6">
                  <div className="w-20 h-20 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-3xl flex items-center justify-center mx-auto animate-bounce shadow-xl shadow-purple-100 dark:shadow-none">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">جاري مراجعة الحوالة</h4>
                    <p className="text-sm text-gray-500 font-bold max-w-xs mx-auto leading-relaxed">يقوم المسؤولون حالياً بمطابقة بيانات الحوالة. سيتم إشعارك فور تأكيد العملية.</p>
                  </div>
                </div>
              )}

              {/* Seller Shipping */}
              {order.status === 'PAID_CONFIRMED' && isSeller && (
                <div className="space-y-8">
                  <div className="p-6 bg-emerald-50 dark:bg-emerald-900/10 border-2 border-emerald-100 dark:border-emerald-900/20 rounded-3xl space-y-3">
                    <p className="text-xs sm:text-sm font-black text-emerald-800 dark:text-emerald-400 leading-relaxed">تم استلام المبلغ وتأمينه بنجاح. يرجى شحن المنتج للمشتري وتزويدنا ببيانات الشحن فوراً.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">شركة الشحن / السائق</label>
                      <input value={shippingCompany} onChange={e => setShippingCompany(e.target.value)} className="w-full rounded-2xl border-2 border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 px-5 py-4 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="اسم الشركة أو السائق..." />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">رقم التتبع / الهاتف</label>
                      <input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} className="w-full rounded-2xl border-2 border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 px-5 py-4 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="بيانات التواصل أو التتبع..." />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">صورة سند الشحن (اختياري)</label>
                      <div className="relative group">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => setShippingReceipt(e.target.files?.[0] || null)}
                          className="hidden"
                          id="shipping-receipt-upload"
                        />
                        <label
                          htmlFor="shipping-receipt-upload"
                          className="flex items-center justify-center w-full py-4 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:bg-white dark:hover:bg-slate-800/50 transition-all bg-gray-50 dark:bg-slate-800/30"
                        >
                          {shippingReceipt ? (
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">📦</span>
                              <div className="text-right">
                                <p className="text-xs font-black text-gray-900 dark:text-white truncate max-w-[200px]">{shippingReceipt.name}</p>
                                <p className="text-[9px] text-emerald-500 font-bold uppercase">تم اختيار الملف</p>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShippingReceipt(null);
                                }}
                                className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-gray-400">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              <span className="text-[10px] font-black uppercase tracking-widest">ارفق صورة السند إذا توفرت</span>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 px-2">
                    <input type="checkbox" id="confirm-ship" className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" required />
                    <label htmlFor="confirm-ship" className="text-[11px] font-bold text-gray-500 leading-tight">أؤكد أنني قمت بتسليم السلعة لشركة الشحن/السائق المذكور أعلاه وأن البيانات صحيحة.</label>
                  </div>
                  <button onClick={() => {
                    if(!document.getElementById('confirm-ship').checked) return alert('يرجى تأكيد البيانات أولاً');
                    handleShip();
                  }} disabled={submitting} className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-lg shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-[0.98]">
                    {submitting ? "جاري الحفظ..." : "تأكيد شحن المنتج"}
                  </button>
                </div>
              )}

              {/* Buyer Delivery Confirmation */}
              {order.status === 'SHIPPED' && isBuyer && (
                <div className="space-y-8">
                  <div className="p-6 bg-indigo-50 dark:bg-indigo-900/10 border-2 border-indigo-100 dark:border-indigo-900/20 rounded-3xl space-y-2">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">بيانات الشحن</p>
                    <p className="text-sm font-black text-indigo-800 dark:text-indigo-300 leading-relaxed">
                      تم الشحن عبر <span className="underline decoration-indigo-300 mx-1">{order.shippingDetails?.company}</span> برقم تتبع <span className="underline decoration-indigo-300 mx-1">{order.shippingDetails?.trackingNumber}</span>
                    </p>
                    {order.shippingDetails?.shippingReceipt && (
                      <div className="mt-4 pt-4 border-t border-indigo-200/50">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">سند الشحن المرفق:</p>
                        <a
                          href={uploadsUrl(order.shippingDetails.shippingReceipt)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-100 dark:border-slate-800 hover:shadow-lg transition-all group"
                        >
                          <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">📄</div>
                          <div className="text-right">
                            <p className="text-xs font-black text-gray-900 dark:text-white">عرض صورة السند</p>
                            <p className="text-[9px] text-gray-400 font-bold uppercase">اضغط للمعاينة</p>
                          </div>
                        </a>
                      </div>
                    )}
                  </div>
                  <button onClick={handleConfirmDelivery} disabled={submitting} className="w-full py-6 bg-emerald-600 text-white rounded-3xl font-black text-xl shadow-2xl shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-[0.98]">
                    {submitting ? "جاري التأكيد..." : "تأكيد استلام السلعة"}
                  </button>
                  <div className="space-y-2 text-center">
                    <p className="text-[10px] font-bold text-gray-400">عند الضغط، سيتم تحويل المبلغ لحساب البائع فوراً.</p>
                    <p className="text-[11px] font-black text-red-500 bg-red-50 dark:bg-red-900/10 py-2 px-4 rounded-xl border border-red-100 dark:border-red-900/20 inline-block">
                      ⚠️ تنبيه: في حال عدم تأكيد الاستلام يدوياً، سيقوم النظام بتأكيد الطلب وتحرير المبلغ للبائع تلقائياً بعد مرور 7 أيام من تاريخ الشحن. في حالة وجود نزاع مفتوح، سيتم تعليق التحويل التلقائي ولن يتم تحرير المبلغ إلا بعد حل النزاع نهائياً.
                    </p>
                  </div>
                </div>
              )}

              {/* Completed */}
              {(order.status === 'DELIVERED' || order.status === 'COMPLETED') && (
                <div className="text-center py-10 space-y-6">
                  <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-50 dark:shadow-none">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <h4 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">عملية ناجحة</h4>
                      <p className="text-sm text-gray-500 font-bold max-w-xs mx-auto leading-relaxed">تم إغلاق الطلب وتحرير المبلغ بنجاح. شكراً لاستخدامك الشراء الآمن.</p>
                    </div>
                    
                    {isBuyer && !isReviewed && (
                      <button 
                        onClick={() => setShowReviewModal(true)}
                        className="mt-4 px-8 py-4 bg-amber-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-amber-100 hover:bg-amber-600 transition-all flex items-center justify-center gap-3 mx-auto"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                        تقييم البائع الآن
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Status specific info messages */}
              {(order.status === 'PENDING_SELLER_APPROVAL' && isBuyer) && (
                <div className="text-center py-8 bg-gray-50 dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-slate-800">
                  <p className="text-sm font-black text-gray-500 animate-pulse">بانتظار موافقة البائع على طلبك...</p>
                </div>
              )}
              {(order.status === 'AWAITING_PAYMENT' && isSeller) && (
                <div className="text-center py-8 bg-gray-50 dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-slate-800">
                  <p className="text-sm font-black text-gray-500 animate-pulse">بانتظار قيام المشتري بالدفع وإرسال البيانات...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Summary */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2.5rem] border-2 border-gray-50 dark:border-slate-800 shadow-lg shadow-gray-50 dark:shadow-none space-y-6">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] px-1">أطراف العملية</h3>
            
            <div className="space-y-5">
              <div className="flex items-center gap-4 group">
                <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center font-black text-lg shadow-sm group-hover:scale-110 transition-transform">
                  {order.buyer?.name?.slice(0,1)}
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">المشتري</span>
                  <span className="text-sm font-black text-gray-900 dark:text-white truncate block">{order.buyer?.name}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 group">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center font-black text-lg shadow-sm group-hover:scale-110 transition-transform">
                  {order.seller?.name?.slice(0,1)}
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">البائع</span>
                  <span className="text-sm font-black text-gray-900 dark:text-white truncate block">{order.seller?.name}</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-50 dark:border-slate-800 space-y-4">
              <button onClick={openChatWithOtherParty} disabled={convOpening} className="w-full py-4 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-2xl text-xs font-black hover:bg-gray-100 transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                {convOpening ? "جاري الفتح..." : "محادثة الطرف الآخر"}
              </button>
              {order.status !== 'DISPUTED' && order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                <button onClick={() => setShowDisputeModal(true)} className="w-full py-2 text-red-500 text-[10px] font-black uppercase tracking-widest hover:underline transition-all">فتح نزاع أو شكوى مالية</button>
              )}
            </div>
          </div>

          <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-blue-100 dark:shadow-none space-y-4 relative overflow-hidden group">
            <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            <div className="relative z-10 space-y-2">
              <h4 className="text-xs font-black uppercase tracking-widest text-blue-100">نظام حماية سوقك</h4>
              <p className="text-[11px] font-bold text-blue-50/80 leading-relaxed">أموالك في أمان. لا يتم تسليم المبلغ للبائع إلا بعد تأكيد استلامك للسلعة ومطابقتها للمواصفات.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Seller Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-3xl w-full max-w-lg p-8 sm:p-10 space-y-8 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 border border-gray-50 dark:border-slate-800 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden shadow-inner mb-2">
              <div className="flex items-center gap-4 p-4">
                <div className="h-16 w-16 rounded-xl bg-white dark:bg-slate-800 overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm shrink-0 group">
                  <img 
                    src={order.ad?.images?.[0] ? uploadsUrl(order.ad.images[0]) : "/placeholder.png"} 
                    alt="" 
                    className="h-full w-full object-cover transition-transform group-hover:scale-110" 
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <h4 className="text-sm font-black text-gray-900 dark:text-white line-clamp-1 leading-tight">
                    {order.ad?.title}
                  </h4>
                  <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-600">
                      <span className="w-1 h-1 rounded-full bg-current"></span>
                      شراء عبر المنصة
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                      بتاريخ {new Date(order.createdAt).toLocaleDateString("ar-YE")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-8">
              {/* Criteria Ratings */}
              <div className="space-y-6">
                {[
                  { id: 'reliability', label: 'المصداقية (مطابقة الوصف)', color: 'text-emerald-500', bg: 'bg-emerald-50' },
                  { id: 'communication', label: 'التواصل وسرعة الرد', color: 'text-blue-500', bg: 'bg-blue-50' },
                  { id: 'deliverySpeed', label: 'سرعة التسليم والتجاوب', color: 'text-amber-500', bg: 'bg-amber-50' }
                ].map((item) => (
                  <div key={item.id} className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{item.label}</label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          onClick={() => setReviewData(prev => ({ ...prev, [item.id]: s }))}
                          className={`flex-1 h-12 rounded-2xl flex items-center justify-center transition-all ${
                            reviewData[item.id] >= s ? `${item.bg} ${item.color} shadow-sm scale-105 border-2 border-current/20` : 'bg-gray-50 dark:bg-slate-800 text-gray-300'
                          }`}
                        >
                          <svg className={`w-6 h-6 ${reviewData[item.id] >= s ? 'fill-current' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">اكتب رأيك بالتفصيل (10 أحرف على الأقل)</label>
                <textarea 
                  value={reviewData.comment}
                  onChange={e => setReviewData(prev => ({ ...prev, comment: e.target.value }))}
                  className="w-full rounded-2xl border-2 border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 px-5 py-4 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all resize-none h-32" 
                  placeholder="كيف كانت تجربتك مع البائع؟ هل تنصح الآخرين بالتعامل معه؟"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">أضف صور (اختياري)</label>
                <div className="flex flex-wrap gap-3">
                  {reviewData.images.map((img, idx) => (
                    <div key={idx} className="relative h-16 w-16 rounded-2xl overflow-hidden border-2 border-gray-100 group">
                      <img src={URL.createObjectURL(img)} alt="" className="h-full w-full object-cover" />
                      <button 
                        onClick={() => setReviewData(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }))}
                        className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  {reviewData.images.length < 3 && (
                    <label className="h-16 w-16 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-all cursor-pointer bg-gray-50">
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        multiple 
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setReviewData(prev => ({ ...prev, images: [...prev.images, ...files].slice(0, 3) }));
                        }} 
                      />
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </label>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setShowReviewModal(false)} className="flex-1 py-4 text-gray-400 text-xs font-black uppercase tracking-widest hover:text-gray-600 transition-all">إلغاء</button>
                <button 
                  onClick={handlePostReview} 
                  disabled={submitting || reviewData.comment.length < 10} 
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95"
                >
                  {submitting ? "جاري الإرسال..." : "إرسال التقييم"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dispute Modal - Improved Design */}
      {showDisputeModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-t-[2.5rem] sm:rounded-3xl w-full max-w-lg p-8 sm:p-10 space-y-8 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 border border-gray-50 dark:border-slate-800">
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">فتح نزاع مالي</h3>
              <p className="text-xs font-bold text-gray-400 leading-relaxed">يرجى توضيح المشكلة بدقة ليتسنى لفريق الإدارة مراجعة الطلب واتخاذ القرار المناسب.</p>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">سبب النزاع الرئيسي</label>
                <select value={disputeReason} onChange={e => setDisputeReason(e.target.value)} className="w-full rounded-2xl border-2 border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 px-5 py-4 text-sm font-bold outline-none focus:border-red-500 focus:bg-white transition-all appearance-none">
                  <option value="">اختر السبب...</option>
                  <option value="item_not_received">لم يتم تسليم السلعة نهائياً</option>
                  <option value="item_not_as_described">السلعة تختلف جذرياً عن الوصف</option>
                  <option value="seller_not_responding">البائع توقف عن الرد تماماً</option>
                  <option value="other">سبب تقني أو إداري آخر</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">شرح تفصيلي للمشكلة</label>
                <textarea value={disputeDetails} onChange={e => setDisputeDetails(e.target.value)} className="w-full rounded-2xl border-2 border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 px-5 py-4 text-sm font-medium outline-none focus:border-red-500 focus:bg-white transition-all h-36 resize-none" placeholder="اكتب كل التفاصيل التي تساعدنا في حل النزاع..." />
              </div>
            </div>
            <div className="flex flex-col gap-3 pb-6 sm:pb-0">
              <button onClick={handleDispute} disabled={submitting} className="w-full py-5 bg-red-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-red-100 hover:bg-red-700 transition-all active:scale-[0.98]">
                {submitting ? "جاري الإرسال..." : "تأكيد فتح النزاع"}
              </button>
              <button onClick={() => setShowDisputeModal(false)} className="w-full py-4 bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 rounded-2xl font-black text-sm hover:bg-gray-100 transition-all">إلغاء وإغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
