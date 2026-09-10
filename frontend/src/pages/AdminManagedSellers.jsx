import React, { useEffect, useState } from "react";
import { useApi } from "../api/axios.js";
import { useNavigate } from "react-router-dom";
import { uploadsUrl } from "../lib/uploads.js";

const statusLabels = {
  claim_pending: "يدار من قبل الإدارة فقط",
  claimed: "مستلم من قبل البائع",
  managed: "يدار من قبل الإدارة فقط"
};

const adStatusLabels = {
  admin_draft: "مسودة بانتظار النشر",
  approved: "منشور",
  pending: "قيد المراجعة",
  sold: "مباع",
  archived: "مؤرشف",
  expired: "منتهي"
};

const formatDate = (value) => value ? new Date(value).toLocaleString("ar-YE", { dateStyle: "medium", timeStyle: "short" }) : "-";

export default function AdminManagedSellers() {
  const api = useApi();
  const navigate = useNavigate();
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [publishingId, setPublishingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/managed-sellers");
      setSellers(response.data || []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "تعذر تحميل معلومات البائعين.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const publishAd = async (adId) => {
    if (!window.confirm("هل تريد نشر هذا الإعلان الآن؟ سيظهر للجمهور وتبدأ مدة الإعلان من هذه اللحظة.")) return;
    setPublishingId(adId);
    try {
      await api.patch(`/admin/managed-sellers/ads/${adId}/publish`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "تعذر نشر الإعلان.");
    } finally {
      setPublishingId(null);
    }
  };

  if (loading) return <div className="py-20 text-center text-sm font-bold text-gray-500">جاري تحميل البائعين المدارين...</div>;

  return (
    <div className="w-full min-w-0 space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 sm:text-2xl">معلومات البائعين المدارين</h1>
          <p className="mt-1 text-xs leading-5 text-gray-500 sm:text-sm">البائعون الذين أنشأ الأدمن حساباتهم وإعلاناتهم من المنصة.</p>
        </div>
        <button onClick={() => navigate("/admin/managed-sellers/new-ad")} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700 sm:w-auto">إنشاء بائع وإعلان</button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      {!error && sellers.length === 0 && <div className="rounded-2xl border border-gray-100 bg-white p-12 text-center text-sm font-bold text-gray-500">لا يوجد بائعون أنشأهم الأدمن حتى الآن.</div>}

      <div className="space-y-4">
        {sellers.map((seller) => {
          const sellerAds = seller.ads || [];
          const isOpen = expanded === seller._id;
          const views = sellerAds.reduce((sum, ad) => sum + (ad.viewCount || 0), 0);
          const contacts = sellerAds.reduce((sum, ad) => sum + (ad.contactsCount || 0), 0);
          return (
            <article key={seller._id} className="min-w-0 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-black text-gray-900 sm:text-lg">{seller.name}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black sm:px-3 sm:text-[11px] ${seller.managedAccount?.status === "claimed" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                      {statusLabels[seller.managedAccount?.status] || "غير محدد"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-2 sm:text-sm lg:grid-cols-4">
                    <span>الهاتف: <b className="text-gray-900">{seller.phone || "-"}</b></span>
                    <span>الإعلانات: <b className="text-gray-900">{sellerAds.length}</b></span>
                    <span>المشاهدات: <b className="text-gray-900">{views.toLocaleString("ar-YE")}</b></span>
                    <span>التواصل: <b className="text-gray-900">{contacts.toLocaleString("ar-YE")}</b></span>
                  </div>
                  <div className="mt-3 grid gap-2 text-[11px] text-gray-500 sm:grid-cols-2 sm:text-xs">
                    <span>إنشاء الحساب: {formatDate(seller.managedAccount?.createdAt || seller.createdAt)}</span>
                    <span>استلام الحساب: {formatDate(seller.managedAccount?.claimedAt)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap">
                  <button onClick={() => navigate(`/admin/managed-sellers/new-ad?sellerId=${seller._id}`)} className="rounded-xl bg-blue-50 px-2 py-2 text-[11px] font-black text-blue-700 hover:bg-blue-100 sm:px-3 sm:text-xs">إضافة إعلان</button>
                  <button onClick={() => setExpanded(isOpen ? null : seller._id)} className="rounded-xl border border-gray-200 px-2 py-2 text-[11px] font-black text-gray-700 hover:bg-gray-50 sm:px-3 sm:text-xs">{isOpen ? "إخفاء الإعلانات" : "عرض الإعلانات"}</button>
                </div>
              </div>

              {isOpen && <div className="border-t border-gray-100 bg-gray-50/60 p-4 sm:p-5">
                <div className="mb-4 break-words rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-6 text-amber-800 sm:text-sm">
                  <b>كلمة المرور التي أنشأها النظام:</b> <span className="select-all font-mono">{seller.managedAccount?.initialPassword || seller.temporaryPassword || "غير متاحة"}</span>
                </div>
                <div className="grid gap-3 xl:grid-cols-2">
                  {sellerAds.map((ad) => <div key={ad._id} className="rounded-xl border border-gray-100 bg-white p-4">
                    <div className="flex gap-3">
                      {ad.images?.[0] && <img src={uploadsUrl(ad.images[0], "thumb")} alt="" className="h-16 w-20 rounded-lg object-cover" />}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-black text-gray-900">{ad.title}</h3>
                        <p className="mt-1 text-xs text-gray-500">الحالة: <b className={ad.status === "admin_draft" ? "text-amber-700" : "text-green-700"}>{adStatusLabels[ad.status] || ad.status}</b></p>
                        <p className="mt-1 text-[11px] text-gray-400">الإنشاء: {formatDate(ad.createdAt)} | النشر: {formatDate(ad.publishedAt)} | الانتهاء: {formatDate(ad.expiresAt)}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-gray-600 sm:grid-cols-4">
                      <span>مشاهدات: {ad.viewCount || 0}</span>
                      <span>تواصل: {ad.contactsCount || 0}</span>
                      <span>هاتف: {ad.phoneClicks || 0}</span>
                      <span>واتساب: {ad.whatsappClicks || 0}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button onClick={() => navigate(`/edit-ad/${ad._id}`)} className="w-full rounded-lg border border-blue-100 bg-blue-50 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">تعديل الإعلان</button>
                      {ad.status === "admin_draft" && <button disabled={publishingId === ad._id} onClick={() => publishAd(ad._id)} className="w-full rounded-lg bg-green-600 py-2 text-xs font-black text-white hover:bg-green-700 disabled:opacity-60">{publishingId === ad._id ? "جاري النشر..." : "نشر الإعلان"}</button>}
                    </div>
                  </div>)}
                </div>
              </div>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
