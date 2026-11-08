import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api/axios.js";
import { uploadsUrl } from "../lib/uploads.js";
import {
  auctionDeliveryMethodLabel,
  auctionSaleStatusLabel,
  auctionStatusLabel,
  formatAuctionDate,
  formatAuctionMoney,
  getAuctionError
} from "../utils/auctionFormat.js";

const FILTERS = [
  ["review", "بانتظار المراجعة"],
  ["documents", "وثائق بانتظار المراجعة"],
  ["scheduled", "مجدولة"],
  ["live", "مباشرة"],
  ["ended", "منتهية"],
  ["disputed", "بلاغات الصفقات"],
  ["cancelled", "ملغاة"],
  ["rejected", "مرفوضة"]
];
export default function AdminAuctions() {
  const api = useApi();
  const [status, setStatus] = useState("review");
  const [page, setPage] = useState(1);
  const [auctions, setAuctions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [selected, setSelected] = useState(null);
  const [bids, setBids] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [documentRejectionReason, setDocumentRejectionReason] = useState("");
  const [documentReviewNotes, setDocumentReviewNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/admin/auctions", {
        params: { status, page, pageSize: 30 }
      });
      setAuctions(response.data.items || []);
      setPagination(response.data.pagination || { total: 0, totalPages: 0 });
    } catch (requestError) {
      setError(getAuctionError(requestError));
    } finally {
      setLoading(false);
    }
  }, [api, page, status]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadDetail = async (auctionId) => {
    setError("");
    try {
      const [detailResponse, bidsResponse] = await Promise.all([
        api.get(`/admin/auctions/${auctionId}`),
        api.get(`/admin/auctions/${auctionId}/bids`)
      ]);
      setSelected({
        ...detailResponse.data.auction,
        categoryRequirements: detailResponse.data.categoryRequirements,
        publicationChecks: detailResponse.data.publicationChecks,
        publicationReasons: detailResponse.data.publicationReasons || [],
        missingRequirements: detailResponse.data.missingRequirements || []
      });
      setBids(bidsResponse.data.items || []);
      setAuditLog(detailResponse.data.auditLog || []);
      setRejectionReason("");
      setCancellationReason("");
      setDocumentRejectionReason("");
      setDocumentReviewNotes("");
    } catch (requestError) {
      setError(getAuctionError(requestError));
    }
  };

  const runAction = async (path, body = {}) => {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      await api.patch(`/admin/auctions/${selected.id}/${path}`, body);
      setSelected(null);
      setBids([]);
      setAuditLog([]);
      await loadList();
    } catch (requestError) {
      setError(getAuctionError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const reviewCategoryDocument = async (documentId, decision) => {
    if (!selected) return;
    if (decision === "approved" && documentReviewNotes.trim().length < 3) {
      setError("دوّن ملاحظات مقارنة البيانات بالوثيقة قبل اعتمادها.");
      return;
    }
    if (decision === "rejected" && documentRejectionReason.trim().length < 3) {
      setError("أدخل سببًا واضحًا لرفض الوثيقة.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.patch(`/admin/auctions/${selected.id}/documents/${documentId}/review`, {
        decision,
        notes: decision === "approved" ? documentReviewNotes : "",
        reason: decision === "rejected" ? documentRejectionReason : ""
      });
      setDocumentRejectionReason("");
      setDocumentReviewNotes("");
      await loadDetail(selected.id);
      await loadList();
    } catch (requestError) {
      setError(getAuctionError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const downloadCategoryDocument = async (documentId) => {
    if (!selected) return;
    setError("");
    try {
      const response = await api.get(
        `/admin/auctions/${selected.id}/documents/${documentId}/file`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(response.data);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = "auction-document";
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(getAuctionError(requestError));
    }
  };

  const changeFilter = (nextStatus) => {
    setSelected(null);
    setPage(1);
    setStatus(nextStatus);
  };
  return (
    <section dir="rtl" className="space-y-5">
      <header className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">إدارة المزادات</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          مراجعة الطلبات وإدارة المزادات ونتائجها.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-amber-200 bg-white p-5 dark:border-amber-900 dark:bg-slate-900">
        <div>
          <h2 className="font-black">متطلبات الوثائق الثابتة</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            تُحدد المتطلبات مسبقًا حسب التصنيف. دور الإدارة مراجعة الوثائق وقرار نشر المزاد، وليس إنشاء أنواع الوثائق.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b dark:border-slate-700">
                <th className="px-3 py-2">التصنيف</th>
                <th className="px-3 py-2">الوثيقة</th>
                <th className="px-3 py-2">المتطلب</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["السيارات", "إثبات ملكية المركبة / استمارة المركبة"],
                ["السيارات", "هوية مالك المركبة"]
              ].map(([category, document]) => (
                <tr key={document} className="border-b last:border-0 dark:border-slate-800">
                  <td className="px-3 py-2">{category}</td>
                  <td className="px-3 py-2">{document}</td>
                  <td className="px-3 py-2 font-bold">مطلوبة ومراجعتها إدارية</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          العقارات غير قابلة للنشر العام حتى اعتماد سياسة وثائقها.
        </p>
      </section>

      <div className="flex gap-2 overflow-x-auto rounded-2xl bg-white p-3 dark:bg-slate-900">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => changeFilter(value)}
            className={`shrink-0 rounded-xl px-3 py-2 text-sm font-bold ${status === value ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">جارٍ تحميل المزادات…</p>
      ) : auctions.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {auctions.map((auction) => (
            <button
              key={auction.id}
              type="button"
              onClick={() => loadDetail(auction.id)}
              className="flex w-full gap-4 rounded-2xl border border-slate-200 bg-white p-3 text-right hover:border-blue-400 dark:border-slate-700 dark:bg-slate-900"
            >
              {auction.images?.[0] && (
                <img src={uploadsUrl(auction.images[0], "thumb")} alt="" className="h-24 w-28 shrink-0 rounded-xl object-cover" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{auction.title}</span>
                <span className="mt-1 block text-xs text-slate-500">{auction.owner?.name || "صاحب المزاد"}</span>
                <span className="mt-1 block text-xs text-slate-500">{auction.saleStatus === "disputed" ? auctionSaleStatusLabel("disputed") : auctionStatusLabel(auction.reviewStatus === "pending" ? "pending" : auction.status)}</span>
                <span className="mt-1 block text-sm font-bold text-blue-700">{formatAuctionMoney(auction.currentPrice, auction.currency)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-white p-8 text-center text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          لا توجد مزادات في هذا القسم.
        </p>
      )}

      <nav aria-label="صفحات إدارة المزادات" className="flex items-center justify-center gap-3">
        <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">السابق</button>
        <span className="text-sm">{page} من {Math.max(1, pagination.totalPages)}</span>
        <button type="button" disabled={loading || page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">التالي</button>
      </nav>

      {selected && (
        <div role="dialog" aria-modal="true" aria-labelledby="auction-review-title" className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/60 p-3 sm:p-8">
          <section className="mx-auto max-w-3xl space-y-4 rounded-2xl bg-white p-5 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 id="auction-review-title" className="text-xl font-black">{selected.title}</h2>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border px-3 py-2 text-sm">إغلاق</button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {selected.images?.map((image, index) => (
                <figure key={`${image}-${index}`} className="rounded-xl bg-slate-100 p-2 dark:bg-slate-800">
                  <img src={uploadsUrl(image, "med")} alt="" className="h-48 w-full object-contain" />
                  <figcaption className="text-xs">{auctionImageLabel(selected.imageLabels?.[index])}</figcaption>
                </figure>
              ))}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6">{selected.description}</p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-500">صاحب المزاد</dt><dd className="font-bold">{selected.owner?.name || "—"} {selected.owner?.phone ? `(${selected.owner.phone})` : ""}</dd></div>
              <div><dt className="text-slate-500">الفئة</dt><dd className="font-bold">{selected.category?.name || "—"}</dd></div>
              <div><dt className="text-slate-500">الموقع</dt><dd className="font-bold">{[selected.city?.name, selected.governorate?.name].filter(Boolean).join("، ") || "—"}</dd></div>
              <div><dt className="text-slate-500">السعر الحالي</dt><dd className="font-bold">{formatAuctionMoney(selected.currentPrice, selected.currency)}</dd></div>
              <div><dt className="text-slate-500">مدة المزاد</dt><dd className="font-bold">{selected.durationLabel}</dd></div>
              <div><dt className="text-slate-500">بداية المزاد</dt><dd className="font-bold">{formatAuctionDate(selected.startAt)}</dd></div>
              <div><dt className="text-slate-500">نهاية المزاد</dt><dd className="font-bold">{formatAuctionDate(selected.endAt)}</dd></div>
              <div><dt className="text-slate-500">حالة السلعة</dt><dd className="whitespace-pre-wrap font-bold">{selected.itemCondition}</dd></div>
              <div><dt className="text-slate-500">العيوب والملاحظات</dt><dd className="whitespace-pre-wrap font-bold">{selected.defectsNotes}</dd></div>
              <div><dt className="text-slate-500">طريقة التسليم والاستلام</dt><dd className="font-bold">{auctionDeliveryMethodLabel(selected.deliveryMethod)}</dd></div>
              <div className="sm:col-span-2"><dt className="text-slate-500">تفاصيل التسليم والاستلام</dt><dd className="whitespace-pre-wrap font-bold">{selected.deliveryDetails}</dd></div>
              {selected.saleStatus && selected.saleStatus !== "not_applicable" && (
                <div><dt className="text-slate-500">متابعة الصفقة</dt><dd className="font-bold">{auctionSaleStatusLabel(selected.saleStatus)}</dd></div>
              )}
              {selected.disputeReason && (
                <div className="sm:col-span-2"><dt className="text-slate-500">تفاصيل البلاغ</dt><dd className="whitespace-pre-wrap font-bold">{selected.disputeReason}</dd></div>
              )}
            </dl>
            {selected.categoryRequirements && (
              <section className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
                <h3 className="font-black">متطلبات التصنيف</h3>
                {selected.missingRequirements?.length > 0 ? (
                  <p className="text-amber-800 dark:text-amber-300">
                    نواقص: {selected.missingRequirements.map(localizeMissingRequirement).join("، ")}
                  </p>
                ) : (
                  <p className="text-emerald-700 dark:text-emerald-300">متطلبات البيانات والصور والوثائق مكتملة.</p>
                )}
                {!selected.categoryRequirements.publicListingEnabled && (
                  <p className="font-bold text-amber-800 dark:text-amber-300">النشر العام متوقف لهذه الفئة وفق السياسة الحالية.</p>
                )}
                {selected.publicationChecks && (
                  <ul className="grid gap-1 border-t pt-2 sm:grid-cols-2">
                    {[
                      ["basicDataComplete", "البيانات الأساسية مكتملة"],
                      ["categoryDataComplete", "البيانات الخاصة بالتصنيف مكتملة"],
                      ["imagesComplete", "الصور المطلوبة مكتملة"],
                      ["documentsPresent", "الوثائق المطلوبة مكتملة"],
                      ["documentsReviewed", "الوثائق تمت مراجعتها"],
                      ["documentPolicyApproved", "سياسة الوثائق معتمدة"],
                      ["noMaterialChangesAfterReview", "لا توجد تغييرات جوهرية غير مراجعة"],
                      ["sellerVerified", "توثيق البائع ساري"],
                      ["administrativeApproval", "الموافقة الإدارية النهائية موجودة"],
                      ["publicationEligible", "المزاد مؤهل للنشر"]
                    ].map(([key, label]) => (
                      <li key={key} className={selected.publicationChecks[key] ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}>
                        {selected.publicationChecks[key] ? "✓" : "✗"} {label}
                      </li>
                    ))}
                  </ul>
                )}
                {selected.publicationReasons?.length > 0 && (
                  <div className="rounded-lg bg-red-50 p-3 text-red-800 dark:bg-red-950/30 dark:text-red-300">
                    <p className="font-bold">لا يمكن نشر المزاد للأسباب التالية:</p>
                    <ul className="mt-1 list-inside list-disc">
                      {selected.publicationReasons.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  </div>
                )}
                {selected.categoryRequirements.fields.map((field) => (
                  <div key={field.key} className="grid gap-1 border-t border-slate-100 pt-2 dark:border-slate-800 sm:grid-cols-[minmax(10rem,1fr)_2fr]">
                    <span className="text-slate-500">{field.label}{field.required ? " *" : ""}</span>
                    <span className="whitespace-pre-wrap font-bold">
                      {formatCategoryFieldValue(field, selected.categoryDetails?.[field.key])}
                    </span>
                  </div>
                ))}
              </section>
            )}
            {!selected.categoryRequirements && Object.keys(selected.categoryDetails || {}).length > 0 && (
              <dl className="grid gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700 sm:grid-cols-2">
                {Object.entries(selected.categoryDetails).map(([key, value]) => (
                  <div key={key}><dt className="text-slate-500">{categoryFieldLabel(key)}</dt><dd className="whitespace-pre-wrap font-bold">{formatCategoryFieldValue(null, value)}</dd></div>
                ))}
              </dl>
            )}
            {selected.categoryDocuments?.length > 0 && (
              <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <h3 className="font-black">وثائق خاصة للفئة — الحالة: {categoryDocumentStatusText(selected.categoryDocumentStatus)}</h3>
                <p className="text-sm">يُسمح بتنزيل الملفات للمراجع المخوّل فقط. وجود الملف لا يثبت الملكية؛ تحقق من مطابقته للبيانات قبل القرار.</p>
                {selected.categoryDocuments.map((document) => (
                  <div key={document.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-3 text-sm dark:bg-slate-900">
                    <span className="font-bold">{document.typeLabel || document.type}{document.isCurrent ? "" : " (نسخة سابقة)"} — الإصدار {document.version || "—"}</span>
                    <span>{categoryDocumentStatusText(document.reviewStatus)}</span>
                    <span>رفعها: {document.uploadedBy?.name || "البائع"} — {formatAuctionDate(document.uploadedAt)}</span>
                    {document.expiresAt && <span>تنتهي: {formatAuctionDate(document.expiresAt)}</span>}
                    {document.reviewedBy?.name && <span>راجعها: {document.reviewedBy.name} — {formatAuctionDate(document.reviewedAt)}</span>}
                    {document.reviewNotes && <span>{document.reviewNotes}</span>}
                    {document.rejectionReason && <span className="text-red-700">{document.rejectionReason}</span>}
                    <button type="button" onClick={() => downloadCategoryDocument(document.id)} className="rounded border px-3 py-1 font-bold">تنزيل آمن</button>
                    {document.isCurrent && document.reviewStatus === "pending_review" && (
                      <>
                        <input value={documentReviewNotes} onChange={(event) => setDocumentReviewNotes(event.target.value)} placeholder="ملاحظات مقارنة البيانات بالوثيقة (إلزامية للقبول)" className="min-w-40 flex-1 rounded border px-2 py-1 dark:bg-slate-800" />
                        <button type="button" disabled={busy || documentReviewNotes.trim().length < 3} onClick={() => reviewCategoryDocument(document.id, "approved")} className="rounded bg-emerald-700 px-3 py-1 font-bold text-white disabled:opacity-50">اعتماد الوثيقة</button>
                        <input value={documentRejectionReason} onChange={(event) => setDocumentRejectionReason(event.target.value)} placeholder="سبب الرفض (إلزامي)" className="min-w-40 flex-1 rounded border px-2 py-1 dark:bg-slate-800" />
                        <button type="button" disabled={busy || documentRejectionReason.trim().length < 3} onClick={() => reviewCategoryDocument(document.id, "rejected")} className="rounded bg-red-700 px-3 py-1 font-bold text-white disabled:opacity-50">رفض الوثيقة</button>
                      </>
                    )}
                  </div>
                ))}
                {["cars-for-sale", "real-estate"].includes(selected.category?.slug) &&
                  !selected.categoryRequirements?.publicListingEnabled && (
                  <p className="text-sm font-bold text-amber-900">النشر العام لهذه الفئة متوقف إلى حين اعتماد سياسة أنواع الوثائق المقبولة.</p>
                )}
              </section>
            )}
            {selected.winner && (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
                الفائز: {selected.winner.name} {selected.winner.phone || ""}
              </p>
            )}
            {selected.latestAcknowledgment && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm dark:bg-blue-950">
                <p className="font-bold">إقرار البائع ({selected.latestAcknowledgment.version})</p>
                <p>{selected.latestAcknowledgment.text}</p>
                <p className="mt-1 text-xs">{formatAuctionDate(selected.latestAcknowledgment.acceptedAt)}</p>
              </div>
            )}
            {["scheduled", "live", "ended"].includes(selected.status) && (
              <Link to={`/auctions/${selected.id}`} className="inline-block font-bold text-blue-700">عرض صفحة المزاد</Link>
            )}
            <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              <h3 className="font-bold">سجل العروض</h3>
              {bids.length ? (
                <ul className="max-h-40 space-y-2 overflow-y-auto text-sm">
                  {bids.map((bid) => (
                    <li key={bid.id} className="flex justify-between gap-3">
                      <span>{bid.bidder?.name || "مستخدم"}</span>
                      <span>{formatAuctionMoney(bid.amount, selected.currency)}</span>
                      <span>{formatAuctionDate(bid.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-500">لا توجد عروض.</p>}
            </div>
            <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              <h3 className="font-bold">سجل القرارات الإدارية</h3>
              {auditLog.length ? (
                <ol className="space-y-2 text-sm">
                  {auditLog.map((entry) => (
                    <li key={entry.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                      <p className="font-bold">{entry.action} — {entry.administrator?.name || "مشرف"}</p>
                      <p>{formatAuctionDate(entry.decisionAt)}{entry.reason ? ` — ${entry.reason}` : ""}</p>
                    </li>
                  ))}
                </ol>
              ) : <p className="text-sm text-slate-500">لا توجد قرارات مسجلة.</p>}
            </div>

            {selected.reviewStatus === "pending" && (
              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button type="button" disabled={busy} onClick={() => runAction("approve")} className="rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50">موافقة</button>
                <div className="flex min-w-56 flex-1 gap-2">
                  <input value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} minLength={3} maxLength={1000} placeholder="سبب الرفض" className="min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                  <button type="button" disabled={busy || rejectionReason.trim().length < 3} onClick={() => runAction("reject", { reason: rejectionReason })} className="rounded-xl bg-red-700 px-4 py-2 font-bold text-white disabled:opacity-50">رفض</button>
                </div>
              </div>
            )}
            {["scheduled", "live"].includes(selected.status) && (
              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <input value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} minLength={3} maxLength={1000} placeholder="سبب الإلغاء" className="min-w-56 flex-1 rounded-xl border px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                <button type="button" disabled={busy || cancellationReason.trim().length < 3} onClick={() => runAction("cancel", { reason: cancellationReason })} className="rounded-xl border border-red-300 px-4 py-2 font-bold text-red-700 disabled:opacity-50">إلغاء المزاد</button>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function auctionImageLabel(label) {
  return ({
    front: "الواجهة الأمامية",
    rear: "الواجهة الخلفية",
    left_side: "الجانب الأيسر",
    right_side: "الجانب الأيمن",
    interior: "المقصورة الداخلية",
    dashboard: "لوحة العدادات",
    reported_damage: "الأضرار المعلنة",
    vin_location: "موضع رقم الهيكل",
    actual_item: "السلعة الفعلية"
  })[label] || "صورة السلعة";
}

function categoryFieldLabel(key) {
  return ({
    manufacturer: "الشركة المصنعة",
    model: "الموديل",
    trim: "الفئة أو الطراز الفرعي",
    year: "سنة الصنع",
    vehicleType: "نوع المركبة",
    fuelType: "نوع الوقود",
    transmission: "ناقل الحركة",
    engineCapacityCc: "سعة المحرك (سم³)",
    mileageKm: "المسافة المقطوعة (كم)",
    registrationStatus: "حالة التسجيل",
    vehicleCondition: "الحالة العامة للمركبة",
    engineCondition: "حالة المحرك",
    transmissionCondition: "حالة ناقل الحركة",
    bodyCondition: "حالة الهيكل",
    hasAccidentHistory: "هل توجد حوادث سابقة معروفة؟",
    accidentDetails: "تفاصيل الحوادث السابقة",
    hasKnownDamage: "هل توجد أضرار أو أعطال حالية؟",
    knownDefects: "تفاصيل الأضرار أو الأعطال الحالية",
    hasMajorRepairs: "هل توجد إصلاحات جوهرية أو إعادة طلاء؟",
    majorRepairsDetails: "تفاصيل الإصلاحات الجوهرية أو إعادة الطلاء",
    exteriorColor: "اللون الخارجي",
    vin: "رقم الهيكل",
    inspectionLocation: "مكان معاينة المركبة",
    storage: "السعة التخزينية",
    deviceCondition: "حالة الجهاز",
    color: "اللون",
    batteryCondition: "حالة البطارية",
    repairs: "الإصلاحات",
    lockStatus: "حالة القفل أو الحساب المرتبط",
    defects: "العيوب",
    accessories: "الملحقات",
    imei: "رقم IMEI",
    processor: "المعالج",
    memory: "الذاكرة",
    graphicsCard: "كرت الشاشة",
    lensCondition: "حالة العدسة",
    sensorCondition: "حالة المستشعر",
    screenCondition: "حالة الشاشة",
    shutterCount: "عداد الالتقاطات",
    deviceType: "نوع الجهاز",
    propertyType: "نوع العقار",
    area: "المساحة",
    rooms: "عدد الغرف",
    propertyCondition: "حالة العقار",
    services: "الخدمات",
    productType: "نوع المنتج",
    productCondition: "حالة المنتج",
    specifications: "المواصفات",
    age: "العمر التقريبي"
  })[key] || "تفاصيل إضافية";
}

function formatCategoryFieldValue(field, value) {
  if (value === undefined || value === null || value === "") return "—";
  if (field?.options?.length) {
    const option = field.options.find((item) => item.value === value);
    if (option) return option.label;
  }
  if (value === true || value === "true") return "نعم";
  if (value === false || value === "false") return "لا";
  return String(value);
}

function localizeMissingRequirement(requirement) {
  if (!requirement.startsWith("صورة: ")) return requirement;
  return `صورة: ${auctionImageLabel(requirement.slice("صورة: ".length))}`;
}

function categoryDocumentStatusText(status) {
  return ({
    missing: "مفقودة",
    pending_review: "بانتظار المراجعة",
    approved: "معتمدة",
    rejected: "مرفوضة"
  })[status] || "غير محددة";
}
