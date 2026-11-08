import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import AuctionCard from "../components/AuctionCard.jsx";
import {
  auctionSaleStatusLabel,
  getAuctionError
} from "../utils/auctionFormat.js";

export default function MyAuctions() {
  const api = useApi();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [reportingId, setReportingId] = useState("");
  const [disputeReason, setDisputeReason] = useState("");

  const loadAuctions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/auctions/mine", {
        params: { page: 1, pageSize: 50 }
      });
      setAuctions(response.data.items || []);
    } catch (requestError) {
      setError(getAuctionError(requestError));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadAuctions();
  }, [loadAuctions]);

  const cancelAuction = async (auctionId) => {
    setBusyId(auctionId);
    setError("");
    try {
      await api.post(`/auctions/${auctionId}/cancel`, {
        reason: "طلب صاحب المزاد"
      });
      await loadAuctions();
    } catch (requestError) {
      setError(getAuctionError(requestError));
    } finally {
      setBusyId("");
    }
  };

  const updateCompletion = async (auctionId, action, reason = "") => {
    setBusyId(auctionId);
    setError("");
    try {
      await api.post(`/auctions/${auctionId}/completion`, { action, reason });
      setReportingId("");
      setDisputeReason("");
      await loadAuctions();
    } catch (requestError) {
      setError(getAuctionError(requestError));
    } finally {
      setBusyId("");
    }
  };

  return (
    <section dir="rtl" className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">مزاداتي</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">حالة مزاداتك ونتائجها من حسابك.</p>
        </div>
        <Link to="/auctions/new" className="rounded-xl bg-blue-700 px-4 py-2 font-bold text-white">
          إنشاء مزاد
        </Link>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">جارٍ تحميل مزاداتك…</p>
      ) : auctions.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {auctions.map((auction) => (
            <div key={auction.id} className="space-y-2">
              <AuctionCard auction={auction} ownerView />
              <div className="flex flex-wrap gap-2">
                {auction.participantRole === "seller" && ["draft", "rejected"].includes(auction.status) && (
                  <>
                    <Link
                      to={`/auctions/new?id=${auction.id}`}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold dark:border-slate-600"
                    >
                      تعديل البيانات
                    </Link>
                  </>
                )}
                {auction.participantRole === "seller" &&
                  ["scheduled", "live"].includes(auction.status) &&
                  auction.reviewStatus === "approved" &&
                  auction.bidCount === 0 &&
                  auction.categoryDocuments?.items?.length > 0 && (
                    <Link
                      to={`/auctions/new?id=${auction.id}`}
                      className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-bold text-amber-800"
                    >
                      تعديل بيانات الفئة وإعادة المراجعة
                    </Link>
                  )}
                {auction.participantRole === "seller" && auction.categoryDocuments?.status && (
                  <p className="w-full text-xs text-slate-600 dark:text-slate-300">
                    حالة وثائق الفئة: {categoryDocumentStatusText(auction.categoryDocuments.status)}
                  </p>
                )}
                {auction.participantRole === "seller" && (auction.status === "draft" || auction.status === "scheduled") && (
                  <button
                    type="button"
                    disabled={busyId === auction.id}
                    onClick={() => cancelAuction(auction.id)}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50"
                  >
                    إلغاء المزاد
                  </button>
                )}
              </div>
              {auction.status === "ended" && auction.winner && (
                <div className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <p className="font-bold">{auction.participantRole === "winner" ? "أنت الفائز بهذا المزاد." : `الفائز: ${auction.winner.name || "تم تحديد الفائز"}`}</p>
                  {auction.participantRole === "seller" && auction.winner.phone && (
                    <p>رقم التواصل: {auction.winner.phone}</p>
                  )}
                  {auction.participantRole === "winner" && auction.sellerContact && (
                    <p>رقم تواصل البائع: {auction.sellerContact}</p>
                  )}
                  <p>{auctionSaleStatusLabel(auction.saleStatus)}</p>
                  {auction.saleStatus === "awaiting_confirmation" && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={busyId === auction.id} onClick={() => updateCompletion(auction.id, "confirm")} className="rounded-lg bg-emerald-700 px-3 py-2 font-bold text-white disabled:opacity-50">
                        تأكيد إتمام الصفقة
                      </button>
                      {reportingId === auction.id ? (
                        <form
                          className="flex min-w-full gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            updateCompletion(auction.id, "report", disputeReason);
                          }}
                        >
                          <input value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} required minLength={3} maxLength={1000} placeholder="اشرح المشكلة المرتبطة بالصفقة" className="min-w-0 flex-1 rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-800" />
                          <button type="submit" disabled={busyId === auction.id} className="rounded-lg border border-red-300 px-3 py-2 font-bold text-red-700 disabled:opacity-50">إرسال البلاغ</button>
                        </form>
                      ) : (
                        <button type="button" onClick={() => setReportingId(auction.id)} className="rounded-lg border border-red-300 px-3 py-2 font-bold text-red-700">الإبلاغ عن مشكلة</button>
                      )}
                    </div>
                  )}
                  {auction.saleStatus === "disputed" && auction.disputeReason && (
                    <p className="rounded-lg bg-amber-50 p-3 text-amber-900">تفاصيل البلاغ: {auction.disputeReason}</p>
                  )}
                </div>
              )}
              {auction.rejectionReason && (
                <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                  سبب الرفض: {auction.rejectionReason}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-8 text-center dark:bg-slate-900">
          <p className="text-slate-600 dark:text-slate-300">لم تنشئ مزادات بعد.</p>
          <Link to="/auctions/new" className="mt-4 inline-block font-bold text-blue-700">ابدأ بإنشاء مزاد</Link>
        </div>
      )}
    </section>
  );
}

function categoryDocumentStatusText(status) {
  return ({
    missing: "مفقودة",
    pending_review: "بانتظار المراجعة",
    approved: "معتمدة",
    rejected: "مرفوضة"
  })[status] || "غير محددة";
}
