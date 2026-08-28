import React, { useEffect, useState, useMemo } from "react";
import { useApi } from "../api/axios.js";
import { Link } from "react-router-dom";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { useAuth } from "../store/AuthContext.jsx";

const AD_IMAGE_PLACEHOLDER = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f3f4f6;stop-opacity:1"/><stop offset="100%" style="stop-color:#e5e7eb;stop-opacity:1"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><circle cx="200" cy="170" r="50" fill="#d1d5db"/><path d="M100 300 Q200 220 300 300 L300 340 L100 340 Z" fill="#d1d5db"/><text x="200" y="380" font-family="Arial,sans-serif" font-size="18" font-weight="bold" fill="#9ca3af" text-anchor="middle">صورة المنتج غير متوفرة</text></svg>`);

function uploadsBaseUrl() {
  let envUrl = import.meta.env.VITE_UPLOADS_URL;
  if (!envUrl) {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    envUrl = apiBase.replace(/\/api$/, "").replace(/\/$/, "") + "/uploads";
  }
  if (envUrl.endsWith("/uploads")) return envUrl;
  return envUrl.endsWith("/") ? `${envUrl}uploads` : `${envUrl}/uploads`;
}
const _UPLOADS_BASE = uploadsBaseUrl();
const _BUILT_URL_CACHE = new Map();
const SENSITIVE_KWS = ["receipts", "ids", "kyc", "documents"];

function buildSecureFileUrl(filename, token) {
  if (!filename) return "";
  if (filename.startsWith("http")) return filename;
  let clean = filename;
  if (filename.startsWith("/uploads/")) clean = filename.replace("/uploads/", "");
  else if (filename.startsWith("uploads/")) clean = filename.replace("uploads/", "");
  const base = `${_UPLOADS_BASE}/${clean}`;
  const isSensitive = SENSITIVE_KWS.some(kw => {
    const c = clean.toLowerCase().replace(/\\/g, "/");
    return c.startsWith(kw + "/") || c.includes("/" + kw + "/") || c === kw;
  });
  if (!isSensitive) return base;
  if (!token) return base;
  const cacheKey = `${clean}|${token ? token.substring(0, 20) : ""}`;
  if (_BUILT_URL_CACHE.has(cacheKey)) return _BUILT_URL_CACHE.get(cacheKey);
  const sep = base.includes("?") ? "&" : "?";
  const final = `${base}${sep}access_token=${encodeURIComponent(token)}`;
  _BUILT_URL_CACHE.set(cacheKey, final);
  return final;
}

export default function OrdersList({ type }) { // type: 'buyer' or 'seller'
  const api = useApi();
  const { token: authToken } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/orders/${type}`);
      setOrders(res.data);
    } catch (err) {
      console.error("Load orders error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [type]);

  const getStatusInfo = (status) => {
    const map = {
      PENDING_SELLER_APPROVAL: { label: "بانتظار موافقة البائع", color: "bg-amber-100 text-amber-700" },
      AWAITING_PAYMENT: { label: "بانتظار الدفع", color: "bg-blue-100 text-blue-700" },
      AWAITING_PAYMENT_CONFIRMATION: { label: "بانتظار تأكيد الإدارة", color: "bg-purple-100 text-purple-700" },
      PAID_CONFIRMED: { label: "تم تأكيد الدفع", color: "bg-emerald-100 text-emerald-700" },
      SHIPPED: { label: "تم الشحن", color: "bg-indigo-100 text-indigo-700" },
      DELIVERED: { label: "تم الاستلام", color: "bg-green-100 text-green-700" },
      COMPLETED: { label: "مكتمل", color: "bg-gray-100 text-gray-700" },
      DISPUTED: { label: "نزاع مفتوح", color: "bg-red-100 text-red-700" },
      CANCELLED: { label: "ملغي", color: "bg-red-50 text-red-400" }
    };
    return map[status] || { label: status, color: "bg-gray-100 text-gray-600" };
  };

  if (loading) return <div className="py-10 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-xl font-black text-gray-900 dark:text-white">
          {type === 'buyer' ? "مشترياتي الآمنة" : "مبيعاتي الآمنة"}
        </h2>
        <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded-full">
          {orders.length} طلبات
        </span>
      </div>

      <div className="grid gap-4">
        {orders.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-gray-200 dark:border-slate-800">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden border border-gray-100 dark:border-slate-700">
              <img src="/assets/logo/app-icon.svg" alt="سوقك" className="w-10 h-10 object-contain" />
            </div>
            <p className="text-gray-500 font-bold">لا توجد طلبات شراء آمنة حالياً.</p>
          </div>
        ) : (
          orders.map((order) => (
            <Link 
              key={order._id} 
              to={`/orders/${order._id}`}
              className="group flex flex-col sm:flex-row gap-4 p-4 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 hover:shadow-xl hover:shadow-gray-100 dark:hover:shadow-none transition-all active:scale-[0.98]"
            >
              {/* Product Image */}
              <div className="h-24 w-full sm:w-32 rounded-2xl bg-gray-50 dark:bg-slate-800 overflow-hidden flex-shrink-0">
                <img 
                  src={buildSecureFileUrl(order.ad?.images?.[0] || "", authToken) || AD_IMAGE_PLACEHOLDER} 
                  alt={order.ad?.title || "صورة المنتج"} 
                  className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                  onError={(e) => {
                    if (e.target.src !== AD_IMAGE_PLACEHOLDER) {
                      console.log(`[OrdersList] Image failed for order ${order._id}: ${order.ad?.images?.[0] || 'NO_IMAGE'}`);
                      e.target.onerror = null;
                      e.target.src = AD_IMAGE_PLACEHOLDER;
                    }
                  }}
                />
              </div>

              {/* Order Info */}
              <div className="flex-1 flex flex-col justify-between min-w-0 py-1">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-black text-gray-900 dark:text-white line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {order.ad?.title}
                    </h3>
                    <span className="text-[10px] font-bold text-gray-400 font-mono">#{order._id.slice(-6).toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-black text-blue-600">{order.totalAmount?.toLocaleString()} {order.currency}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-500 font-medium">
                      {type === 'buyer' ? `البائع: ${order.seller?.name}` : `المشتري: ${order.buyer?.name}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusInfo(order.status).color}`}>
                    {getStatusInfo(order.status).label}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {new Date(order.createdAt).toLocaleDateString("ar-EG")}
                  </span>
                </div>
              </div>

              {/* Action Arrow */}
              <div className="hidden sm:flex items-center px-2">
                <div className="h-8 w-8 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center text-gray-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
